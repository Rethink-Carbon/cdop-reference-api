import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../app-env.js";
import { analyticsCsp, withAnalytics } from "../http/analytics.js";
import type { AppDeps } from "../http/context.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const atlasRoot = path.resolve(here, "../../public/atlas");

/**
 * Mapbox GL JS is under the Mapbox Web SDK licence, not MIT, so the image does not redistribute it:
 * the page loads it from Mapbox's CDN at an exact version, and Subresource Integrity makes the
 * browser refuse any other bytes (ADR 0010). Bumping the version means recomputing both hashes:
 * curl -s <href> | openssl dgst -sha384 -binary | openssl base64 -A
 */
export const MAPBOX_GL = {
  version: "3.32.0",
  script: {
    href: "https://api.mapbox.com/mapbox-gl-js/v3.32.0/mapbox-gl.js",
    integrity: "sha384-acS2vHk2htvkMzGXnu5MTQNaFwFexCnoKasF90zPaHihi5xhWMsTcvVvTAJHXuHH",
  },
  stylesheet: {
    href: "https://api.mapbox.com/mapbox-gl-js/v3.32.0/mapbox-gl.css",
    integrity: "sha384-WR3U1V0+1MbG/yqoN2/UUbE92aMWypbO0XZyEPFDxl2zZgg3ppqJGUq3gqgaEZbX",
  },
} as const;

/** Only a public token may reach a browser; a secret (sk.) token configured by mistake is ignored. */
export function publicMapboxToken(value: string | undefined): string | undefined {
  return value && /^pk\.[A-Za-z0-9._-]+$/.test(value) ? value : undefined;
}

/**
 * The page's Content-Security-Policy. Without a token it is the same self-only policy as /docs and
 * /explorer. With one, it adds exactly what Mapbox GL JS needs: its script and stylesheet from
 * api.mapbox.com, styles, sprites, glyphs and tiles from api.mapbox.com and *.tiles.mapbox.com, map
 * load events to events.mapbox.com, and blob: workers (the CDN build creates its workers that way).
 */
export function atlasCsp(withMap: boolean): string {
  const mapbox = "https://api.mapbox.com";
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", withMap ? ["'self'", mapbox] : ["'self'"]],
    ["style-src", withMap ? ["'self'", "'unsafe-inline'", mapbox] : ["'self'", "'unsafe-inline'"]],
    ["img-src", withMap ? ["'self'", "data:", "blob:", mapbox] : ["'self'", "data:"]],
    ["font-src", ["'self'", "data:"]],
    [
      "connect-src",
      withMap
        ? ["'self'", mapbox, "https://*.tiles.mapbox.com", "https://events.mapbox.com"]
        : ["'self'"],
    ],
    ...(withMap
      ? ([
          ["worker-src", ["blob:"]],
          ["child-src", ["blob:"]],
        ] satisfies Array<[string, string[]]>)
      : []),
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

export function registerAtlasRoutes(app: OpenAPIHono<AppEnv>, deps: AppDeps): void {
  const token = publicMapboxToken(deps.env.MAPBOX_API_KEY);
  if (deps.env.MAPBOX_API_KEY && !token)
    deps.log.warn(
      "MAPBOX_API_KEY is not a public Mapbox token (pk.…); /atlas will not use it, and a secret token must never reach a browser",
    );
  const csp = analyticsCsp(atlasCsp(Boolean(token)), deps.env);

  const headers: MiddlewareHandler = async (c, next) => {
    await next();
    c.header("content-security-policy", csp);
    // Mapbox checks a token's URL restrictions against the Referer, so cross-origin requests carry
    // this origin (and nothing more). Same-origin requests keep the full URL.
    c.header("referrer-policy", token ? "strict-origin-when-cross-origin" : "no-referrer");
  };
  app.use("/atlas/*", headers);

  const mapTags = token
    ? [
        `<meta name="cdop-mapbox-token" content="${token}" />`,
        `<link rel="stylesheet" href="${MAPBOX_GL.stylesheet.href}" integrity="${MAPBOX_GL.stylesheet.integrity}" crossorigin="anonymous" />`,
        `<script src="${MAPBOX_GL.script.href}" integrity="${MAPBOX_GL.script.integrity}" crossorigin="anonymous"></script>`,
      ].join("\n    ")
    : "";

  app.get("/atlas", (c) => c.redirect("/atlas/", 302));
  app.get("/atlas/", async (c) => {
    const html = await readFile(path.join(atlasRoot, "index.html"), "utf8");
    return c.html(withAnalytics(html.replace("<!-- mapbox -->", mapTags), deps.env), 200, {
      "cache-control": "no-cache",
    });
  });
  app.get("/atlas/index.html", (c) => c.redirect("/atlas/", 302));
  app.use(
    "/atlas/*",
    serveStatic({
      root: path.relative(process.cwd(), atlasRoot) || ".",
      rewriteRequestPath: (p) => p.replace(/^\/atlas/, ""),
      onFound: (_path, c) => {
        c.header("cache-control", "no-cache");
      },
    }),
  );
}
