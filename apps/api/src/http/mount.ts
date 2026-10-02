/**
 * Registers a route for OpenAPI documentation and mounts a plain Hono handler for it. Request
 * params/query are validated with the route's zod schemas (422 problem+json on failure). Keeping
 * handlers as plain `Response` producers avoids fighting typed-response generics for HAL, 304s,
 * redirects and binary bodies.
 */
import type { Context } from "hono";
import type { OpenAPIHono, RouteConfig } from "@hono/zod-openapi";
import type { z } from "@hono/zod-openapi";
import type { AppEnv } from "../app-env.js";
import { ProblemError } from "./problems.js";

type ParamsOf<R> = R extends { request: { params: infer P extends z.ZodTypeAny } }
  ? z.infer<P>
  : Record<string, never>;
type QueryOf<R> = R extends { request: { query: infer Q extends z.ZodTypeAny } }
  ? z.infer<Q>
  : Record<string, never>;

export interface RouteInput<R> {
  params: ParamsOf<R>;
  query: QueryOf<R>;
}

function parseOr422(schema: z.ZodTypeAny, value: unknown, where: string): unknown {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const errors = result.error.issues.map((i) => ({
    pointer: `/${where}/${i.path.join("/")}`,
    message: i.message,
  }));
  throw new ProblemError("validation-failed", `Invalid ${where}`, { errors });
}

export function mount<R extends RouteConfig>(
  app: OpenAPIHono<AppEnv>,
  route: R,
  handler: (c: Context<AppEnv>, input: RouteInput<R>) => Response | Promise<Response>,
): void {
  app.openAPIRegistry.registerPath(route);
  const method = route.method.toUpperCase();
  const path = route.path.replace(/\{(\w+)\}/g, ":$1");
  app.on(method, path, async (c) => {
    const request = route.request as { params?: z.ZodTypeAny; query?: z.ZodTypeAny } | undefined;
    const params = request?.params ? parseOr422(request.params, c.req.param(), "params") : {};
    const query = request?.query ? parseOr422(request.query, c.req.query(), "query") : {};
    return handler(c, { params, query } as RouteInput<R>);
  });
}
