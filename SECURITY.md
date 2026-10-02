# Security

## Reporting a vulnerability

Please do not open a public issue for a security problem. Email **security@rethinkcarbon.co.uk** (placeholder address until a dedicated one is published) with a description, the affected route or component, and steps to reproduce. We will acknowledge the report, keep you informed while we work on it, and credit you in the changelog if you wish.

We support the `main` branch and the latest tagged release.

## Scope

This repository is a reference implementation. The hosted demo at `cdop.rethinkcarbon.co.uk` serves **synthetic data only**. No real registry data, no personal data and no commercial data are held anywhere in the system. Names, places, identifiers, dates and figures are generated from a seed.

In scope:

- The API, MCP server, event stream and webhook dispatcher in `apps/api`.
- The container image and the compose files.
- The schema tooling in `packages/cdop-schemas`.

Out of scope:

- The upstream CDOP schemas themselves. Report those to the [CDOP repository](https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol/issues).
- Denial-of-service findings against the hosted demo. It is a demo with anonymous rate limiting, not a production service.

## How credentials are handled

- API keys have the form `cdop_<keyid>.<64hex>`. Only a SHA-256 hash of the key is stored (`cdop.api_key.key_hash`). A lost key cannot be recovered; revoke it and issue a new one with `pnpm keys:new`.
- Webhook signing secrets are stored hashed (`cdop.webhook.secret_hash`) and deliveries are signed following the Standard Webhooks specification.
- Anonymous callers can read everything. Writes require a key with a role. The bootstrap admin key comes from the `ADMIN_API_KEY` environment variable and is never logged.
- The API is the only database client. There is no row-level security, no database-side authentication, and no Supabase-specific feature in use.
