import type { OpenAPIHono } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import { mount } from "../http/mount.js";
import type { AppEnv } from "../app-env.js";
import type { AppDeps } from "../http/context.js";
import {
  HalResource,
  IdParam,
  PageQuery,
  halResponse,
  problemResponses,
  z,
} from "../http/schemas.js";
import { halJson, csv } from "../http/respond.js";
import { encodeCursor, parsePage, sortKey } from "../http/pagination.js";
import { hal, pageLinks } from "../http/hal.js";
import { notFound } from "../http/problems.js";
import { iso, isoTs, clean } from "../http/render/common.js";

export function registerAccountRoutes(app: OpenAPIHono<AppEnv>, deps: AppDeps): void {
  const { linker, db } = deps;

  const renderAccount = (
    a: {
      id: string;
      registry_id: string;
      organisation_id: string | null;
      native_account_id: string | null;
      name: string;
      account_type: string;
      status: string;
      parent_account_id: string | null;
      is_master: boolean;
      standard_id: string | null;
      opened_on: Date | string | null;
      country_code: string | null;
      holdings_public: boolean;
      retirements_public: boolean;
      modified_at: Date | string;
    },
    orgName?: string,
  ) =>
    hal(
      clean({
        id: a.id,
        name: a.name,
        account_type: a.account_type,
        status: a.status,
        registry: a.registry_id,
        standard: a.standard_id ?? undefined,
        native_account_id: a.native_account_id ?? undefined,
        organisation_id: a.organisation_id ?? undefined,
        organisation_name: orgName,
        parent_account_id: a.parent_account_id ?? undefined,
        is_master: a.is_master,
        opened_on: iso(a.opened_on),
        country_code: a.country_code ?? undefined,
        holdings_public: a.holdings_public,
        retirements_public: a.retirements_public,
        modified_at: isoTs(a.modified_at),
      }),
      {
        self: linker.link(`/v2/accounts/${a.id}`),
        curies: linker.curies(),
        collection: linker.link("/v2/accounts"),
        [linker.rel("units")]: linker.link(`/v2/accounts/${a.id}/units`),
        [linker.rel("projects")]: linker.link("/v2/projects", undefined, {
          developer_account_id: a.id,
        }),
        ...(a.parent_account_id ? { up: linker.link(`/v2/accounts/${a.parent_account_id}`) } : {}),
      },
    );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/accounts",
      tags: ["Accounts"],
      summary: "List registry accounts",
      request: {
        query: PageQuery.extend({
          registry: z.string().optional(),
          account_type: z.string().optional(),
          q: z.string().optional(),
        }),
      },
      responses: {
        200: halResponse(HalResource("AccountPage", "Registry accounts"), "Accounts"),
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const q = input.query;
      const page = parsePage(q, { sorts: ["name", "modified_at"], defaultSort: "name" });
      let query = db.selectFrom("account").selectAll();
      let count = db.selectFrom("account").select((eb) => eb.fn.countAll<number>().as("n"));
      const where = <Q extends typeof query | typeof count>(qb: Q): Q => {
        let out = qb as typeof query;
        const registries = csv(q.registry);
        if (registries) out = out.where("registry_id", "in", registries);
        const types = csv(q.account_type);
        if (types) out = out.where("account_type", "in", types);
        if (q.q) out = out.where("name", "ilike", `%${q.q}%`);
        return out as Q;
      };
      query = where(query);
      count = where(count);
      const col = page.sort === "modified_at" ? "modified_at" : "name";
      const key = sortKey(col, col === "modified_at");
      if (page.cursor) {
        const cmp = page.direction === "asc" ? ">" : "<";
        const v = col === "modified_at" ? new Date(String(page.cursor.v)) : String(page.cursor.v);
        query = query.where((eb) =>
          eb.or([eb(key, cmp, v), eb.and([eb(key, "=", v), eb("id", cmp, page.cursor?.id ?? "")])]),
        );
      }
      const [rows, total] = await Promise.all([
        query
          .orderBy(key, page.direction)
          .orderBy("id", page.direction)
          .limit(page.limit + 1)
          .execute(),
        count.executeTakeFirst(),
      ]);
      const items = rows.slice(0, page.limit).map((a) => renderAccount(a));
      const last = rows.length > page.limit ? rows[page.limit - 1] : undefined;
      const nextCursor = last
        ? encodeCursor({
            v: col === "modified_at" ? new Date(last.modified_at).toISOString() : last.name,
            id: last.id,
          })
        : undefined;
      const links = pageLinks(linker, {
        selfUrl: c.req.url,
        nextCursor,
        searchTemplate: linker.url("/v2/accounts") + "{?registry,account_type,q,sort,limit,cursor}",
      });
      links.up = linker.link("/v2");
      return halJson(
        c,
        hal({ total: Number(total?.n ?? 0), limit: page.limit, count: items.length }, links, {
          embedded: { accounts: items },
        }),
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/accounts/{id}",
      tags: ["Accounts"],
      summary: "Get a registry account",
      request: { params: IdParam("acc_…") },
      responses: {
        200: halResponse(HalResource("Account", "Registry account"), "Account"),
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const id = input.params.id;
      const a = await db.selectFrom("account").selectAll().where("id", "=", id).executeTakeFirst();
      if (!a) throw notFound("Account", id);
      const org = a.organisation_id
        ? await db
            .selectFrom("organisation")
            .select("legal_name")
            .where("id", "=", a.organisation_id)
            .executeTakeFirst()
        : undefined;
      const holdings = await db
        .selectFrom("unit_block")
        .select((eb) => [eb.fn.sum<number>("quantity").as("quantity"), "state", "unit_type"])
        .where("owner_account_id", "=", id)
        .groupBy(["state", "unit_type"])
        .execute();
      const body = renderAccount(a, org?.legal_name);
      body.holdings = holdings.map((h) => ({
        state: h.state,
        unit_type: h.unit_type,
        quantity: Number(h.quantity),
      }));
      return halJson(c, body);
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/accounts/{id}/units",
      tags: ["Accounts"],
      summary: "Unit blocks held by an account",
      request: { params: IdParam("acc_…"), query: PageQuery },
      responses: {
        200: halResponse(HalResource("AccountUnits", "Unit blocks"), "Units"),
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const id = input.params.id;
      const exists = await db
        .selectFrom("account")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();
      if (!exists) throw notFound("Account", id);
      return c.redirect(
        linker.url("/v2/units", { owner_account_id: id, limit: input.query.limit }),
        303,
      );
    },
  );
}
