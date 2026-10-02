import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
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
import { openApiConfig } from "./http/openapi.js";
import { newId } from "./domain/ids.js";
import { createMcpHttpHandler } from "./mcp/server.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const gzipAsync = promisify(gzip);

// Scalar's browser bundle (MIT): from the pinned dev dependency locally and in CI, and from
// public/scalar/ in the image, where the Dockerfile copies it so the package's own runtime
// dependencies stay out of the image.
function scalarBundlePath(): string {
  try {
    const entry = createRequire(import.meta.url).resolve("@scalar/api-reference");
    return path.join(path.dirname(entry), "browser/standalone.js");
  } catch {
    return path.join(apiRoot, "public/scalar/standalone.js");
  }
}

// Scalar credits itself, with a link to scalar.com, in the sidebar footer ("Powered by Scalar", with
// tracking parameters) and in the Test Request panel's empty response ("Powered By Scalar.com");
// here both credit Rethink Carbon. The patterns match where the pinned build renders them (the
// footer twice: its component default and the reference layout's translated label), so every
// locale changes, and the docs test fails if a Scalar upgrade changes any of them.
const RETHINK_URL = "`https://rethinkcarbon.co.uk/`";
const RETHINK_CREDIT = "`Powered by Rethink Carbon`";
const SCALAR_CREDITS: Array<[RegExp, string]> = [
  [
    /href:[^,]+,(rel:`noopener`,target:`_blank`\},)(?:` Powered by Scalar `|\w+\(\w+\(\w+\)\.translate\(`footer\.poweredByScalar`\)\))/g,
    `href:${RETHINK_URL},$1${RETHINK_CREDIT}`,
  ],
  [
    /(\{class:`gitbook-show scalar-version-number`,)href:`https:\/\/www\.scalar\.com`/g,
    `$1href:${RETHINK_URL}`,
  ],
  [/\w+\(\w+\(\w+\)\(`apiClient\.responseEmpty\.poweredByScalarcom`\)\)/g, RETHINK_CREDIT],
];

// Read once, without its source map reference and with the credits swapped, and gzipped once:
// 4.4 MB is about 1.3 MB on the wire.
type ScalarBundle = { raw: Uint8Array<ArrayBuffer>; gzipped: Uint8Array<ArrayBuffer> };
let scalarBundle: Promise<ScalarBundle | undefined> | undefined;
function loadScalarBundle(): Promise<ScalarBundle | undefined> {
  scalarBundle ??= readFile(scalarBundlePath(), "utf8")
    .then(async (js) => {
      const raw = Buffer.from(
        SCALAR_CREDITS.reduce(
          (out, [pattern, replacement]) => out.replace(pattern, replacement),
          js.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, ""),
        ),
      );
      // zlib's Buffer may sit on a shared pool; copy it into its own ArrayBuffer for the response.
      return { raw, gzipped: new Uint8Array(await gzipAsync(raw)) };
    })
    .catch(() => undefined);
  return scalarBundle;
}

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const selfOnly: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("content-security-policy", CSP);
  c.header("referrer-policy", "no-referrer");
};

const DOCS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CDOP reference API</title>
    <link rel="icon" href="/favicon.ico" sizes="32x32" type="image/png" />
    <link rel="icon" href="/favicon-192.png" sizes="192x192" type="image/png" />
    <link rel="apple-touch-icon" href="/favicon-192.png" />
  </head>
  <body>
    <div id="app"></div>
    <script src="/docs/scalar.js"></script>
    <script src="/docs/init.js"></script>
  </body>
</html>`;

// Scalar defaults to a font CDN, telemetry, a hosted AI agent and a button that opens the spec in
// its hosted client; all four are off so the page talks to this origin only. The in-page "Test
// Request" client stays. The MCP entry advertises this API's own MCP endpoint. The page is always
// light: the kepler theme, with the dark-mode toggle hidden.
const DOCS_INIT = `Scalar.createApiReference("#app", {
  url: "/v2/openapi.json",
  theme: "kepler",
  forceDarkModeState: "light",
  hideDarkModeToggle: true,
  withDefaultFonts: false,
  telemetry: false,
  agent: { disabled: true },
  hideClientButton: true,
  showDeveloperTools: "never",
  documentDownloadType: "json",
  mcp: { name: "CDOP reference API", url: new URL("/mcp", location.origin).href },
});`;

export function createApp(deps: AppDeps): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();

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
  // The browser may load and call nothing but this origin on the two bundled UIs.
  app.use("/docs/*", selfOnly);
  app.use("/explorer/*", selfOnly);

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

  // Scalar API reference (MIT) from the pinned bundle: no CDN, no telemetry, no hosted services.
  app.get("/docs", (c) => c.redirect("/docs/", 302));
  app.get("/docs/", (c) => c.html(DOCS_HTML));
  app.get("/docs/init.js", (c) =>
    c.body(DOCS_INIT, 200, { "content-type": "text/javascript; charset=utf-8" }),
  );
  app.get("/docs/scalar.js", async (c) => {
    const bundle = await loadScalarBundle();
    if (!bundle) return c.notFound();
    const gzipped = /\bgzip\b/.test(c.req.header("accept-encoding") ?? "");
    return c.body(gzipped ? bundle.gzipped : bundle.raw, 200, {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
      vary: "accept-encoding",
      ...(gzipped ? { "content-encoding": "gzip" } : {}),
    });
  });

  // HAL Explorer (toedter/hal-explorer, MIT), vendored at build time by scripts/fetch-explorer.mjs.
  app.get("/explorer", (c) =>
    // HAL Explorer reads the fragment as is: an encoded URI is taken for a relative path.
    c.redirect("/explorer/#uri=" + deps.linker.url("/v2"), 302),
  );
  app.get("/explorer/", async (c) => {
    try {
      const html = await readFile(path.join(apiRoot, "public/explorer/vendor/index.html"), "utf8");
      return c.html(
        html
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
