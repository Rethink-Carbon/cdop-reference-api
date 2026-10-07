# CDOP reference API

A reference implementation of an API for the [Carbon Data Open Protocol](https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol) (CDOP) schema v2.0.

It serves the CDOP documents over a hypermedia REST API (HAL + HAL-FORMS). It publishes an OpenAPI 3.1 description that embeds the CDOP JSON Schemas verbatim. It exposes the same data to AI agents over MCP and streams changes as CloudEvents. It ships with a synthetic multi-registry dataset and a lifecycle simulator. Every place where the schema could not be implemented as published is logged in [SCHEMA-FEEDBACK.md](SCHEMA-FEEDBACK.md).

Maintained by [Rethink Carbon](https://rethinkcarbon.co.uk). MIT licence.

## Why this exists

CDOP is a member-driven data standard for carbon credit projects (co-chairs GCMU, Sylvera, RMI and S&P Global; 75 members). Schema v2.0 was published on 16 to 18 September 2026. It is authored in Excel and converted to JSON Schema 2020-12 by a script. The published artefacts are twelve schema files and eleven example documents. There is no API, the examples do not validate against the schemas, there is no lint step, and there is no model for change or synchronisation.

In September 2026 the CDOP Technical Working Group confirmed it wanted a reference implementation of an API. Rethink Carbon committed to deliver one. The commitment covers a working API with an OpenAPI description and synthetic data for every current schema document. It also covers an exploration of hypermedia navigation, and a written record of every gap, ambiguity or decision that could affect schema development. This repository is that deliverable. Rethink Carbon also uses the protocol itself.

## Status

M1 (v0.1) is feature complete locally: the read-only API, the seed, the conformance tests and the MCP read surface all pass CI's checks. It is not yet deployed to the hosted demo. The endpoint table below marks each route with the milestone in which it lands.

| Milestone | Scope                                                                                                                                                                 | Target            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| M1        | Read-only API, all CDOP documents, OpenAPI, Scalar API reference, hal-explorer, MCP read tools, seed of 370 projects across seven standards, schema-feedback register | 27 September 2026 |
| M2        | Ledger (issuances, unit blocks), HAL-FORMS actions with API keys, events (SSE, pull feed, webhooks), simulator, accounts, MCP write tools                             | weeks 2 to 3      |
| M3        | 500 projects across 7 standards, golden fixtures, rate limiting, demo reset, `PUT` of pod documents, client package                                                   | weeks 4 to 5      |
| M4        | TWG iteration, Round 2 pods (Registry, Validation, Verification Metadata), `v1.0.0`                                                                                   | week 6            |

## Quickstart

You need Docker with Compose. Nothing else.

```bash
git clone https://github.com/rethink-carbon/cdop-reference-api.git
cd cdop-reference-api
docker compose up
```

The first boot applies the migrations and seeds the synthetic dataset (`SEED_ON_START=true`). Then open:

| URL                            | What                                                        |
| ------------------------------ | ----------------------------------------------------------- |
| http://localhost:3000/atlas    | Visual explorer: map, charts and drill-throughs (see below) |
| http://localhost:3000/docs     | OpenAPI 3.1 reference (Scalar)                              |
| http://localhost:3000/explorer | HAL browser (hal-explorer)                                  |
| http://localhost:3000/v2       | HAL root: follow the links from here                        |
| http://localhost:3000/mcp      | MCP endpoint (Streamable HTTP)                              |
| http://localhost:3000/healthz  | Health check                                                |

`/atlas` shows every project and registry account on a map, with drill-throughs into a project's status history, issuances, units, documents and CDOP documents, and charts of projects by stage and units by vintage. It is a HAL client of this API and lists the calls behind each view. The map needs a public Mapbox token: `MAPBOX_API_KEY=pk.… docker compose up`. Without one, everything but the map works.

If ports 3000 or 5433 are busy on your machine, set `CDOP_PORT` and `CDOP_DB_PORT` before starting:

```bash
CDOP_PORT=3100 CDOP_DB_PORT=5434 docker compose up
```

The hosted demo runs at https://cdop.rethinkcarbon.co.uk with the same routes.

## A five-step tour with curl

The API is hypermedia. Start at the root and follow links; you never need to construct a URL. Each response carries `_links`, and the `cdop` curie resolves every custom relation to a page under `/rels/`.

Step 1: the root.

```bash
curl -s http://localhost:3000/v2 | jq '._links | keys'
```

Step 2: follow `cdop:projects` to the collection. Collections are compact index rows under `_embedded`, keyed by the collection's name (`projects`, `units`, `documents`), with `total`, `limit` and `next`/`prev`/`first` links. Filters use CDOP field names.

```bash
PROJECTS=$(curl -s http://localhost:3000/v2 | jq -r '._links["cdop:projects"].href')
curl -s "$PROJECTS?standard=wcc&limit=3" | jq '{total, limit, items: [._embedded.projects[] | {id, project_name, lifecycle_stage}]}'
```

Step 3: open one project. The resource uses CDOP field names verbatim, plus `status` (the current status record), `lifecycle_stage` and `registry_status`.

```bash
PROJECT=$(curl -s "$PROJECTS?standard=wcc&limit=1" | jq -r '._embedded.projects[0]._links.self.href')
curl -s "$PROJECT" | jq '{project_name, lifecycle_stage, registry_status, status, documents: [._links["cdop:document"][].name]}'
```

Step 4: fetch the schema-pure Full List document. `cdop:document` is an array of named links, one per CDOP pod. Note the `ETag`, the `Link: rel="describedby"` header and `X-CDOP-Schema-Version`.

```bash
FULL_LIST=$(curl -s "$PROJECT" | jq -r '._links["cdop:document"][] | select(.name == "full-list") | .href')
curl -s -D - "$FULL_LIST" -o full-list.json | grep -iE '^(etag|link|x-cdop)'
```

Step 5: validate it. `POST /v2/validate` runs Ajv (JSON Schema 2020-12) against the vendored CDOP schema.

```bash
curl -s -X POST "http://localhost:3000/v2/validate?schema=full-list" \
  -H 'content-type: application/json' --data @full-list.json | jq '{valid, errors: (.errors | length)}'
```

Expect `"valid": false`. That is the point of the exercise, not a bug: no Full List document for a voluntary-market project can validate against the published schema, because `project.compliance_market_id` is required with at least one item (`CDOP-FB-020`). The `X-CDOP-Conformance` header from step 4 names the register entry behind every error, for example `invalid; errors=4; ref=CDOP-FB-005,CDOP-FB-020,CDOP-FB-028`. The pods those defects do not touch validate. Add `?strict=1` to have the API fill required-but-unpublished sections with flagged placeholders:

```bash
ESTIMATIONS=$(curl -s "$PROJECT" | jq -r '._links["cdop:document"][] | select(.name == "estimations") | .href')
curl -s "$ESTIMATIONS?strict=1" | curl -s -X POST "http://localhost:3000/v2/validate?schema=estimations" \
  -H 'content-type: application/json' --data @- | jq '{valid}'
```

A longer walkthrough, including `If-None-Match`, the URN resolver, HAL-FORMS templates and problem details, is in [docs/hateoas-tour.md](docs/hateoas-tour.md).

## Three surfaces, one model

**REST (HAL + HAL-FORMS).** Every resource carries `_links`. Collections embed compact rows. State-gated actions appear as `_templates` (M2), derived from one transition table per entity, so a retired block never offers `retire`. Errors are RFC 9457 `application/problem+json` with a documented type per problem (`/problems/{slug}`). Custom relations are documented under `/rels/{rel}` and in [docs/rels/](docs/rels/).

**OpenAPI 3.1.** `/v2/openapi.json` describes our routes and embeds each CDOP schema under `components.schemas["cdop.v2.<Pod>"]` without re-expressing it. Scalar renders it at `/docs`, served from this origin (see "Self-hosted UIs and optional external services" below). The artefact is committed at `apps/api/openapi/openapi.json` and CI fails if it drifts from the code.

**MCP.** `/mcp` mounts an MCP server over Streamable HTTP with the same services behind it: `search_projects`, `get_project`, `get_cdop_document` (with an Ajv conformance report), `validate_payload`, `explain_schema`, `list_enum`, `get_state_machine` and more. Results carry HAL links so an agent can keep navigating. See [docs/mcp.md](docs/mcp.md).

**Events (M2).** Every status-record append becomes a CloudEvents 1.0 event of type `org.cdop.<entity>.status.changed`, written to one outbox table. Consume them over SSE (`/v2/events`, resumable with `Last-Event-ID`), as a pull feed (`/v2/changes?since=`), or as signed webhooks (`/v2/webhooks`). A row edited directly in the database produces `org.cdop.row.changed`.

## Conformance

The CDOP schemas are vendored, not re-expressed. `packages/cdop-schemas/schemas/v2/` holds the twelve schema files and `examples/v2/` the eleven upstream examples, pinned to upstream commit `eff6ca3` (16 September 2026) with a SHA-256 per file in `UPSTREAM.json`. Ajv 2020-12 validates every CDOP-shaped payload, with the `x-cdop-*` annotation keywords registered as a vocabulary.

| Command                      | What it does                                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm cdop:verify`           | Recomputes every vendored file's hash against `UPSTREAM.json`. Runs in CI.                                                                                                                                             |
| `pnpm cdop:lint`             | Static checks the upstream pipeline lacks: keys with spaces, mangled keys, integer identifiers, links and dates without `format`, required-but-private fields, annotation casing, enum near-duplicates. Informational. |
| `pnpm cdop:sync --ref <sha>` | Re-vendors from upstream at a commit and rewrites `UPSTREAM.json`. Run in a PR.                                                                                                                                        |
| `pnpm cdop:drift`            | Compares upstream `main` with the pinned copy. A weekly workflow opens an issue on drift.                                                                                                                              |

The test suite asserts that the upstream examples for Unit Description, Estimations, Crediting Period and Full List do not validate against the upstream schemas (see `CDOP-FB-004`).

It also projects every seeded project through every pod and validates the result. Eight of the eleven project pods validate for every project under every standard. The other three fail only for reasons the register records, and the suite fails the build on any error no register entry explains:

| Pod                                                                                                                            | Result                                      | Why                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Location Details, Disclosures, Issuances, Crediting Period, Estimations, Co-Benefits, Durability & Permanence, Project Finance | valid for every project                     |                                                                                                              |
| Project Approach & Details                                                                                                     | valid except WCC and Peatland Code projects | The UK codes are missing from the program and methodology enums (`CDOP-FB-028`)                              |
| Full List, Labels & Certifications                                                                                             | invalid for every project                   | `compliance_market_id` is required with `minItems: 1` (`CDOP-FB-020`); labelled units also hit `CDOP-FB-029` |

## API version is not schema version

The URL prefix `/v2` is the API major version. The CDOP schema version travels separately in a response header on every CDOP document and on the root:

```
X-CDOP-Schema-Version: 2.0+eff6ca3
X-API-Version: 0.1.0
```

The schema label is derived from `UPSTREAM.json`, so re-vendoring the schema changes the header without touching the API version. A `?strict=1` query on a `cdop/{pod}` document adds `X-CDOP-Conformance`, which explains any placeholder the API had to emit to satisfy a defect in the published schema.

## Self-hosted UIs and optional external services

The running service talks to its Postgres database and nothing else. `/docs` and `/explorer` are served from the API's own origin and the browser is told to enforce that. Mapbox and operator-configured Rybbit analytics are the scoped exceptions described below.

- `/docs` is Scalar (MIT): the browser bundle from `@scalar/api-reference`, pinned to an exact version in the lockfile and in `pnpm audit`, copied alone into the image. No CDN. Its font CDN, telemetry, hosted AI agent and hosted-client link are switched off, and its "Connect MCP" entry points at this API's own `/mcp` (ADR 0009).
- `/explorer` is HAL Explorer (MIT), vendored. Its theme picker is hard-wired to `bootswatch.com`; the API serves the themes itself instead, so every theme is the Bootstrap build already in the bundle.
- By default both carry `Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'; ...`. A script, stylesheet, font or request to any other origin is blocked by the browser, not just absent by convention. The test suite fails if either page references another origin.
- Install scripts run only where `pnpm-workspace.yaml` allows them (`vue-demi`, pulled in by Scalar, is denied), and the image installs with `--ignore-scripts`.
- `/atlas` draws its basemap with Mapbox, which cannot be self-hosted (ADR 0010). Only when `MAPBOX_API_KEY` holds a public token does the page load Mapbox GL JS from `api.mapbox.com`, at an exact version with a Subresource Integrity hash, and only that page's policy allows `api.mapbox.com`, `*.tiles.mapbox.com` and `events.mapbox.com`. Mapbox then sees each visitor's IP address, this origin as referrer, and their map loads. Without a token the page keeps the self-only policy. Its own scripts and charts are served from this origin, and the image contains no Mapbox code.

- Optional Rybbit analytics (ADR 0011): set both `RYBBIT_ORIGIN` (HTTPS origin, no trailing slash) and `RYBBIT_SITE_ID` to count visitors to `/docs/`, `/explorer/` and `/atlas/`, plus Atlas navigation and actions. Only the configured origin is added to `connect-src`; scripts stay local. Search text, URL queries, API credentials and session replay are excluded. Do Not Track and Global Privacy Control are respected. Unset both to disable it.

## Local development

Prerequisites: Node 24 (`.nvmrc`), pnpm 12 via corepack (`corepack enable`), Docker.

```bash
pnpm install --frozen-lockfile
docker compose up -d db                 # Postgres 17 on localhost:5433
cp .env.example apps/api/.env           # the API scripts read .env from apps/api/
pnpm db:migrate                         # applies supabase/migrations/*.sql with checksums
pnpm seed                               # deterministic synthetic dataset (CDOP_SEED=2026)
pnpm dev                                # tsx watch on http://localhost:3000
pnpm test
```

`pnpm seed -- --counts wcc=8,pc=6,vcs=6` seeds a smaller mix (this is what CI does). The Supabase CLI works too: `supabase start` runs the same migrations on a local stack (API 54421, database 54422, Studio 54423). `pnpm db:migrate` refuses to run against a database the Supabase CLI already manages, to avoid applying files twice.

Environment variables are documented in [.env.example](.env.example). The API needs only `DATABASE_URL`.

## Endpoints

All API routes live under `/v2`, respond with `application/hal+json`, and use RFC 9457 problem details for errors.

| Method            | Path                                                                                                                | Notes                                                                                                                                                                                                                                                                                     | Milestone         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| GET               | `/v2`                                                                                                               | HAL root: curies, collections, `service-desc`, `service-doc`, schemas                                                                                                                                                                                                                     | M1                |
| GET               | `/v2/projects`, `/v2/projects/{id}`                                                                                 | Filters use CDOP field names (`status`, `country_code`, `registry`, `standard`, `project_type`, `mitigation_type`, `methodology`, `project_identifier`, `current_registry_project_id`, `developer_account_id`, `q`, `modified_since`, `bbox`); `sort`, `limit` (max 100), opaque `cursor` | M1                |
| GET               | `/v2/projects/{id}/status-history`                                                                                  | Status records newest first, with `effective_at`, `recorded_at`, actor and `event_id`                                                                                                                                                                                                     | M1                |
| GET               | `/v2/projects/{id}/{facet}`                                                                                         | `stakeholders`, `crediting-program`, `registry`, `cobenefits`, `buffer-pool`, `labels`, `finance`                                                                                                                                                                                         | M1                |
| GET               | `/v2/projects/{id}/{collection}`                                                                                    | `facilities`, `methodologies`, `validations`, `estimations`, `documents`, `geolocation-files` (+ `/{gid}/content` as `application/geo+json`), `issuances`, `units`                                                                                                                        | M1                |
| GET               | `/v2/projects/{id}/{collection}`                                                                                    | `verifications`, `agreements`, `milestones`; `embed=` allow-list                                                                                                                                                                                                                          | M2                |
| GET               | `/v2/projects/{id}/cdop/{pod}`                                                                                      | Schema-pure CDOP document: `full-list`, `location-details`, `project-approach-details`, `disclosures`, `issuances`, `crediting-period`, `estimations`, `co-benefits`, `durability-permanence`, `project-finance`, `labels-certifications`                                                 | M1                |
| GET               | `/v2/units`, `/v2/units/{id}`, `/v2/units/{id}/status-history`, `/v2/units/{id}/cdop/{unit-description\|full-list}` | One resource is one credit block; `limit` max 250                                                                                                                                                                                                                                         | M1                |
| GET               | `/v2/issuances`, `/v2/issuances/{id}`                                                                               |                                                                                                                                                                                                                                                                                           | M1                |
| GET               | `/v2/accounts`, `/v2/accounts/{id}`, `/v2/accounts/{id}/units`                                                      | Registry accounts                                                                                                                                                                                                                                                                         | M1                |
| GET               | `/v2/identifiers/{urn}`                                                                                             | Resolves a CDOP URN with a 303                                                                                                                                                                                                                                                            | M1                |
| GET               | `/v2/reference`, `/v2/reference/{list}`                                                                             | Every enum in the vendored schema                                                                                                                                                                                                                                                         | M1                |
| GET               | `/v2/schemas`, `/v2/schemas/{file}`                                                                                 | The vendored schema files, served intact                                                                                                                                                                                                                                                  | M1                |
| GET               | `/v2/state-machines`, `/v2/state-machines/{entity}`                                                                 | Transition tables and lifecycle mapping tables                                                                                                                                                                                                                                            | M1                |
| POST              | `/v2/validate?schema={pod}`                                                                                         | Ajv result for any payload                                                                                                                                                                                                                                                                | M1                |
| POST              | `/v2/{projects\|units\|issuances}/{id}/actions/{action}`                                                            | Transitions from HAL-FORMS templates; `Idempotency-Key`, `If-Match`; API key required                                                                                                                                                                                                     | M2                |
| POST              | `/v2/projects`                                                                                                      | Create from a CDOP Project Approach & Details document                                                                                                                                                                                                                                    | M2                |
| PUT               | `/v2/projects/{id}/cdop/{pod}`                                                                                      | Upsert a pod document                                                                                                                                                                                                                                                                     | M3                |
| GET               | `/v2/events`                                                                                                        | SSE stream; `Last-Event-ID` or `since`, `types`, `project_id`; heartbeat every 15 s                                                                                                                                                                                                       | M2                |
| GET               | `/v2/changes`                                                                                                       | Pull feed of CloudEvents; `since`, `types`, `project_id`, `limit`, `wait` (long-poll up to 30 s)                                                                                                                                                                                          | M2                |
| GET, POST, DELETE | `/v2/webhooks`, `/v2/webhooks/{id}/actions/ping`, `/v2/webhooks/{id}/deliveries`                                    | Standard Webhooks signatures, 8 retries over about 8 hours                                                                                                                                                                                                                                | M2                |
| ALL               | `/mcp`, `/mcp/{token}`                                                                                              | MCP Streamable HTTP, stateless                                                                                                                                                                                                                                                            | M1 read, M2 write |
| GET               | `/v2/openapi.json`, `/docs`, `/explorer`, `/atlas`, `/rels/{rel}`, `/problems/{slug}`, `/healthz`                   |                                                                                                                                                                                                                                                                                           | M1                |
| POST              | `/v2/admin/reset`, `/v2/admin/sim`                                                                                  | Reseed; simulator start, stop and rate (admin key)                                                                                                                                                                                                                                        | M3                |

Reads are anonymous. Writes need `Authorization: Bearer cdop_<keyid>.<64hex>`. Keys are stored as SHA-256 hashes with one of the roles `developer`, `vvb`, `code_admin`, `registry`, `admin`, `sandbox`. `pnpm seed` prints demo keys for a local database. `pnpm keys:new --role <role> --label <text>` stores a new key and prints its token once; `pnpm keys:new` on its own prints a token for `ADMIN_API_KEY`, which is never stored.

## Repository layout

```
apps/api/                 the API, MCP server, seeder and simulator (Hono, Kysely, Ajv)
  src/domain/lifecycle/   per-standard state machines and the canonical vocabularies
  src/http/               HAL, HAL-FORMS, problem details, cursors, ETags
  src/db/                 Kysely setup and the SQL migration runner
  src/seed/               deterministic synthetic data generator
  src/routes/ src/mcp/    read-only routes and the MCP server (M1)
  src/sim/ src/webhooks/  land in M2
  test/                   generator, conformance and HTTP suites
packages/cdop-schemas/    vendored CDOP schemas + examples, field registry, Ajv validator, lint, sync, drift
supabase/migrations/      SQL migrations (run by docker compose, supabase start and supabase db push alike)
supabase/config.toml      local Supabase stack configuration
docs/                     ADRs, link relations, API profile, tours, deployment
docker-compose.yml        API + Postgres 17 for forkers
docker-compose.dokploy.yml  API only, for the hosted demo behind Traefik
.github/workflows/        ci, docker (GHCR + Dokploy webhook), schema-drift
```

## Documentation

- [SCHEMA-FEEDBACK.md](SCHEMA-FEEDBACK.md): the numbered register of schema defects, ambiguities and API gaps found while implementing.
- [docs/api-profile.md](docs/api-profile.md): the companion "CDOP API profile" proposal (identifiers, timestamps, pagination, events, lifecycle vocabularies).
- [docs/hateoas-tour.md](docs/hateoas-tour.md): the long curl walkthrough.
- [docs/projection.md](docs/projection.md): how `cdop.*` tables map onto CDOP document sections.
- [docs/mcp.md](docs/mcp.md): connecting Claude Code, Claude Desktop and other MCP clients.
- [docs/deploy-dokploy.md](docs/deploy-dokploy.md): the hosted deployment runbook.
- [docs/adr/](docs/adr/): architecture decision records.
- [docs/rels/](docs/rels/): one page per custom link relation.
- [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [CHANGELOG.md](CHANGELOG.md).

## Data

All data in this repository and on the hosted demo is synthetic. Names, places, identifiers, dates and figures are generated deterministically from a seed. Nothing is taken from a real registry.

## Licence

MIT. See [LICENSE](LICENSE). The CDOP schemas are vendored under their own MIT licence from the upstream repository.
