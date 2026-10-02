# ADR 0002: Hono over Fastify

Status: accepted. Date: 2026-09-20.

## Context

The service must serve HAL documents with dynamic keys and CDOP documents validated by Ajv 2020-12. Those schemas carry nine `x-cdop-*` annotation keywords. It also needs an OpenAPI 3.1 description, an MCP server mounted on the same app, server-sent events, and a rendered API reference. It runs on Node 24 as ESM with strict TypeScript.

Fastify was the first candidate. Two properties count against it here. Its response serialisation uses `fast-json-stringify`, which serialises by response schema: fields not in the schema are dropped, which is wrong for HAL documents whose `_links`, `_embedded` and CDOP sections vary per resource. Its request validation uses Ajv in strict mode by default, which rejects unknown keywords such as `x-cdop-field-id`, so the CDOP schemas cannot be attached to routes as published. Both can be worked around (`ajv.customOptions.strict = false`, no response schemas), but that discards the reasons to pick Fastify.

## Decision

Hono 4.13 on `@hono/node-server`. `@hono/zod-openapi` (zod v4) types and documents our own inputs and produces the OpenAPI 3.1 document. Ajv 2020-12, with `strict: false` and the `x-cdop-*` keywords registered as a vocabulary, validates anything CDOP-shaped. `@modelcontextprotocol/hono` mounts the MCP server at `/mcp`. Swagger UI from `swagger-ui-dist` renders `/docs`, served from this origin (ADR 0008). Serialisation is plain `JSON.stringify`.

## Consequences

- Web-standard `Request`/`Response` throughout; the app also runs under other runtimes and in tests via `app.request()`.
- No schema-driven fast path for serialisation. Acceptable at this API's volumes.
- zod is used only for our own query and body shapes. CDOP payloads are never re-expressed as zod schemas.
- Fewer plugins than Fastify; rate limiting, ETags and problem details are small local modules in `src/http/`.
- The exact 3.1 document function in `@hono/zod-openapi` 1.6 and raw `$ref` responses are on the verify-at-implementation list.

## Alternatives considered

- **Fastify**: rejected for the serialisation and strict-Ajv reasons above.
- **Express**: no native typing or OpenAPI story; streaming and Web-standard APIs need adapters.
- **NestJS**: heavy for a reference implementation meant to be read.
- **Bare `node:http`**: possible, but every convenience becomes local code.
