# Deploying the hosted demo on Dokploy

The hosted demo at `cdop.rethinkcarbon.co.uk` runs as one container (API, MCP, event fan-out, webhook dispatcher and simulator) on Rethink Carbon's Dokploy box behind Traefik, with the database on a Supabase cloud project. GitHub Actions builds the image and publishes it to GHCR; Dokploy redeploys when the workflow calls its deploy webhook. Dokploy has no GitHub provider, hence the webhook.

Six steps. Steps 1, 2, 4 and 5 need a human with the right accounts.

## 1. Supabase project

1. Create a project in the Supabase organisation "Rethink Carbon" (region `eu-west-2`).
2. Apply the migrations from a checkout:

```bash
supabase link --project-ref <ref>
supabase db push
```

`supabase db push` records the migrations in `supabase_migrations.schema_migrations`. From then on the in-repo runner (`pnpm db:migrate`) refuses to touch this database, which is intended.

3. Copy the **session pooler** connection string (the pooler host on port 5432, not the transaction pooler on 6543). `LISTEN`/`NOTIFY`, which the event fan-out uses, is not available through the transaction-mode pooler. The direct connection is IPv6-only on Supabase; the pooler provides IPv4, which is what the Dokploy box needs.
4. Use the same string for `DATABASE_URL` and, if you ever separate the two, the session pooler string for `DATABASE_LISTEN_URL`. The poll fallback works on any connection, so the API stays correct even if `LISTEN` is unavailable.

Supabase Studio is the hand-edit UI for the demo: editing `native_state_code` on a project row inserts a status record through the `project_state_sync` trigger, and any edit on a tracked table emits an `org.cdop.row.changed` event.

## 2. GitHub organisation, repository and GHCR

1. Create the GitHub organisation `rethink-carbon` and the public repository `cdop-reference-api` (MIT).
2. Push `main`. `.github/workflows/docker.yml` runs on every push to `main` and on `v*` tags, builds the image with `docker/build-push-action`, and pushes:
   - `ghcr.io/rethink-carbon/cdop-reference-api:sha-<short sha>`
   - `ghcr.io/rethink-carbon/cdop-reference-api:latest` (default branch)
   - `ghcr.io/rethink-carbon/cdop-reference-api:<tag>` (tags)
3. Make the GHCR package public, or add a registry credential in Dokploy so it can pull.

## 3. Dokploy Compose service

In the Dokploy project "Rethink Carbon", create a **Compose** service and paste `docker-compose.dokploy.yml` (raw compose, no build step; the image comes from GHCR). Set these environment variables on the service:

| Variable                    | Required | Value                                                     |
| --------------------------- | -------- | --------------------------------------------------------- |
| `DATABASE_URL`              | yes      | Supabase session pooler connection string                 |
| `DATABASE_LISTEN_URL`       | no       | Session pooler string if `DATABASE_URL` is not one        |
| `ADMIN_API_KEY`             | yes      | Generate with `pnpm keys:new`; the bootstrap admin key    |
| `CDOP_DOMAIN`               | no       | Defaults to `cdop.rethinkcarbon.co.uk`                    |
| `CDOP_IMAGE_TAG`            | no       | Defaults to `latest`; pin to `sha-…` to roll back         |
| `SEED_ON_START`             | no       | Defaults to `true`; seeds only when the database is empty |
| `CDOP_SEED`                 | no       | Defaults to `2026`                                        |
| `AFFORDANCES_FOR_ANONYMOUS` | no       | Defaults to `all` on the demo                             |
| `SIM_ENABLED`               | no       | Defaults to `true` on the demo                            |
| `LOG_LEVEL`                 | no       | Defaults to `info`                                        |

The compose file already carries the Traefik labels (`web` entrypoint redirected to `websecure`, `letsencrypt` resolver, service port 3000) and joins the external `dokploy-network`. It defines a healthcheck on `/healthz` with a 120 s start period, so the first migration-and-seed run does not get the container killed. Deploy once by hand to confirm it comes up.

Migrations run at container start. On a fresh database the seed runs too; on a populated one it is skipped.

## 4. Deploy webhook secret

1. In the Dokploy Compose service, open the deployments panel and copy the **deploy webhook URL**.
2. In the GitHub repository, add it as an Actions secret named `DOKPLOY_DEPLOY_WEBHOOK`.

`docker.yml` calls `curl -fsS -X POST "$DOKPLOY_DEPLOY_WEBHOOK"` after a successful push on `main`. The step is skipped when the secret is empty, so forks without a Dokploy box still build.

## 5. DNS

Create an `A` record for `cdop.rethinkcarbon.co.uk` pointing at the Dokploy box. Traefik obtains the Let's Encrypt certificate on the first HTTPS request once the record resolves. Requests on port 80 are redirected to HTTPS by the `redirect-to-https@file` middleware.

## 6. Verification

```bash
curl -s https://cdop.rethinkcarbon.co.uk/healthz | jq
```

Expect `200` with `db: ok` and an `events_sequence` (the last outbox sequence). Then:

```bash
curl -s -D - -o /dev/null https://cdop.rethinkcarbon.co.uk/v2 | grep -iE '^(x-cdop|x-api|strict-transport)'
open https://cdop.rethinkcarbon.co.uk/docs
open https://cdop.rethinkcarbon.co.uk/explorer
```

Server-sent events must not be buffered by the proxy (M2). Open the stream and wait for the heartbeat:

```bash
curl -N https://cdop.rethinkcarbon.co.uk/v2/events
```

A comment line should arrive every 15 s. If nothing arrives until the connection closes, Traefik is buffering; check the router has no buffering middleware attached and that the response carries `content-type: text/event-stream` and `cache-control: no-cache`.

Check the container log for the fan-out mode: it says whether `LISTEN cdop_events` succeeded on the pooler or the poll fallback is active. Both are correct; `LISTEN` is faster.

## Rolling back

Set `CDOP_IMAGE_TAG` to a previous `sha-…` tag on the Compose service and redeploy. Migrations are forward-only; a rollback that needs a schema change is a new migration.

## Resetting the demo data

`POST /v2/admin/reset` with the admin key reseeds (M3). Until then: `supabase db reset --linked` is destructive and re-applies all migrations; the next container start seeds again.
