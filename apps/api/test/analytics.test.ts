import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";
import { analyticsTags, analyticsCsp } from "../src/http/analytics.js";

const source = readFileSync(new URL("../public/analytics.js", import.meta.url), "utf8");
function browser(overrides: Record<string, unknown> = {}) {
  const events: Record<string, () => void> = {};
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const location = {
    hostname: "cdop.example",
    pathname: "/atlas/",
    hash: "#/projects?q=secret",
    href: "https://cdop.example/atlas/#/projects?q=secret",
    origin: "https://cdop.example",
  };
  const context = {
    location,
    navigator: { language: "en-GB", doNotTrack: "0" },
    screen: { width: 1000, height: 800 },
    localStorage: { getItem: () => null },
    document: {
      currentScript: {
        dataset: {
          hostname: "cdop.example",
          siteId: "5",
          endpoint: "https://analytics.example/api/track",
        },
      },
      referrer: "https://referrer.example/private?token=secret",
      addEventListener: () => {},
    },
    window: {
      addEventListener: (event: string, fn: () => void) => {
        events[event] = fn;
      },
    } as {
      addEventListener: (event: string, fn: () => void) => void;
      cdopAnalytics?: { event: (name: string, properties?: unknown) => void };
    },
    fetch: (url: string, options: { body: string }) => {
      requests.push({ url, body: JSON.parse(options.body) as Record<string, unknown> });
      return Promise.resolve();
    },
    URL,
    ...overrides,
  };
  vm.runInNewContext(source, context);
  return { context, requests, events, location };
}

describe("optional Rybbit analytics", () => {
  const base = { DATABASE_URL: "postgres://unused", PUBLIC_BASE_URL: "https://cdop.example" };
  it("is disabled by default and only extends connect-src when fully configured", () => {
    const csp = "script-src 'self'; connect-src 'self'; frame-ancestors 'none'";
    expect(analyticsTags(loadEnv(base))).toBe("");
    expect(
      analyticsCsp(csp, loadEnv({ ...base, RYBBIT_ORIGIN: "https://analytics.example" })),
    ).toBe(csp);
    const env = loadEnv({
      ...base,
      RYBBIT_ORIGIN: "https://analytics.example",
      RYBBIT_SITE_ID: "5",
    });
    expect(analyticsCsp(csp, env)).toBe(
      "script-src 'self'; connect-src 'self' https://analytics.example; frame-ancestors 'none'",
    );
    expect(analyticsTags(env)).toContain('data-site-id="5"');
    expect(analyticsTags(env)).toContain('src="/analytics.js"');
  });
  it("rejects insecure, credential-bearing, path-bearing and injectable configuration", () => {
    for (const RYBBIT_ORIGIN of [
      "http://example.com",
      "https://user:pass@example.com",
      "https://example.com/path",
      'https://example.com" onload="x',
      "https://example.com; script-src *",
    ]) {
      expect(() => loadEnv({ ...base, RYBBIT_ORIGIN })).toThrow();
    }
    expect(() => loadEnv({ ...base, RYBBIT_SITE_ID: '5"' })).toThrow();
  });
  it("removes search text, resource IDs, and referrer details, without double-counting filters", () => {
    const { context, requests, events, location } = browser();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toMatchObject({
      pathname: "/atlas/projects",
      querystring: "",
      referrer: "https://referrer.example",
      type: "pageview",
    });
    location.hash = "#/projects?q=another-secret";
    events.hashchange?.();
    expect(requests).toHaveLength(1);
    location.hash = "#/projects/secret-id/units?q=private";
    events.hashchange?.();
    expect(requests[1]?.body.pathname).toBe("/atlas/projects/detail/units");
    context.window.cdopAnalytics?.event("atlas_filters", { search: true });
    expect(requests[2]?.body).toMatchObject({
      event_name: "atlas_filters",
      type: "custom_event",
      properties: '{"search":true}',
    });
    expect(JSON.stringify(requests)).not.toMatch(/secret|private|token/);
  });
  it("respects privacy signals, opt-out, unavailable storage and the configured hostname", () => {
    for (const override of [
      { navigator: { doNotTrack: "1" } },
      { navigator: { globalPrivacyControl: true } },
      { localStorage: { getItem: () => "true" } },
      {
        localStorage: {
          getItem: () => {
            throw new Error("blocked");
          },
        },
      },
      { location: { hostname: "localhost" } },
    ])
      expect(browser(override).requests).toHaveLength(0);
  });
  it("does not send HAL Explorer fragments, including embedded credentials", () => {
    const { requests } = browser({
      location: {
        hostname: "cdop.example",
        pathname: "/explorer/",
        hash: "#uri=https://private.example/?api_key=secret",
      },
    });
    expect(requests[0]?.body.pathname).toBe("/explorer/");
    expect(JSON.stringify(requests)).not.toContain("secret");
  });
});
