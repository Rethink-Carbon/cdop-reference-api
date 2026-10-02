# ADR 0003: Vendored CDOP schemas and OpenAPI 3.1

Status: accepted. Date: 2026-09-20.

## Context

The CDOP schemas are JSON Schema 2020-12 files generated from an Excel workbook. The reference API must use them as published, prove that its documents conform, and show reviewers exactly which schema revision it implements. OpenAPI 3.0 has its own schema dialect and cannot host 2020-12 schemas without a lossy conversion; OpenAPI 3.1 adopts JSON Schema 2020-12, so the files can be embedded as they are.

The upstream repository moves without a release process, and its examples do not validate against its schemas.

## Decision

The schemas and examples are vendored into `packages/cdop-schemas` at a pinned upstream commit. `UPSTREAM.json` records the repository, commit, date, schema version and a SHA-256 per file. `pnpm cdop:verify` recomputes the hashes and runs in CI; `pnpm cdop:sync --ref <sha>` re-vendors in a pull request; `pnpm cdop:drift` compares with upstream `main` weekly and opens an issue. The schemas are never edited; deviations are logged in `SCHEMA-FEEDBACK.md`.

`scripts/build-openapi.ts` produces the OpenAPI 3.1 document: the `@hono/zod-openapi` description of our routes, plus each CDOP schema merged verbatim under `components.schemas["cdop.v2.<Pod>"]`. The CDOP files contain no `$ref`; only `$id` is stripped in the embedded copy to avoid collisions. The intact files are served at `/v2/schemas/{file}`. The artefact is committed and CI fails if it drifts (`pnpm openapi:check`); Spectral lints it.

Ajv 2020-12 validates CDOP payloads with the `x-cdop-*` keywords registered as a vocabulary. `X-CDOP-Schema-Version` (`2.0+eff6ca3`) is derived from `UPSTREAM.json`.

## Consequences

- The schema revision is reproducible and visible on every response.
- Schema updates are reviewable diffs, and a conformance test run accompanies each one.
- The test suite records the upstream examples as expected failures, which is itself feedback.
- The OpenAPI document is large (the Full List schema alone is about 300 KB). Swagger UI copes with models collapsed by default (see ADR 0008); expanding an operation that returns a CDOP document does no long main-thread work.
- Nothing about the CDOP shape is expressed twice, so nothing can drift between the schema and the code.

## Alternatives considered

- **Fetch schemas at runtime**: not reproducible, and the API would change under a running client.
- **Re-express the schemas as zod or TypeScript types**: a second source of truth that would hide upstream defects instead of surfacing them.
- **OpenAPI 3.0 with converted schemas**: loses 2020-12 keywords and misrepresents the contract.
