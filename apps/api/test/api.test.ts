/**
 * HTTP behaviour against a migrated, seeded Postgres (CI runs `pnpm db:migrate && pnpm seed`
 * first). Requests go through `app.request()`, so no port is opened. Without a reachable,
 * seeded database the suite skips rather than fails.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isPodName, schemaVersionLabel } from "@cdop/schemas";
import { sql } from "kysely";
import pino from "pino";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createApiKey } from "../src/db/keys-cli.js";
import { createDb, createPool } from "../src/db/kysely.js";
import { loadEnv } from "../src/env.js";
import { createLinker } from "../src/http/context.js";

if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");

type App = ReturnType<typeof createApp>;
interface Hal {
  _links: Record<string, { href: string; name?: string } & Record<string, unknown>> & {
    "cdop:document"?: Array<{ href: string; name: string; title?: string }>;
  };
  _embedded: Record<
    string,
    Array<{ id: string; _links: { self: { href: string } } } & Record<string, unknown>>
  >;
  [key: string]: unknown;
}

let app: App | undefined;
let pool: Pool | undefined;
const BASE = "http://localhost:3000";

async function connect(): Promise<App | undefined> {
  if (!process.env.DATABASE_URL) return undefined;
  try {
    const env = loadEnv({ ...process.env, PUBLIC_BASE_URL: BASE, LOG_LEVEL: "silent" });
    pool = createPool(env.DATABASE_URL, 4);
    const db = createDb(pool);
    const seeded = await sql<{ n: number }>`select count(*)::int as n from cdop.project`.execute(
      db,
    );
    if ((seeded.rows[0]?.n ?? 0) === 0) return undefined;
    return createApp({
      env,
      db,
      log: pino({ level: "silent" }),
      linker: createLinker(env),
      schemaVersion: schemaVersionLabel(),
      apiVersion: "0.0.0-test",
      startedAt: new Date(),
    });
  } catch {
    return undefined;
  }
}

beforeAll(async () => {
  app = await connect();
  if (!app)
    console.warn("api.test.ts: no seeded database reachable via DATABASE_URL; skipping HTTP tests");
});
afterAll(async () => {
  await pool?.end();
});

const path = (href: string): string => href.replace(BASE, "").replace(/\{[^}]*\}/g, "");
async function get(href: string, headers: Record<string, string> = {}): Promise<Response> {
  if (!app) throw new Error("no app");
  return app.request(path(href), { headers });
}
async function hal(href: string): Promise<Hal> {
  const res = await get(href);
  expect(res.status, href).toBe(200);
  expect(res.headers.get("content-type")).toContain("application/hal+json");
  return (await res.json()) as Hal;
}

describe("HTTP API", () => {
  it("serves a root whose every link resolves", async (ctx) => {
    if (!app) return ctx.skip();
    const root = await hal("/v2");
    expect(root._links["cdop:projects"]?.href).toBe(`${BASE}/v2/projects`);
    for (const [rel, link] of Object.entries(root._links)) {
      if (Array.isArray(link) || rel === "curies" || rel === "mcp" || rel === "cdop:validate")
        continue; // validate is POST only
      if (/\{[^?/]/.test(link.href)) continue; // needs a variable we cannot invent (e.g. {urn})
      const res = await get(link.href);
      expect([200, 302], `${rel} -> ${link.href}`).toContain(res.status);
    }
  });

  it("sends the HAL browser to the root with a fragment it can read", async (ctx) => {
    if (!app) return ctx.skip();
    const res = await get("/explorer");
    expect(res.status).toBe(302);
    // HAL Explorer takes a percent-encoded uri for a relative path and requests /explorer/http%3A...
    expect(res.headers.get("location")).toBe(`/explorer/#uri=${BASE}/v2`);
  });

  it("serves its bundled UIs from this origin only, and tells the browser to enforce it", async (ctx) => {
    if (!app) return ctx.skip();
    expect((await get("/docs")).headers.get("location")).toBe("/docs/");
    for (const page of ["/docs/", "/docs/api", "/explorer/"]) {
      const res = await get(page);
      expect(res.status, page).toBe(200);
      const csp = res.headers.get("content-security-policy") ?? "";
      expect(csp, page).toContain("default-src 'self'");
      expect(csp, page).toContain("script-src 'self'");
      expect(csp, page).toContain("connect-src 'self'");
      expect(/script-src ([^;]+)/.exec(csp)?.[1], page).not.toContain("'unsafe-inline'");
      const html = await res.text();
      // No script, stylesheet, font or image from anywhere else, and no inline handlers.
      expect(
        html.match(/<(?:script|link|img|iframe|source)\b[^>]*(?:src|href)="https?:\/\/[^"]+"/g) ??
          [],
        page,
      ).toEqual([]);
      expect(html, page).not.toMatch(/ on[a-z]+="/);
    }
    // HAL Explorer's theme picker is hard-wired to bootswatch.com; we serve themes ourselves.
    const explorer = await (await get("/explorer/")).text();
    expect(explorer).toContain("MIT License | Copyright (c) Kai Toedter");
    const main = /src="(main-[A-Z0-9]+\.js)"/.exec(explorer)?.[1];
    expect(main).toBeTruthy();
    expect(await (await get(`/explorer/${main}`)).text()).not.toContain("bootswatch.com");
    expect(
      (await get("/explorer/themes/cosmo/bootstrap.min.css")).headers.get("content-type"),
    ).toContain("text/css");
  });

  it("serves the Zudoku docs with only their own inline scripts, pointed at this origin", async (ctx) => {
    if (!app) return ctx.skip();
    for (const page of ["/docs/", "/docs/api", "/docs/api/mcp", "/docs/guides/hateoas-tour"]) {
      const res = await get(page);
      expect(res.status, page).toBe(200);
      const csp = res.headers.get("content-security-policy") ?? "";
      const html = await res.text();
      // Zudoku's template preconnects to its CDN, which no CSP directive covers.
      expect(html, page).not.toContain("cdn.zudoku.dev");
      expect(html, page).not.toContain("api-origin.cdop.invalid");
      // Each inline script is allowed by its own hash.
      const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
      expect(inline.length, page).toBeGreaterThan(0);
      for (const [, body] of inline)
        expect(csp, page).toContain(
          `'sha256-${createHash("sha256")
            .update(body ?? "")
            .digest("base64")}'`,
        );
    }
    // The playground and the MCP card use this deployment's origin, not the build's placeholder.
    const assets = readdirSync(new URL("../../docs/dist/docs/assets/", import.meta.url));
    const chunk = assets.find((file) => /^api-openapi\.json-[\w-]+\.js$/.test(file));
    expect(chunk).toBeTruthy();
    const gzipped = await get(`/docs/assets/${chunk}`, { "accept-encoding": "gzip" });
    expect(gzipped.headers.get("content-encoding")).toBe("gzip");
    const js = await (await get(`/docs/assets/${chunk}`)).text();
    expect(js).not.toContain("api-origin.cdop.invalid");
    expect(js).toContain(BASE);
    expect((await get("/docs/../package.json")).status).toBe(404);
    expect((await get("/docs/%E0")).status).toBe(404);
  });

  it("serves the third-party notices, at the versions it ships", async (ctx) => {
    if (!app) return ctx.skip();
    const res = await get("/licenses");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const notices = await res.text();
    for (const holder of [
      "Copyright (c) Zuplo, Inc.",
      "Copyright (c) 2026 Kai Toedter",
      "Copyright (c) 2025 spgi-lacki",
    ])
      expect(notices).toContain(holder);
    // Bumping Zudoku or HAL Explorer means updating THIRD-PARTY-NOTICES.md too.
    const docs = JSON.parse(
      readFileSync(new URL("../../docs/package.json", import.meta.url), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(notices).toContain(`\`zudoku\` ${docs.dependencies.zudoku}`);
    const fetcher = readFileSync(new URL("../scripts/fetch-explorer.mjs", import.meta.url), "utf8");
    const halVersion = /HAL_EXPLORER_VERSION \?\? "([^"]+)"/.exec(fetcher)?.[1];
    expect(notices).toContain(`\`toedter/hal-explorer\` ${halVersion}`);
    // The libraries bundled into /docs lose their licence comments in the build; this lists them.
    const bundled = await get("/docs/licenses.txt");
    expect(bundled.status).toBe(200);
    const list = await bundled.text();
    for (const pkg of ["zudoku ", "react ", "@fontsource-variable/geist "])
      expect(list).toContain(`\n${pkg}`);
  });

  it("serves its own favicon, and /docs points at it", async (ctx) => {
    if (!app) return ctx.skip();
    for (const href of ["/favicon.ico", "/favicon-192.png"]) {
      const res = await get(href);
      expect(res.status, href).toBe(200);
      expect(res.headers.get("content-type"), href).toBe("image/png");
    }
    expect(await (await get("/docs/")).text()).toContain('rel="icon" href="/docs/favicon.png"');
    expect((await get("/docs/favicon.png")).headers.get("content-type")).toBe("image/png");
  });

  it("pages a collection by following next, without repeats", async (ctx) => {
    if (!app) return ctx.skip();
    const seen = new Set<string>();
    let href: string | undefined = "/v2/projects?limit=7&standard=wcc";
    let total = 0;
    while (href) {
      const page: Hal = await hal(href);
      total = page.total as number;
      for (const row of page._embedded.projects ?? []) {
        expect(seen.has(row.id)).toBe(false);
        seen.add(row.id);
      }
      href = page._links.next?.href;
    }
    expect(seen.size).toBe(total);
    expect(total).toBeGreaterThan(0);
  });

  it("pages every timestamp-sorted collection to the end, although rows share a microsecond timestamp", async (ctx) => {
    if (!app) return ctx.skip();
    // The seed writes each table in one transaction, so every unit and issuance has the same
    // modified_at; a cursor that compared it at millisecond precision lost page 2 onwards.
    for (const [collection, extra] of [
      ["units", ""],
      ["issuances", ""],
      ["accounts", "&sort=-modified_at"],
      ["projects", "&sort=modified_at"],
    ] as const) {
      const seen = new Set<string>();
      let href: string | undefined = `/v2/${collection}?limit=7${extra}`;
      let total = 0;
      while (href) {
        const page: Hal = await hal(href);
        total = page.total as number;
        for (const row of page._embedded[collection] ?? []) {
          expect(seen.has(row.id), `${collection} repeats ${row.id}`).toBe(false);
          seen.add(row.id);
        }
        href = page._links.next?.href;
      }
      expect(total, collection).toBeGreaterThan(7);
      expect(seen.size, collection).toBe(total);
    }
  });

  it("builds request-derived links from PUBLIC_BASE_URL, not from the origin the request arrived on", async (ctx) => {
    if (!app) return ctx.skip();
    // Behind Traefik the API sees http:// on an internal host; its links must still be public.
    const internal = "http://api.internal:3000";
    const projectId = (await hal(`${internal}/v2/projects?limit=1`))._embedded.projects?.[0]?.id;
    for (const href of [
      `${internal}/v2/projects?limit=3`,
      `${internal}/v2/units?limit=3`,
      `${internal}/v2/issuances?limit=3`,
      `${internal}/v2/accounts?limit=3`,
      `${internal}/v2/projects/${projectId}/units`,
    ]) {
      const page = await hal(href);
      for (const rel of ["self", "next", "first"]) {
        const link = page._links[rel];
        if (!link || Array.isArray(link)) continue;
        expect(link.href.startsWith(`${BASE}/v2/`), `${href} ${rel}: ${link.href}`).toBe(true);
      }
    }
  });

  it("puts each project's centroid on its index row, and filters projects by developer account", async (ctx) => {
    if (!app) return ctx.skip();
    const rows = (await hal("/v2/projects?limit=100"))._embedded.projects ?? [];
    for (const row of rows) {
      const c = row.centroid as { lon: number; lat: number };
      expect(c.lon, row.id).toBeGreaterThanOrEqual(-180);
      expect(c.lat, row.id).toBeLessThanOrEqual(90);
    }
    const project = await hal(rows[0]?._links.self.href ?? "");
    const developer = project._links["cdop:owner-account"]?.href;
    expect(developer).toBeTruthy();
    const account = await hal(developer ?? "");
    const developed = await hal(account._links["cdop:projects"]?.href ?? "");
    const ids = (developed._embedded.projects ?? []).map((p) => p.id);
    expect(ids).toContain(project.id);
    expect(ids.length).toBeLessThan(rows.length);
  });

  it("filters with CDOP field names and rejects what it cannot parse as a problem", async (ctx) => {
    if (!app) return ctx.skip();
    const page = await hal("/v2/projects?standard=vcs&limit=5");
    for (const row of page._embedded.projects ?? [])
      expect(String(row.project_identifier)).toMatch(/^cdop:verra:/);
    for (const [href, status, type] of [
      ["/v2/projects?cursor=garbage", 400, "cursor-invalid"],
      ["/v2/projects?sort=nonsense", 422, "validation-failed"],
      ["/v2/projects/prj_nope", 404, "not-found"],
      ["/no-such-route", 404, "not-found"],
    ] as const) {
      const res = await get(href);
      expect(res.status, href).toBe(status);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      expect(((await res.json()) as { type: string }).type).toMatch(
        new RegExp(`/problems/${type}$`),
      );
    }
  });

  it("answers a conditional GET with 304", async (ctx) => {
    if (!app) return ctx.skip();
    const first = (await hal("/v2/projects?limit=1"))._embedded.projects?.[0];
    const res = await get(first?._links.self.href ?? "");
    const etag = res.headers.get("etag");
    expect(etag).toBeTruthy();
    expect((await get(first?._links.self.href ?? "", { "if-none-match": etag ?? "" })).status).toBe(
      304,
    );
  });

  it("walks root -> project -> every CDOP document, each labelled with its conformance", async (ctx) => {
    if (!app) return ctx.skip();
    const project = await hal(
      (await hal("/v2/projects?limit=1&lifecycle_stage=verified"))._embedded.projects?.[0]?._links
        .self.href ?? "",
    );
    const documents = project._links["cdop:document"] ?? [];
    expect(documents.map((d) => d.name)).toContain("full-list");
    for (const d of documents) {
      const res = await get(`${d.href}?strict=1`);
      expect(res.status, d.name).toBe(200);
      expect(res.headers.get("x-cdop-schema-version")).toBe(
        schemaVersionLabel(isPodName(d.name) ? d.name : undefined),
      );
      expect(res.headers.get("link")).toContain('rel="describedby"');
      const conformance = res.headers.get("x-cdop-conformance") ?? "";
      expect(conformance, d.name).toMatch(/^(valid|invalid; )/);
      expect(conformance, d.name).not.toContain("unexplained");
    }
  });

  it("serves the Round 2 draft pods as drafts, pinned apart from CDOP v2.0", async (ctx) => {
    if (!app) return ctx.skip();
    const project = await hal(
      (await hal("/v2/projects?limit=1&lifecycle_stage=verified"))._embedded.projects?.[0]?._links
        .self.href ?? "",
    );
    const links = project._links["cdop:document"] ?? [];
    for (const name of ["registry-metadata", "validation-metadata", "verification-metadata"]) {
      const link = links.find((d) => d.name === name);
      expect(link?.title, name).toMatch(/\(Round 2 draft\)$/);
      const res = await get(link?.href ?? "");
      expect(res.status, name).toBe(200);
      expect(res.headers.get("x-cdop-schema-version")).toMatch(/^round2-draft\+[0-9a-f]{7}$/);
    }
    const registry = await get(links.find((d) => d.name === "registry-metadata")?.href ?? "");
    expect(registry.headers.get("x-cdop-conformance")).toBe("valid");

    const index = await hal("/v2/schemas");
    const drafts = index._embedded.schemas?.filter((s) => s.round === 2) ?? [];
    expect(drafts.map((s) => s.status)).toEqual(["draft", "draft", "draft"]);
    expect((index.round2_upstream as { ref: string }).ref).toBe("R2P-FT-Testing");
  });

  it("answers 404 for Verification Metadata on a project with no verification", async (ctx) => {
    if (!app) return ctx.skip();
    const listed = (await hal("/v2/projects?limit=1&lifecycle_stage=listed"))._embedded
      .projects?.[0];
    if (!listed) return ctx.skip();
    const project = await hal(listed._links.self.href);
    const names = (project._links["cdop:document"] ?? []).map((d) => d.name);
    if (names.includes("verification-metadata")) return ctx.skip();
    expect((await get(`/v2/projects/${listed.id}/cdop/verification-metadata`)).status).toBe(404);
  });

  it("agrees with itself: a document it calls valid passes POST /v2/validate", async (ctx) => {
    if (!app) return ctx.skip();
    const id = (await hal("/v2/projects?limit=1&lifecycle_stage=verified"))._embedded.projects?.[0]
      ?.id;
    const doc = await get(`/v2/projects/${id}/cdop/estimations?strict=1`);
    expect(doc.headers.get("x-cdop-conformance")).toMatch(/^valid/);
    const res = await app.request("/v2/validate?schema=estimations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await doc.text(),
    });
    expect(((await res.json()) as { valid: boolean }).valid).toBe(true);
  });

  it("resolves a CDOP URN to its project with a 303", async (ctx) => {
    if (!app) return ctx.skip();
    const row = (await hal("/v2/projects?limit=1"))._embedded.projects?.[0];
    const res = await get(`/v2/identifiers/${String(row?.project_identifier)}`);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(row?._links.self.href);
  });

  it("serves units, their history and the geometry behind a project", async (ctx) => {
    if (!app) return ctx.skip();
    const unit = (await hal("/v2/units?limit=1&lifecycle_state=retired"))._embedded.units?.[0];
    expect(unit?.lifecycle_state).toBe("retired");
    const history = await hal(`${unit?._links.self.href}/status-history`);
    expect(Object.values(history._embedded)[0]?.length).toBeGreaterThan(1);
    const project = (await hal("/v2/projects?limit=1&lifecycle_stage=validated"))._embedded
      .projects?.[0];
    const files = await hal(`${project?._links.self.href}/geolocation-files`);
    const geo = await get(`${files._embedded["geolocation-files"]?.[0]?._links.self.href}/content`);
    expect(geo.headers.get("content-type")).toContain("application/geo+json");
    expect(((await geo.json()) as { geometry: { type: string } }).geometry.type).toBe("Polygon");
  });

  it("accepts a key stored by keys:new and rejects it once revoked", async (ctx) => {
    if (!app || !pool) return ctx.skip();
    const db = createDb(pool);
    const { id, token } = await createApiKey(db, { role: "developer", label: "api.test.ts" });
    const auth = { authorization: `Bearer ${token}` };
    try {
      expect((await get("/v2", auth)).status).toBe(200);
      await db
        .updateTable("api_key")
        .set({ revoked_at: new Date() })
        .where("id", "=", id)
        .execute();
      expect((await get("/v2", auth)).status).toBe(401);
    } finally {
      await db.deleteFrom("api_key").where("id", "=", id).execute();
    }
  });
});
