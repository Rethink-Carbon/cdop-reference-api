import type { Context } from "hono";

export function strongEtag(version: number | string): string {
  return `"v${version}"`;
}

export function weakEtag(parts: Array<string | number | null | undefined>): string {
  return `W/"${parts.map((p) => (p === null || p === undefined ? "" : String(p))).join(":")}"`;
}

/**
 * Returns a 304 response when If-None-Match matches, else undefined. Caches merge a 304's
 * headers into the stored response, so pass any representation header the 200 sets that
 * differs from the app-wide default (X-CDOP-Schema-Version on a Round 2 pod, for one);
 * otherwise the middleware's default overwrites the cached value.
 */
export function notModified(
  c: Context,
  etag: string,
  headers: Record<string, string> = {},
): Response | undefined {
  const inm = c.req.header("if-none-match");
  if (!inm) return undefined;
  const candidates = inm.split(",").map((s) => s.trim());
  if (candidates.includes(etag) || candidates.includes("*")) {
    return new Response(null, { status: 304, headers: { ...headers, etag } });
  }
  return undefined;
}

export function ifMatchSatisfied(c: Context, etag: string): boolean {
  const im = c.req.header("if-match");
  if (!im) return true;
  const candidates = im.split(",").map((s) => s.trim());
  return candidates.includes(etag) || candidates.includes("*");
}
