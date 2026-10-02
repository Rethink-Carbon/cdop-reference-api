// A small HAL client. The atlas starts at /v2 and follows links; it uses no endpoint a third-party
// client could not use.

const cache = new Map();
let trace;

export class ApiError extends Error {
  constructor(status, problem, href) {
    super(
      problem?.title
        ? `${problem.title}${problem.detail ? `: ${problem.detail}` : ""}`
        : `HTTP ${status}`,
    );
    this.status = status;
    this.href = href;
  }
}

/**
 * HAL links are absolute URLs built from PUBLIC_BASE_URL. The page is served by the API itself, so
 * every request goes to this page's origin: a fork run on another port still works, and the
 * page's connect-src 'self' policy holds.
 */
export function local(href) {
  const u = new URL(href, location.origin);
  return location.origin + u.pathname + u.search;
}

/** Start recording the requests a view makes, for its "built from" footer. */
export function startTrace() {
  trace = new Set();
  return trace;
}

export function get(href, into = trace) {
  const url = local(href);
  into?.add(url);
  if (!cache.has(url)) {
    const request = fetch(url, {
      headers: { accept: "application/hal+json, application/json" },
    }).then(async (res) => {
      const body = await res.json().catch(() => undefined);
      if (!res.ok) throw new ApiError(res.status, body, url);
      return body;
    });
    request.catch(() => cache.delete(url));
    cache.set(url, request);
  }
  return cache.get(url);
}

/** A GET whose headers matter (X-CDOP-Conformance on CDOP documents). Not cached. */
export async function getHeaders(href, into = trace) {
  const url = local(href);
  into?.add(url);
  const res = await fetch(url, { headers: { accept: "application/json" } });
  return { status: res.status, headers: res.headers };
}

/** The href of a link relation; for an array of named links, the one called `name`. */
export function linkHref(resource, rel, name) {
  const link = resource?._links?.[rel];
  if (!link) return undefined;
  if (Array.isArray(link)) return (name ? link.find((l) => l.name === name) : link[0])?.href;
  return link.href;
}

export function linkList(resource, rel) {
  const link = resource?._links?.[rel];
  return link ? (Array.isArray(link) ? link : [link]) : [];
}

export function embedded(resource, key) {
  return resource?._embedded?.[key] ?? [];
}

export function withQuery(href, params) {
  const u = new URL(href, location.origin);
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  return u.href;
}

/** Every item of a paged collection, following `next` to the end. */
export async function collect(href, key, into = trace) {
  const items = [];
  let next = href;
  let total;
  while (next) {
    const page = await get(next, into);
    total ??= page.total;
    items.push(...embedded(page, key));
    next = linkHref(page, "next");
  }
  return { items, total: total ?? items.length };
}

/** HAL Explorer reads an unencoded absolute URI from its fragment. */
export function explorerHref(href) {
  return `/explorer/#uri=${local(href)}`;
}
