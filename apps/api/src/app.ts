import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./app-env.js";
import type { AppDeps } from "./http/context.js";
import { ProblemError, problemResponse } from "./http/problems.js";
import { callerMiddleware } from "./http/auth.js";
import { registerSystemRoutes } from "./routes/system.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerUnitRoutes } from "./routes/units.js";
import { registerAccountRoutes } from "./routes/accounts.js";
import { registerReferenceRoutes } from "./routes/reference.js";
import { registerAtlasRoutes } from "./routes/atlas.js";
import { registerDocsRoutes } from "./routes/docs.js";
import { openApiConfig } from "./http/openapi.js";
import { analyticsCsp, withAnalytics } from "./http/analytics.js";
import { newId } from "./domain/ids.js";
import { createMcpHttpHandler } from "./mcp/server.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
// Licence texts for the third-party code and data this service serves: at the repository root
// locally and in CI, and next to dist/ in the image.
async function readNotices(): Promise<string | undefined> {
  for (const root of [apiRoot, path.resolve(apiRoot, "../..")]) {
    try {
      return await readFile(path.join(root, "THIRD-PARTY-NOTICES.md"), "utf8");
    } catch {
      /* next */
    }
  }
  return undefined;
}

// HAL Explorer's policy: this origin only.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

export function createApp(deps: AppDeps): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();
  const uiHeaders: MiddlewareHandler = async (c, next) => {
    await next();
    c.header("content-security-policy", analyticsCsp(CSP, deps.env));
    c.header("referrer-policy", "no-referrer");
  };

  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? newId("evt").slice(4);
    c.set("requestId", requestId);
    const started = performance.now();
    await next();
    c.header("x-request-id", requestId);
    c.header("x-api-version", deps.apiVersion);
    if (!c.res.headers.get("x-cdop-schema-version"))
      c.header("x-cdop-schema-version", deps.schemaVersion);
    deps.log.info(
      {
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        status: c.res.status,
        ms: Math.round(performance.now() - started),
        requestId,
      },
      "request",
    );
  });
  app.use(
    "*",
    cors({
      origin:
        deps.env.CORS_ORIGINS === "*" ? "*" : deps.env.CORS_ORIGINS.split(",").map((s) => s.trim()),
      exposeHeaders: [
        "etag",
        "link",
        "x-cdop-schema-version",
        "x-cdop-conformance",
        "x-api-version",
        "x-request-id",
      ],
    }),
  );
  app.use("/v2/*", callerMiddleware(deps));
  app.use("/mcp/*", callerMiddleware(deps));
  app.use("/mcp", callerMiddleware(deps));

  app.onError((err, c) => {
    if (err instanceof ProblemError) return problemResponse(c, deps.linker.baseUrl, err);
    deps.log.error({ err, requestId: c.get("requestId") }, "unhandled error");
    return problemResponse(
      c,
      deps.linker.baseUrl,
      new ProblemError("internal", "An unexpected error occurred", {
        request_id: c.get("requestId"),
      }),
    );
  });
  app.notFound((c) =>
    problemResponse(
      c,
      deps.linker.baseUrl,
      new ProblemError("not-found", `No resource at ${new URL(c.req.url).pathname}`),
    ),
  );

  registerSystemRoutes(app, deps);
  registerProjectRoutes(app, deps);
  registerUnitRoutes(app, deps);
  registerAccountRoutes(app, deps);
  registerReferenceRoutes(app, deps);

  // MCP (Streamable HTTP, stateless). Tools call this same app in-process.
  const mcp = createMcpHttpHandler(deps, (req) => Promise.resolve(app.fetch(req)));
  app.all("/mcp", (c) => mcp(c.req.raw));
  app.all("/mcp/*", (c) => mcp(c.req.raw));

  // OpenAPI: serve the committed artefact when present (CI keeps it in sync), else the live document.
  app.get("/v2/openapi.json", async (c) => {
    try {
      const text = await readFile(path.join(apiRoot, "openapi/openapi.json"), "utf8");
      const doc = JSON.parse(text) as { servers?: unknown };
      doc.servers = [{ url: deps.linker.baseUrl }];
      return c.body(JSON.stringify(doc), 200, {
        "content-type": "application/openapi+json; charset=utf-8",
        "cache-control": "public, max-age=300",
      });
    } catch {
      const doc = app.getOpenAPI31Document(openApiConfig(deps));
      return c.body(JSON.stringify(doc), 200, {
        "content-type": "application/openapi+json; charset=utf-8",
      });
    }
  });
  // Bundled UI scripts stay local; optional analytics allows only its configured destination.
  // /docs sets its own policy, with the hashes of each page's inline scripts (routes/docs.ts).
  app.use("/explorer/*", uiHeaders);

  app.get("/analytics.js", async (c) =>
    c.body(await readFile(path.join(apiRoot, "public/analytics.js"), "utf8"), 200, {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-cache",
    }),
  );

  // Rethink Carbon's mark (from rethinkcarbon.co.uk) is the favicon for every page on this origin.
  for (const [route, file] of [
    ["/favicon.ico", "favicon-32.png"],
    ["/favicon-192.png", "favicon-192.png"],
  ] as const) {
    app.get(route, async (c) => {
      const png = await readFile(path.join(apiRoot, "public/brand", file)).catch(() => undefined);
      if (!png) return c.notFound();
      return c.body(new Uint8Array(png), 200, {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      });
    });
  }

  app.get("/licenses", async (c) => {
    const notices = await readNotices();
    if (notices === undefined) return c.notFound();
    return c.body(notices, 200, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    });
  });

  // The documentation: guides and the API reference, a static site built by apps/docs (Zudoku).
  registerDocsRoutes(app, deps);

  // HAL Explorer (toedter/hal-explorer, MIT), vendored at build time by scripts/fetch-explorer.mjs.
  app.get("/explorer", (c) =>
    // HAL Explorer reads the fragment as is: an encoded URI is taken for a relative path.
    c.redirect("/explorer/#uri=" + deps.linker.url("/v2"), 302),
  );
  app.get("/explorer/", async (c) => {
    try {
      const html = await readFile(path.join(apiRoot, "public/explorer/vendor/index.html"), "utf8");
      return c.html(
        withAnalytics(html, deps.env)
          // The release build carries no copyright notice; the page names its author and licence.
          .replace(
            /<!doctype html>/i,
            "$&\n<!-- HAL Explorer, https://github.com/toedter/hal-explorer | MIT License | Copyright (c) Kai Toedter | Licence text and other third-party notices: /licenses -->",
          )
          .replace(/<base href="[^"]*">/, '<base href="/explorer/">')
          // The bundle defers its stylesheet with an inline onload handler, which the CSP blocks.
          .replace(/ media="print" onload="this\.media='all'"/, ""),
      );
    } catch {
      return c.html(
        `<!doctype html><title>HAL Explorer not installed</title><p>Run <code>pnpm explorer:fetch</code> to download the HAL Explorer bundle, or browse the API at <a href="${deps.linker.url("/v2")}">/v2</a>.</p>`,
        404,
      );
    }
  });
  // HAL Explorer fetches its themes from bootswatch.com. Point the picker at this origin instead:
  // every theme resolves to the Bootstrap build already in the bundle, and nothing leaves the host.
  app.get("/explorer/themes/*", (c) =>
    c.body(
      "/* Themes are served locally: this deployment loads no third-party resources. */",
      200,
      {
        "content-type": "text/css; charset=utf-8",
      },
    ),
  );
  app.get("/explorer/:file{main-[A-Z0-9]+\\.js}", async (c) => {
    const file = path.join(apiRoot, "public/explorer/vendor", c.req.param("file"));
    const js = await readFile(file, "utf8").catch(() => undefined);
    if (js === undefined) return c.notFound();
    return c.body(js.replaceAll("https://bootswatch.com/5/", "/explorer/themes/"), 200, {
      "content-type": "text/javascript; charset=utf-8",
    });
  });
  app.use(
    "/explorer/*",
    serveStatic({
      root: path.relative(process.cwd(), path.join(apiRoot, "public/explorer/vendor")) || ".",
      rewriteRequestPath: (p) => p.replace(/^\/explorer/, ""),
    }),
  );

  // The visual explorer: a HAL client of this API, with a Mapbox map when a token is configured.
  registerAtlasRoutes(app, deps);

  return app;
}
