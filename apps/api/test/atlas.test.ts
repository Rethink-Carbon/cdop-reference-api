/**
 * /atlas, the visual explorer. Its routes never touch the database, so these tests run everywhere:
 * the pool below is created but never connected.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createDb, createPool } from "../src/db/kysely.js";
import { loadEnv } from "../src/env.js";
import { createLinker } from "../src/http/context.js";
import { MAPBOX_GL, atlasCsp, publicMapboxToken } from "../src/routes/atlas.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const atlasDir = path.resolve(here, "../public/atlas");
const pools: Array<ReturnType<typeof createPool>> = [];

function appWith(MAPBOX_API_KEY?: string, analytics: Record<string, string> = {}) {
  const env = loadEnv({
    DATABASE_URL: "postgres://unused@127.0.0.1:1/unused",
    PUBLIC_BASE_URL: "http://localhost:3000",
    LOG_LEVEL: "silent",
    ...(MAPBOX_API_KEY ? { MAPBOX_API_KEY } : {}),
    ...analytics,
  });
  const pool = createPool(env.DATABASE_URL, 1);
  pools.push(pool);
  return createApp({
    env,
    db: createDb(pool),
    log: pino({ level: "silent" }),
    linker: createLinker(env),
    schemaVersion: "test",
    apiVersion: "0.0.0-test",
    startedAt: new Date(),
  });
}

afterAll(async () => {
  await Promise.all(pools.map((p) => p.end()));
});

const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `)) ?? "";

describe("atlas", () => {
  it("without a Mapbox token, is served from this origin only, like /docs", async () => {
    const app = appWith();
    expect((await app.request("/atlas")).headers.get("location")).toBe("/atlas/");
    const res = await app.request("/atlas/");
    expect(res.status).toBe(200);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toBe(atlasCsp(false));
    expect(directive(csp, "script-src")).toBe("script-src 'self'");
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    expect(csp).not.toContain("mapbox");
    const html = await res.text();
    expect(html.match(/(?:src|href)="https?:\/\/[^"]+"/g) ?? []).toEqual([]);
    expect(html).not.toMatch(/ on[a-z]+="/);
    expect(html).not.toContain("cdop-mapbox-token");
    expect(html).toContain('src="/atlas/atlas.js"');
  });

  it("with a public token, adds Mapbox's origins on this page only, and loads Mapbox GL JS pinned by SRI", async () => {
    const app = appWith("pk.test-token");
    const res = await app.request("/atlas/");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
    expect(directive(csp, "script-src")).toBe("script-src 'self' https://api.mapbox.com");
    expect(directive(csp, "connect-src")).toBe(
      "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com",
    );
    // Every origin the policy names is Mapbox's.
    const origins = csp.match(/https:\/\/[^\s;]+/g) ?? [];
    expect(origins.every((o) => /^https:\/\/([a-z*]+\.)*mapbox\.com$/.test(o))).toBe(true);
    // Mapbox checks URL-restricted tokens against the Referer, so the page sends its origin.
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");

    const html = await res.text();
    expect(html).toContain('<meta name="cdop-mapbox-token" content="pk.test-token" />');
    const external = html.match(/<(?:script|link)[^>]+(?:src|href)="https:\/\/[^"]+"[^>]*>/g) ?? [];
    expect(external).toHaveLength(2);
    for (const tag of external) {
      expect(tag).toMatch(
        /(?:src|href)="https:\/\/api\.mapbox\.com\/mapbox-gl-js\/v\d+\.\d+\.\d+\//,
      );
      expect(tag).toMatch(/integrity="sha384-[A-Za-z0-9+/]{64}"/);
      expect(tag).toContain('crossorigin="anonymous"');
    }
    expect(html).toContain(MAPBOX_GL.script.integrity);
    expect(MAPBOX_GL.script.href).toContain(`/v${MAPBOX_GL.version}/`);
    expect(MAPBOX_GL.stylesheet.href).toContain(`/v${MAPBOX_GL.version}/`);

    // The exception is scoped: the other bundled UIs keep the self-only policy.
    for (const page of ["/docs/", "/explorer/"]) {
      const other = (await app.request(page)).headers.get("content-security-policy") ?? "";
      expect(other, page).not.toContain("mapbox");
    }
  });

  it("enables optional analytics on all three UIs without loading remote scripts", async () => {
    const app = appWith(undefined, {
      RYBBIT_ORIGIN: "https://analytics.example",
      RYBBIT_SITE_ID: "5",
    });
    for (const page of ["/atlas/", "/docs/", "/explorer/"]) {
      const res = await app.request(page);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('src="/analytics.js"');
      expect(html).toContain('data-endpoint="https://analytics.example/api/track"');
      const csp = res.headers.get("content-security-policy") ?? "";
      expect(directive(csp, "script-src")).toBe("script-src 'self'");
      expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://analytics.example");
    }
    const asset = await app.request("/analytics.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("javascript");
    const disabled = await appWith().request("/atlas/");
    expect(await disabled.text()).not.toContain('src="/analytics.js"');
  });

  it("never puts a secret Mapbox token in the page", async () => {
    expect(publicMapboxToken("sk.eyJ1IjoieCJ9.secret")).toBeUndefined();
    expect(publicMapboxToken('pk.abc" onload="x')).toBeUndefined();
    expect(publicMapboxToken("pk.eyJ1IjoieCJ9.abc-_")).toBe("pk.eyJ1IjoieCJ9.abc-_");
    const res = await appWith("sk.eyJ1IjoieCJ9.secret").request("/atlas/");
    const html = await res.text();
    expect(html).not.toContain("sk.");
    expect(html).not.toContain("api.mapbox.com");
    expect(res.headers.get("content-security-policy")).toBe(atlasCsp(false));
  });

  it("serves its scripts and styles itself, and they name no other origin", async () => {
    const app = appWith();
    const files = readdirSync(atlasDir).filter((f) => /\.(js|css)$/.test(f));
    expect(files).toEqual(
      expect.arrayContaining([
        "atlas.js",
        "atlas.css",
        "hal.js",
        "map.js",
        "charts.js",
        "countries.js",
      ]),
    );
    for (const file of files) {
      const res = await app.request(`/atlas/${file}`);
      expect(res.status, file).toBe(200);
      expect(res.headers.get("content-type"), file).toMatch(
        file.endsWith(".css") ? /^text\/css/ : /javascript/,
      );
      expect(res.headers.get("content-security-policy"), file).toBeTruthy();
      // The SVG namespace is an identifier, not a request.
      const text = (await res.text()).replaceAll("http://www.w3.org/2000/svg", "");
      expect(text.match(/https?:\/\/[^\s"'`)]+/g) ?? [], file).toEqual([]);
      expect(text, file).toBe(
        readFileSync(path.join(atlasDir, file), "utf8").replaceAll(
          "http://www.w3.org/2000/svg",
          "",
        ),
      );
    }
  });
});
