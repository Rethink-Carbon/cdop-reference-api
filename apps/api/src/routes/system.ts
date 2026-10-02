import type { OpenAPIHono } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import { mount } from "../http/mount.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "kysely";
import { POD_NAMES, SCHEMA_FILES } from "@cdop/schemas";
import type { AppEnv } from "../app-env.js";
import type { AppDeps } from "../http/context.js";
import { HalResource, halResponse, z } from "../http/schemas.js";
import { halJson, json } from "../http/respond.js";
import { hal, type Links } from "../http/hal.js";
import { PROBLEM_CATALOGUE } from "../http/problems.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const docsRoots = [
  path.resolve(here, "../../../../docs"),
  path.resolve(here, "../../docs"),
  path.resolve(process.cwd(), "docs"),
];

async function readDoc(rel: string): Promise<string | undefined> {
  for (const root of docsRoots) {
    try {
      return await readFile(path.join(root, rel), "utf8");
    } catch {
      /* next */
    }
  }
  return undefined;
}

function markdownToHtml(md: string, title: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = esc(md)
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/```([\s\S]*?)```/g, (_m, code: string) => `<pre><code>${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\s*[-*] (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "</p><p>");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.55 system-ui,sans-serif;max-width:52rem;margin:3rem auto;padding:0 1.25rem;color:#1f1d1c;background:#fbfaf7}code,pre{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#efece6;border-radius:4px}code{padding:.1em .35em}pre{padding:.9em 1em;overflow:auto}a{color:#8a6d1c}h1{font-weight:600;letter-spacing:-.01em}</style></head><body><p>${body}</p></body></html>`;
}

export function registerSystemRoutes(app: OpenAPIHono<AppEnv>, deps: AppDeps): void {
  const { linker } = deps;

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2",
      tags: ["Root"],
      summary: "API root (HAL)",
      responses: {
        200: halResponse(HalResource("Root", "Entry point with links to every collection"), "Root"),
      },
    }),
    (c, _input) => {
      const links: Links = {
        self: linker.link("/v2"),
        curies: linker.curies(),
        "service-desc": linker.link("/v2/openapi.json", { type: "application/openapi+json" }),
        "service-doc": linker.link("/docs", { type: "text/html" }),
        status: linker.link("/healthz"),
        describedby: linker.link("/v2/schemas"),
        [linker.rel("projects")]: linker.link("/v2/projects"),
        [linker.rel("units")]: linker.link("/v2/units"),
        [linker.rel("issuances")]: linker.link("/v2/issuances"),
        [linker.rel("accounts")]: linker.link("/v2/accounts"),
        [linker.rel("reference")]: linker.templated("/v2/reference{/list}"),
        [linker.rel("schema")]: linker.templated("/v2/schemas{/file}"),
        [linker.rel("state-machine")]: linker.templated("/v2/state-machines{/entity}{?standard}"),
        [linker.rel("identifier")]: linker.templated("/v2/identifiers/{urn}"),
        [linker.rel("validate")]: linker.templated("/v2/validate{?schema}"),
        // M2: `cdop:events` (/v2/changes), `monitor` (/v2/events, SSE) and `cdop:webhooks` join the
        // root when their routes land. A root must not advertise a link that answers 404.
        [linker.rel("feedback")]: linker.link("/rels/feedback", { type: "text/html" }),
        [linker.rel("document")]: POD_NAMES.map((pod) => ({
          name: pod,
          href: linker.url(`/v2/schemas/${SCHEMA_FILES[pod]}`),
          type: "application/schema+json",
        })),
        explorer: linker.link("/explorer/", { type: "text/html" }),
        atlas: linker.link("/atlas/", {
          type: "text/html",
          title: "Visual explorer: projects and accounts on a map, with charts",
        }),
        mcp: linker.link("/mcp", { title: "Model Context Protocol endpoint (Streamable HTTP)" }),
      };
      return halJson(
        c,
        hal(
          {
            name: "CDOP reference API",
            api_version: deps.apiVersion,
            schema_version: deps.schemaVersion,
            hypermedia: "HAL + HAL-FORMS",
            documentation: linker.url("/docs"),
            milestone: "M1 (read-only; actions, events and webhooks land in M2)",
          },
          links,
        ),
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/healthz",
      tags: ["Root"],
      summary: "Health",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: z.object({
                status: z.string(),
                db: z.string(),
                api_version: z.string(),
                schema_version: z.string(),
                events_sequence: z.number().nullable(),
                projects: z.number().nullable(),
                uptime_s: z.number(),
              }),
            },
          },
        },
        503: {
          description: "Degraded",
          content: {
            "application/json": { schema: z.object({ status: z.string(), db: z.string() }) },
          },
        },
      },
    }),
    async (c, _input) => {
      const started = Date.now();
      try {
        const [seq, projects] = await Promise.all([
          sql<{ max: number | null }>`select max(sequence)::bigint as max from cdop.event`.execute(
            deps.db,
          ),
          sql<{ n: number }>`select count(*)::int as n from cdop.project`.execute(deps.db),
        ]);
        return json(
          c,
          {
            status: "ok",
            db: `ok (${Date.now() - started} ms)`,
            api_version: deps.apiVersion,
            schema_version: deps.schemaVersion,
            events_sequence: seq.rows[0]?.max ?? null,
            projects: projects.rows[0]?.n ?? null,
            uptime_s: Math.round((Date.now() - deps.startedAt.getTime()) / 1000),
          },
          200,
          { "cache-control": "no-store" },
        );
      } catch (err) {
        deps.log.error({ err }, "healthz db check failed");
        return json(c, { status: "degraded", db: "unreachable" }, 503, {
          "cache-control": "no-store",
        });
      }
    },
  );

  app.get("/rels/:rel", async (c, _input) => {
    const rel = c.req.param("rel").replace(/[^a-z0-9-]/g, "");
    const md = await readDoc(`rels/${rel}.md`);
    if (!md) return c.text(`Unknown link relation: ${rel}`, 404);
    if (c.req.header("accept")?.includes("text/markdown"))
      return c.text(md, 200, { "content-type": "text/markdown; charset=utf-8" });
    return c.html(markdownToHtml(md, `cdop:${rel}`));
  });

  app.get("/problems/:slug", (c, _input) => {
    const slug = c.req.param("slug");
    const entry = PROBLEM_CATALOGUE.find((p) => p.slug === slug);
    if (!entry) return c.text(`Unknown problem type: ${slug}`, 404);
    return c.html(
      markdownToHtml(
        `# ${entry.title}\n\nHTTP status ${entry.status}. Problem type \`${linker.url(`/problems/${slug}`)}\` (RFC 9457).\n\nSee the [OpenAPI document](${linker.url("/docs")}) for where this problem can occur.`,
        entry.title,
      ),
    );
  });

  app.get("/problems", (c) =>
    json(
      c,
      PROBLEM_CATALOGUE.map((p) => ({ ...p, type: linker.url(`/problems/${p.slug}`) })),
    ),
  );

  app.get("/", (c) => c.redirect("/docs", 302));
}
