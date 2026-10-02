# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org). Releases are cut with `pnpm release` (`commit-and-tag-version`), which appends to this file from the conventional commit history.

The API major version (`/v2`) and the vendored CDOP schema version (`X-CDOP-Schema-Version`) are tracked separately; see the README.

## 0.1.0 (unreleased)

Milestone M1: a shareable, read-only reference API over a synthetic dataset.

### Added

- Repository scaffold: pnpm workspace, Node 24, TypeScript strict, ESLint with type-checked rules, Prettier, commitlint and husky, `commit-and-tag-version`.
- `packages/cdop-schemas`: CDOP v2.0 schemas and examples vendored at upstream commit `eff6ca3` with per-file SHA-256 pins (`UPSTREAM.json`); field registry with `x-cdop-*` annotations; enum lookup; Ajv 2020-12 validator with the `x-cdop-*` vocabulary; schema lint; `verify`, `sync`, `drift` commands.
- SQL migrations 0001 to 0008 in `supabase/migrations/` (schema and helpers, vocabulary, parties, project core, assessment, ledger, documents and commercial, events and infrastructure), runnable by the in-repo runner, `supabase start` and `supabase db push`.
- Lifecycle vocabularies: canonical project ladder, canonical unit machine, WCC and Peatland Code native state machines, simplified VCS, Gold Standard, ACR, Plan Vivo and Puro machines, and the CDOP and CAD Trust cross-walks.
- HTTP building blocks: HAL and HAL-FORMS types, `Linker`, cursor pagination, strong and weak ETags, RFC 9457 problem details with a problem catalogue.
- Deterministic seeding primitives (FNV-1a and mulberry32, tag-addressed) and business-hours time helpers.
- Docker: multi-stage `node:24-bookworm-slim` image, `docker-compose.yml` (API + Postgres 17) and `docker-compose.dokploy.yml` (API behind Traefik).
- GitHub Actions: CI (verify, lint, typecheck, migrate and seed, test, OpenAPI check, Spectral, Docker build), image publish to GHCR with a Dokploy deploy webhook, weekly upstream schema drift check.
- Documentation: README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, the schema-feedback register, the CDOP API profile proposal, ADRs 0001 to 0007, link relation pages, the HATEOAS tour, the MCP guide, the Dokploy runbook and the projection map.

- Synthetic data generator (`pnpm seed`): per-standard project factories for the Woodland Carbon Code, the Peatland Code and the ex-post standards (VCS in full; Gold Standard, ACR, Plan Vivo and Puro as thin variants), driven by each standard's native state machine so every status row is a legal transition. Default mix WCC 20, PC 15 and VCS 15; the full mix of 500 projects across 7 standards is `FULL_COUNTS`. Histories, validations, verifications, estimations with vintage curves, documents, milestones, site geometry, WCC group schemes, PIU issuance and conversion, ex-post issuance, transfers, retirements and buffer pool entries, with historical events backfilled.
- Dataset invariants (`src/seed/invariants.ts`), checked before anything is written: legal transitions only, one current row per history, histories in time order on weekday business hours, conservation of issued units, disjoint serial ranges, cumulative sums, the ex-ante buffer split, every enum string a CDOP value, and no invented name colliding with a real organisation.
- Read-only routes: root, projects with facets and status history, units, issuances, accounts, reference lists, schemas, state machines, the identifier resolver, `POST /v2/validate` and every `cdop/{pod}` document, with cursors, ETags and problem details.
- OpenAPI 3.1 artefact with the CDOP schemas embedded verbatim, Swagger UI at `/docs`, hal-explorer at `/explorer`.
- MCP at `/mcp`: 12 read tools, 2 prompts, and the schemas, OpenAPI document and feedback register as resources.
- `X-CDOP-Conformance` cites the register entry behind every validation error (`src/http/conformance.ts`), for example `invalid; errors=4; ref=CDOP-FB-005,CDOP-FB-020,CDOP-FB-028`.
- Tests: generator determinism and invariants up to the full mix; conformance of every seeded project through every pod in both modes, failing on any error no register entry explains; HTTP behaviour through `app.request()` against a seeded database (skipped when none is reachable); the upstream examples recorded as expected failures.
- Register entries `CDOP-FB-028` (the UK codes are missing from the program and methodology enums) and `CDOP-FB-029` (`unit_level[]` requires an accreditation and a compliance eligibility on every entry), both found by the conformance sweep.

### Fixed

- Unit-level labels claimed a CCP accreditation on every labelled unit, including units with only CORSIA eligibility. Each entry now carries only the half that applies (`CDOP-FB-029`).
- `credit_block[]` lacked `block_start`, so no Unit Description document validated (`CDOP-FB-003` already described the intended behaviour).
- Ex-post sale tranches could be dated before the tranche they followed, and a PIU assignment could be dated after the verification that converted the vintage.
- Documents meant to be uploaded one to five business days before the status move they support were uploaded the same day, sometimes after it.
- The ledger looked for a validation type that is not a CDOP value; it now uses `Validation of Project Design Document`.
- Methodology names for Gold Standard, Plan Vivo and Puro did not match the CDOP enum verbatim. The `UK ETS` label claimed a CDOP enum value that does not exist.
- Gold Standard developers could be drawn from a country with no name fragments, which crashed generation on some seeds. An improved forest management project name contained the name of a real developer.
- The root advertised `cdop:events`, `monitor` and `cdop:webhooks` links whose routes arrive in M2 and answered 404. They return with their routes.
- `pnpm lint` could not parse tests, scripts or vitest configs; tests were never typechecked; the repository had never been formatted. `pnpm typecheck` now covers tests and scripts.
- README and tour snippets used `_embedded.item` and `?state=`; the API embeds collections under their own name and filters units on `lifecycle_state`.

- `/docs` made every visitor download an unpinned Scalar bundle from a public CDN, with telemetry on by default and Scalar cloud features in the UI. It is now Swagger UI served from the pinned `swagger-ui-dist` dependency. HAL Explorer fetched its themes from `bootswatch.com`; the API serves them itself. Both UIs carry a `default-src 'self'` Content-Security-Policy, and a test fails if either references another origin (ADR 0008).
