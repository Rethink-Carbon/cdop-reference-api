# Contributing

Thanks for helping build the CDOP reference API. This page covers the toolchain, the commit rules, the checks CI runs, and the two house rules that matter most: every architectural decision gets an ADR, and every deviation from the CDOP schema gets a `CDOP-FB-nnn` entry.

## Toolchain

| Tool         | Version    | Notes                                                                                                          |
| ------------ | ---------- | -------------------------------------------------------------------------------------------------------------- |
| Node         | 24         | Pinned in `.nvmrc`. `engines.node >= 24`.                                                                      |
| pnpm         | 12         | Pinned in `package.json` (`packageManager`). Enable with `corepack enable`. `preinstall` rejects npm and yarn. |
| Docker       | any recent | Postgres 17 for local work and for CI.                                                                         |
| Supabase CLI | optional   | `supabase start` runs the same migrations on a local stack.                                                    |

```bash
corepack enable
pnpm install --frozen-lockfile
docker compose up -d db
cp .env.example apps/api/.env
pnpm db:migrate && pnpm seed
pnpm dev
```

The API package scripts read `.env` from `apps/api/`, so copy `.env.example` there or export the variables in your shell. The only required variable is `DATABASE_URL`.

## Workspace

This is a pnpm workspace with two packages:

- `@cdop/api` in `apps/api`: the Hono app, MCP server, seeder, simulator and migration runner.
- `@cdop/schemas` in `packages/cdop-schemas`: the vendored CDOP schemas plus the field registry, Ajv validator, lint, sync and drift tooling.

Root scripts fan out with `pnpm --filter`. Run `pnpm -r build` before anything that imports `@cdop/schemas` from `dist`.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org). `husky` installs two hooks on `pnpm install`:

- `commit-msg` runs `commitlint` with `@commitlint/config-conventional` (body and footer line length are unlimited).
- `pre-commit` runs `lint-staged`: `eslint --fix` on TypeScript and JavaScript, `prettier --write` on those plus JSON, Markdown and YAML.

Use the usual types (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `perf`). Scopes that read well in this repo: `api`, `schemas`, `seed`, `sim`, `mcp`, `events`, `db`, `docs`, `deploy`. Breaking changes carry a `BREAKING CHANGE:` footer. Releases are cut with `pnpm release` (`commit-and-tag-version`), and a `v*` tag publishes the container image.

## What CI runs

`.github/workflows/ci.yml` runs on every push to `main`, on `v*` tags and on every pull request, against a `postgres:17` service. On pushes it then publishes the image (and redeploys the hosted demo) only if the checks pass; pull requests never publish. Run the same steps locally before opening a PR:

```bash
pnpm cdop:verify        # vendored files match the hashes in UPSTREAM.json
pnpm cdop:lint          # informational schema lint, never fails the build
pnpm lint               # eslint, type-checked rules
pnpm typecheck          # tsc --noEmit in every package
pnpm db:migrate && pnpm seed -- --counts wcc=8,pc=6,vcs=6,gs4gg=2,acr=2,plan-vivo=2,puro=2
pnpm test               # vitest in every package
pnpm openapi:check      # the committed apps/api/openapi/openapi.json matches the code
pnpm dlx @stoplight/spectral-cli@6 lint apps/api/openapi/openapi.json --ruleset .spectral.yaml --fail-severity error
docker build -t cdop-reference-api:ci .
```

If you changed routes, run `pnpm openapi:build` and commit the artefact. The pull request template has a checklist for this.

## Determinism

Synthetic data must reproduce exactly from a seed. ESLint bans `Math.random`; use `apps/api/src/seed/prng.ts`, which derives every value from a tag so adding a field never reshuffles existing values. Timestamps come from `apps/api/src/seed/time.ts` (business hours, weekdays).

## Architecture decision records

Architectural decisions live in `docs/adr/` as MADR-style records: Context, Decision, Consequences, Alternatives considered. Number them sequentially (`0008-…`). Add one when you change a technology choice, a wire format, an identifier scheme, a vocabulary, or the shape of the event model. Small implementation choices do not need one.

## Schema feedback

The CDOP schemas are vendored verbatim and never edited. When the published schema cannot be implemented as written, or is ambiguous, or the API has to add something the schema cannot express, do three things:

1. Implement the narrowest workaround that keeps documents valid where possible.
2. Add an entry to [SCHEMA-FEEDBACK.md](SCHEMA-FEEDBACK.md) with the next `CDOP-FB-nnn` number: file and field path, category (`defect`, `ambiguity`, `extension`, `api-gap`), observation with an evidence snippet, impact, what the API does, proposal, status.
3. Optionally open an issue with the `CDOP schema feedback` template (`.github/ISSUE_TEMPLATE/schema-feedback.yml`) so the discussion has a home before it goes upstream.

Numbers are never reused. Entries are never deleted; they change status.

## Re-vendoring the CDOP schema

Upstream changes arrive through a pull request, never directly on `main`:

```bash
pnpm cdop:sync --ref <upstream commit sha>
pnpm cdop:verify
pnpm cdop:lint
pnpm -r build && pnpm test
```

`cdop:sync` rewrites `packages/cdop-schemas/schemas/v2/`, `examples/v2/` and `UPSTREAM.json` (commit, date, per-file SHA-256). The `X-CDOP-Schema-Version` header is derived from `UPSTREAM.json`, so it updates on its own. In the PR, review the diff of the schema files, re-run the conformance tests, and update any `CDOP-FB-nnn` entry whose status changed (for example, mark it `fixed upstream`). The weekly `schema-drift` workflow opens or updates an issue labelled `schema-drift` when upstream `main` moves; the issue body contains the drift report.

## Code style

- TypeScript strict, ESM, `import type` for types, no non-null assertions, no floating promises.
- Prettier formats everything; do not fight it.
- Resources use CDOP field names verbatim. Extra fields the API adds (`lifecycle_stage`, `registry_status`, `modified_at`, `version`) are documented in `docs/api-profile.md`.
- One transition table per entity drives `_templates`, action routes, OpenAPI operations, event types and the MCP state-machine tool. Do not add a second source of truth for legal moves.
- Errors are `ProblemError` instances with a slug from `apps/api/src/http/problems.ts`. Add a slug rather than throwing ad hoc objects.

## Pull requests

Keep PRs focused. Fill in the template (`What`, `Why`, checklist). CI must be green. A maintainer from Rethink Carbon reviews and merges. Merges to `main` publish `ghcr.io/rethink-carbon/cdop-reference-api:latest` and redeploy the hosted demo.
