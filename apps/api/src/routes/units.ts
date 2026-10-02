import type { OpenAPIHono } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import { mount } from "../http/mount.js";
import { SCHEMA_FILES } from "@cdop/schemas";
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
import { halJson, json, csv } from "../http/respond.js";
import { encodeCursor, parsePage } from "../http/pagination.js";
import { hal, pageLinks } from "../http/hal.js";
import { notModified, strongEtag } from "../http/etag.js";
import { ProblemError, notFound } from "../http/problems.js";
import { getProjectAggregate } from "../services/projects.js";
import { renderUnit, renderUnitStatusHistory } from "../http/render/unit.js";
import { renderIssuance } from "../http/render/facets.js";
import { contextForAggregates } from "../http/aggregate-context.js";
import { buildPodDocument, validateDocument } from "../domain/projection/cdop.js";
import { unitTemplates } from "../http/templates.js";
import { conformanceHeader } from "../http/conformance.js";
import { iso, isoTs } from "../http/render/common.js";

const UnitQuery = PageQuery.extend({
  project_id: z.string().optional(),
  status: z.string().optional().openapi({
    description: "CDOP unit status values, comma-separated",
    example: "Active,Retired",
  }),
  lifecycle_state: z.string().optional().openapi({ example: "active" }),
  vintage: z.string().optional().openapi({ description: "Vintage start year", example: "2023" }),
  type: z.string().optional().openapi({ example: "VCU" }),
  class: z.string().optional().openapi({ description: "credit | pending | buffer" }),
  owner_account_id: z.string().optional(),
  serial_number: z.string().optional(),
  issuance_id: z.string().optional(),
  modified_since: z.string().optional(),
});

