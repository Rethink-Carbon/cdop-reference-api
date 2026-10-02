import type { Context } from "hono";
import { PROBLEM_JSON } from "./hal.js";

export type ProblemSlug =
  | "not-found"
  | "validation-failed"
  | "illegal-transition"
  | "role-not-permitted"
  | "unauthenticated"
  | "precondition-failed"
  | "idempotency-key-reused"
  | "schema-conformance"
  | "unknown-pod"
  | "cursor-invalid"
  | "rate-limited"
  | "conflict"
  | "internal";

const TITLES: Record<ProblemSlug, [number, string]> = {
  "not-found": [404, "Resource not found"],
  "validation-failed": [422, "Request validation failed"],
  "illegal-transition": [409, "Transition not allowed in the current state"],
  "role-not-permitted": [403, "Role not permitted to perform this action"],
  unauthenticated: [401, "Authentication required"],
  "precondition-failed": [412, "Precondition failed"],
  "idempotency-key-reused": [422, "Idempotency-Key reused with a different request"],
  "schema-conformance": [422, "Payload does not conform to the CDOP schema"],
  "unknown-pod": [404, "Unknown CDOP schema document"],
  "cursor-invalid": [400, "Invalid pagination cursor"],
  "rate-limited": [429, "Rate limit exceeded"],
  conflict: [409, "Conflict"],
  internal: [500, "Internal error"],
};

export class ProblemError extends Error {
  readonly slug: ProblemSlug;
  readonly status: number;
  readonly detail: string | undefined;
  readonly extra: Record<string, unknown>;
  readonly headers: Record<string, string>;

  constructor(
    slug: ProblemSlug,
    detail?: string,
    extra: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) {
    super(detail ?? TITLES[slug][1]);
    this.slug = slug;
    this.status = TITLES[slug][0];
    this.detail = detail;
    this.extra = extra;
    this.headers = headers;
  }
}

export function problemBody(
  baseUrl: string,
  err: ProblemError,
  instance: string,
): Record<string, unknown> {
  const [status, title] = TITLES[err.slug];
  return {
    type: `${baseUrl}/problems/${err.slug}`,
    title,
    status,
    ...(err.detail ? { detail: err.detail } : {}),
    instance,
    ...err.extra,
  };
}

export function problemResponse(c: Context, baseUrl: string, err: ProblemError): Response {
  const body = problemBody(baseUrl, err, new URL(c.req.url).pathname);
  const headers: Record<string, string> = {
    "content-type": PROBLEM_JSON,
    "cache-control": "no-store",
    ...err.headers,
  };
  return new Response(JSON.stringify(body), { status: err.status, headers });
}

export function notFound(what: string, id?: string): ProblemError {
  return new ProblemError(
    "not-found",
    id ? `${what} ${id} was not found` : `${what} was not found`,
  );
}

export const PROBLEM_CATALOGUE: Array<{ slug: ProblemSlug; status: number; title: string }> = (
  Object.entries(TITLES) as Array<[ProblemSlug, [number, string]]>
).map(([slug, [status, title]]) => ({ slug, status, title }));
