import type { Context } from "hono";
import { HAL_JSON } from "./hal.js";

export function halJson(
  c: Context,
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return c.body(JSON.stringify(body), status as 200, {
    "content-type": `${HAL_JSON}; charset=utf-8`,
    ...headers,
  });
}

export function json(
  c: Context,
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return c.body(JSON.stringify(body), status as 200, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
}

/** Parse a comma-separated multi-value query parameter. */
export function csv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}
