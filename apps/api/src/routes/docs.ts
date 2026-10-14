import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { compress } from "hono/compress";
import type { AppEnv } from "../app-env.js";
import { analyticsCsp, withAnalytics } from "../http/analytics.js";
import type { AppDeps } from "../http/context.js";

/**
 * The documentation at /docs (ADR 0012): the static site that apps/docs builds with Zudoku, with
 * the guides and the API reference. It is served from apps/docs/dist/docs locally and in CI, and
 * from public/docs in the image.
 *
 * - Zudoku prerenders every page with three inline scripts (theme, router hydration data and
 *   query cache), different on each page. Rather than allow inline script, each page's CSP lists
 *   the SHA-256 of its own inline scripts.
 * - Every page preconnects to cdn.zudoku.dev, which no CSP directive covers, so that tag is removed.
 * - The build writes a placeholder origin where a page needs this API's absolute URL (the
 *   playground's server, the MCP endpoint, links out of /docs); it is replaced with
 *   PUBLIC_BASE_URL here, so one build serves any deployment.
 */
const BUILD_ORIGIN = "https://api-origin.cdop.invalid";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../..");
const docsRoot =
  [path.resolve(apiRoot, "../docs/dist/docs"), path.join(apiRoot, "public/docs")].find((dir) =>
    existsSync(path.join(dir, "index.html")),
  ) ?? path.join(apiRoot, "public/docs");

// Pagefind runs its search index in WebAssembly, which needs 'wasm-unsafe-eval' (not 'unsafe-eval').
const CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

type Page = { html: string; scriptHashes: string[] };

// A page path maps to its prerendered file: /docs/ to index.html, /docs/api to api.html.
function pageFile(requestPath: string): string | undefined {
  let rel: string;
  try {
    rel = decodeURIComponent(requestPath.replace(/^\/docs\/?/, "")).replace(/\/$/, "");
  } catch {
    return undefined; // a malformed escape is not a page
  }
  if (path.extname(rel) && path.extname(rel) !== ".html") return undefined;
  const file = path.resolve(
    docsRoot,
    rel === "" ? "index.html" : rel.replace(/(\.html)?$/, ".html"),
  );
  return file.startsWith(docsRoot + path.sep) ? file : undefined;
}

export function registerDocsRoutes(app: OpenAPIHono<AppEnv>, deps: AppDeps): void {
  const csp = analyticsCsp(CSP, deps.env);
  const origin = deps.linker.baseUrl.replace(/\/$/, "");
  const pages = new Map<string, Promise<Page | undefined>>();
  const scripts = new Map<string, Promise<string | undefined>>();

  function loadPage(file: string): Promise<Page | undefined> {
    let page = pages.get(file);
    if (!page) {
      page = readFile(file, "utf8")
        .then((raw) => {
          const html = withAnalytics(
            raw
              .replace(/<link rel="preconnect" href="https:\/\/cdn\.zudoku\.dev\/">\n?/g, "")
              .replaceAll(BUILD_ORIGIN, origin),
            deps.env,
          );
          const scriptHashes = [
            ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
          ]
            .map(
              ([, body]) =>
                `'sha256-${createHash("sha256")
                  .update(body ?? "")
                  .digest("base64")}'`,
            )
            .filter((hash, i, all) => all.indexOf(hash) === i);
          return { html, scriptHashes };
        })
        .catch(() => undefined);
      pages.set(file, page);
    }
    return page;
  }

  app.use("/docs/*", compress());
  app.get("/docs", (c) => c.redirect("/docs/", 302));
  app.get("/docs/*", async (c, next) => {
    const file = pageFile(c.req.path);
    const page = file ? await loadPage(file) : undefined;
    if (!page) return next();
    return c.html(page.html, 200, {
      "content-security-policy": csp.replace(
        "script-src 'self'",
        ["script-src 'self'", ...page.scriptHashes].join(" "),
      ),
      "referrer-policy": "no-referrer",
      "cache-control": "no-cache",
    });
  });
  // The one script chunk that embeds the OpenAPI document carries the placeholder origin too.
  app.get("/docs/assets/:file{api-openapi\\.json-[\\w-]+\\.js}", async (c) => {
    const file = path.join(docsRoot, "assets", c.req.param("file"));
    let js = scripts.get(file);
    if (!js) {
      js = readFile(file, "utf8")
        .then((raw) => raw.replaceAll(BUILD_ORIGIN, origin))
        .catch(() => undefined);
      scripts.set(file, js);
    }
    const body = await js;
    if (body === undefined) return c.notFound();
    return c.body(body, 200, {
      "content-type": "text/javascript; charset=utf-8",
      "content-security-policy": csp,
      "cache-control": "public, max-age=31536000, immutable",
    });
  });
  app.use(
    "/docs/*",
    serveStatic({
      root: path.relative(process.cwd(), docsRoot) || ".",
      rewriteRequestPath: (p) => p.replace(/^\/docs/, ""),
      onFound: (found, c) => {
        c.header("content-security-policy", csp);
        // Hashed build assets never change; everything else is revalidated.
        c.header(
          "cache-control",
          found.includes(`${path.sep}assets${path.sep}`)
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        );
      },
    }),
  );
}