export function registerUnitRoutes(app: OpenAPIHono<AppEnv>, deps: AppDeps): void {
  const { linker, db } = deps;

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/units",
      tags: ["Units"],
      summary: "List unit blocks",
      request: { query: UnitQuery },
      responses: {
        200: halResponse(HalResource("UnitPage", "HAL collection of unit blocks"), "Unit page"),
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const q = input.query;
      const page = parsePage(q, {
        sorts: ["modified_at", "vintage", "serial_number"],
        defaultSort: "-modified_at",
        maxLimit: 250,
      });
      let query = db.selectFrom("unit_block").selectAll();
      let count = db.selectFrom("unit_block").select((eb) => eb.fn.countAll<number>().as("n"));
      const where = <Q extends typeof query | typeof count>(qb: Q): Q => {
        let out = qb as typeof query;
        if (q.project_id) out = out.where("project_id", "=", q.project_id);
        const statuses = csv(q.status);
        if (statuses) out = out.where("cdop_status", "in", statuses);
        const states = csv(q.lifecycle_state);
        if (states) out = out.where("state", "in", states);
        const types = csv(q.type);
        if (types) out = out.where("unit_type", "in", types);
        const classes = csv(q.class);
        if (classes) out = out.where("unit_class", "in", classes);
        if (q.owner_account_id) out = out.where("owner_account_id", "=", q.owner_account_id);
        if (q.serial_number) out = out.where("serial_number", "=", q.serial_number);
        if (q.issuance_id) out = out.where("issuance_id", "=", q.issuance_id);
        if (q.vintage) {
          const year = Number(q.vintage);
          if (!Number.isInteger(year))
            throw new ProblemError("validation-failed", "vintage must be a year");
          out = out
            .where("vintage_start_on", ">=", new Date(Date.UTC(year, 0, 1)))
            .where("vintage_start_on", "<=", new Date(Date.UTC(year, 11, 31)));
        }
        if (q.modified_since) {
          const d = new Date(q.modified_since);
          if (Number.isNaN(d.getTime()))
            throw new ProblemError(
              "validation-failed",
              "modified_since must be an RFC 3339 timestamp",
            );
          out = out.where("modified_at", ">=", d);
        }
        return out as Q;
      };
      query = where(query);
      count = where(count);
      const col =
        page.sort === "vintage"
          ? "vintage_start_on"
          : page.sort === "serial_number"
            ? "serial_number"
            : "modified_at";
      if (page.cursor) {
        const cmp = page.direction === "asc" ? ">" : "<";
        const cursorId = page.cursor.id;
        if (col === "serial_number") {
          const v = String(page.cursor.v);
          query = query.where((eb) =>
            eb.or([eb(col, cmp, v), eb.and([eb(col, "=", v), eb("id", cmp, cursorId)])]),
          );
        } else {
          const v = new Date(String(page.cursor.v));
          query = query.where((eb) =>
            eb.or([eb(col, cmp, v), eb.and([eb(col, "=", v), eb("id", cmp, cursorId)])]),
          );
        }
      }
      const [rows, total] = await Promise.all([
        query
          .orderBy(col, page.direction)
          .orderBy("id", page.direction)
          .limit(page.limit + 1)
          .execute(),
        count.executeTakeFirst(),
      ]);
      const items = rows.slice(0, page.limit).map((b) =>
        hal(
          {
            id: b.id,
            project_id: b.project_id,
            serial_number: b.serial_number,
            type: b.unit_type,
            class: b.unit_class,
            vintage: iso(b.vintage_start_on),
            vintage_label: b.vintage_label,
            quantity: Number(b.quantity),
            status: b.cdop_status,
            lifecycle_state: b.state,
            owner_account_id: b.owner_account_id,
            modified_at: isoTs(b.modified_at),
          },
          {
            self: linker.link(`/v2/units/${b.id}`),
            [linker.rel("project")]: linker.link(`/v2/projects/${b.project_id}`),
            [linker.rel("issuance")]: linker.link(`/v2/issuances/${b.issuance_id}`),
          },
        ),
      );
      const last = rows.length > page.limit ? rows[page.limit - 1] : undefined;
      const nextCursor = last
        ? encodeCursor({
            v:
              col === "modified_at"
                ? new Date(last.modified_at).toISOString()
                : col === "vintage_start_on"
                  ? new Date(last.vintage_start_on).toISOString()
                  : last.serial_number,
            id: last.id,
          })
        : undefined;
      const links = pageLinks(linker, {
        selfUrl: c.req.url,
        nextCursor,
        searchTemplate:
          linker.url("/v2/units") +
          "{?project_id,status,lifecycle_state,vintage,type,class,owner_account_id,serial_number,issuance_id,modified_since,sort,limit,cursor}",
        describedBy: linker.url(`/v2/schemas/${SCHEMA_FILES["unit-description"]}`),
      });
      links.up = linker.link("/v2");
      return halJson(
        c,
        hal({ total: Number(total?.n ?? 0), limit: page.limit, count: items.length }, links, {
          embedded: { units: items },
        }),
      );
    },
  );

  const loadBlock = async (unitId: string) => {
    const row = await db
      .selectFrom("unit_block")
      .select(["project_id", "version"])
      .where("id", "=", unitId)
      .executeTakeFirst();
    if (!row) throw notFound("Unit block", unitId);
    const agg = await getProjectAggregate(db, row.project_id);
    const block = agg.blocks.find((b) => b.id === unitId);
    if (!block) throw notFound("Unit block", unitId);
    return { agg, block, version: row.version };
  };

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/units/{id}",
      tags: ["Units"],
      summary: "Get a unit block",
      request: { params: IdParam("unt_…") },
      responses: {
        200: halResponse(
          HalResource("Unit", "Unit block with status, links and HAL-FORMS templates"),
          "Unit",
        ),
        304: { description: "Not modified" },
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const { agg, block, version } = await loadBlock(input.params.id);
      const etag = strongEtag(version);
      const nm = notModified(c, etag);
      if (nm) return nm;
      const ctx = await contextForAggregates(deps, [agg]);
      const caller = c.get("caller");
      const showAll = deps.env.AFFORDANCES_FOR_ANONYMOUS === "all" && caller.role === "public";
      return halJson(
        c,
        renderUnit(block, agg, linker, {
          ownerName: ctx.account(block.owner_account_id)?.name,
          templates: unitTemplates(
            linker,
            block.id,
            block.state,
            block.block_end - block.block_start + 1,
            caller.role,
            showAll,
          ),
        }),
        200,
        { etag },
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/units/{id}/status-history",
      tags: ["Units"],
      summary: "Unit status records (newest first)",
      request: { params: IdParam("unt_…") },
      responses: {
        200: halResponse(HalResource("UnitStatusHistory", "Unit status records"), "History"),
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const { agg, block } = await loadBlock(input.params.id);
      return halJson(c, renderUnitStatusHistory(block, agg.id, linker));
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/units/{id}/cdop/{pod}",
      tags: ["CDOP documents"],
      summary: "CDOP document for a unit block (unit-description or full-list)",
      request: {
        params: z.object({ id: z.string(), pod: z.enum(["unit-description", "full-list"]) }),
        query: z.object({ strict: z.string().optional() }),
      },
      responses: {
        200: {
          description: "CDOP document",
          content: { "application/json": { schema: z.record(z.string(), z.unknown()) } },
        },
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const { id, pod } = input.params;
      const { agg, block, version } = await loadBlock(id);
      const ctx = await contextForAggregates(deps, [agg]);
      const strict = input.query.strict === "1";
      const result = buildPodDocument(agg, ctx, pod, { unitId: block.id, strict });
      const validation = validateDocument(pod, result.document);
      const etag = strongEtag(`${version}-${pod}-${strict ? "s" : ""}`);
      const nm = notModified(c, etag);
      if (nm) return nm;
      return json(c, result.document, 200, {
        etag,
        link: `<${linker.url(`/v2/schemas/${SCHEMA_FILES[pod]}`)}>; rel="describedby"; type="application/schema+json", <${linker.url(`/v2/units/${id}`)}>; rel="up"`,
        "x-cdop-schema-version": deps.schemaVersion,
        "x-cdop-conformance": conformanceHeader(validation, result),
      });
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/issuances",
      tags: ["Issuances"],
      summary: "List issuance batches",
      request: {
        query: PageQuery.extend({
          project_id: z.string().optional(),
          status: z.string().optional(),
          modified_since: z.string().optional(),
        }),
      },
      responses: {
        200: halResponse(HalResource("IssuancePage", "Issuance batches"), "Issuances"),
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const q = input.query;
      const page = parsePage(q, {
        sorts: ["modified_at", "issued_on"],
        defaultSort: "-modified_at",
      });
      let query = db.selectFrom("issuance").selectAll();
      let count = db.selectFrom("issuance").select((eb) => eb.fn.countAll<number>().as("n"));
      const where = <Q extends typeof query | typeof count>(qb: Q): Q => {
        let out = qb as typeof query;
        if (q.project_id) out = out.where("project_id", "=", q.project_id);
        const statuses = csv(q.status);
        if (statuses) out = out.where("status", "in", statuses);
        if (q.modified_since) out = out.where("modified_at", ">=", new Date(q.modified_since));
        return out as Q;
      };
      query = where(query);
      count = where(count);
      const col = page.sort === "issued_on" ? "issued_on" : "modified_at";
      if (page.cursor) {
        const cmp = page.direction === "asc" ? ">" : "<";
        const cursorId = page.cursor.id;
        const v = new Date(String(page.cursor.v));
        query = query.where((eb) =>
          eb.or([eb(col, cmp, v), eb.and([eb(col, "=", v), eb("id", cmp, cursorId)])]),
        );
      }
      const [rows, total] = await Promise.all([
        query
          .orderBy(col, page.direction)
          .orderBy("id", page.direction)
          .limit(page.limit + 1)
          .execute(),
        count.executeTakeFirst(),
      ]);
      const items = rows.slice(0, page.limit).map((i) =>
        hal(
          {
            id: i.id,
            batch_identifier: i.batch_identifier,
            project_id: i.project_id,
            kind: i.kind,
            issuance_status: i.status,
            unit_type: i.unit_type,
            unit_class: i.unit_class,
            vintage_label: i.vintage_label,
            date_of_issuance: iso(i.issued_on),
            batch_issued_volume: Number(i.volume),
            cumulative_issued_volume: Number(i.cumulative_volume),
            modified_at: isoTs(i.modified_at),
          },
          {
            self: linker.link(`/v2/issuances/${i.id}`),
            [linker.rel("project")]: linker.link(`/v2/projects/${i.project_id}`),
            [linker.rel("units")]: linker.link("/v2/units", undefined, { issuance_id: i.id }),
          },
        ),
      );
      const last = rows.length > page.limit ? rows[page.limit - 1] : undefined;
      const nextCursor = last
        ? encodeCursor({
            v: new Date(
              col === "modified_at" ? last.modified_at : (last.issued_on ?? last.modified_at),
            ).toISOString(),
            id: last.id,
          })
        : undefined;
      const links = pageLinks(linker, {
        selfUrl: c.req.url,
        nextCursor,
        searchTemplate:
          linker.url("/v2/issuances") + "{?project_id,status,modified_since,sort,limit,cursor}",
        describedBy: linker.url(`/v2/schemas/${SCHEMA_FILES.issuances}`),
      });
      links.up = linker.link("/v2");
      return halJson(
        c,
        hal({ total: Number(total?.n ?? 0), limit: page.limit, count: items.length }, links, {
          embedded: { issuances: items },
        }),
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/issuances/{id}",
      tags: ["Issuances"],
      summary: "Get an issuance batch",
      request: { params: IdParam("iss_…") },
      responses: {
        200: halResponse(HalResource("Issuance", "Issuance batch"), "Issuance"),
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const id = input.params.id;
      const row = await db
        .selectFrom("issuance")
        .select(["project_id"])
        .where("id", "=", id)
        .executeTakeFirst();
      if (!row) throw notFound("Issuance", id);
      const agg = await getProjectAggregate(db, row.project_id);
      const issuance = agg.issuances.find((i) => i.id === id);
      if (!issuance) throw notFound("Issuance", id);
      return halJson(c, renderIssuance(issuance, agg, linker));
    },
  );
}
