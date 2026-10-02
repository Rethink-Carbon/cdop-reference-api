# Deploying the hosted demo on Dokploy

The hosted demo at `cdop.rethinkcarbon.co.uk` runs on Rethink Carbon's Dokploy box behind Traefik as one Compose service with two containers: Postgres 17 and the API (API, MCP, event fan-out, webhook dispatcher and simulator). GitHub Actions builds the image and publishes it to GHCR; Dokploy redeploys when the workflow calls its deploy webhook, so every push to `main` that passes the image build goes live.

Five steps. Steps 1, 3 and 4 need a human with the right accounts.

## 1. GitHub repository and GHCR

1. The repository is `github.com/Rethink-Carbon/cdop-reference-api` (public, MIT).
2. `.github/workflows/docker.yml` runs on every push to `main` and on `v*` tags, builds the image with `docker/build-push-action`, and pushes:
   - `ghcr.io/rethink-carbon/cdop-reference-api:sha-<short sha>`
   - `ghcr.io/rethink-carbon/cdop-reference-api:latest` (default branch)
   - `ghcr.io/rethink-carbon/cdop-reference-api:<tag>` (tags)
3. Make the GHCR package public (package settings, "Change visibility"), or add a registry credential in Dokploy so it can pull. GitHub creates new packages as private and has no API for changing their visibility.

## 2. Dokploy Compose service

In the Dokploy project "CDOP Reference API", create a **Compose** service with the raw source type and paste `docker-compose.dokploy.yml` (no build step; the image comes from GHCR). Set these environment variables on the service:

| Variable                    | Required | Value                                                     |
| --------------------------- | -------- | --------------------------------------------------------- |
| `POSTGRES_PASSWORD`         | yes      | URL-safe, because it is embedded in `DATABASE_URL`        |
| `ADMIN_API_KEY`             | yes      | The bootstrap admin key; see below                        |
| `CDOP_DOMAIN`               | no       | Defaults to `cdop.rethinkcarbon.co.uk`                    |
| `CDOP_IMAGE_TAG`            | no       | Defaults to `latest`; pin to `sha-…` to roll back         |
| `SEED_ON_START`             | no       | Defaults to `true`; seeds only when the database is empty |
| `CDOP_SEED`                 | no       | Defaults to `2026`                                        |
| `AFFORDANCES_FOR_ANONYMOUS` | no       | Defaults to `all` on the demo                             |
| `SIM_ENABLED`               | no       | Defaults to `true` on the demo                            |
| `LOG_LEVEL`                 | no       | Defaults to `info`                                        |

Generate the two secrets from a checkout:

```bash
openssl rand -hex 24
pnpm keys:new
```

The compose file builds `DATABASE_URL` from `POSTGRES_PASSWORD` and refuses to start if either secret is empty. Postgres sits on the service's private network only; the API also joins the external `dokploy-network` and carries the Traefik labels (`web` entrypoint redirected to `websecure`, `letsencrypt` resolver, service port 3000). The API waits for Postgres to be healthy, and its own healthcheck on `/healthz` has a 120 s start period so the first migration-and-seed run does not get the container killed. `pull_policy: always` makes each redeploy fetch the current `latest`, because Dokploy redeploys with `docker compose up`.

Migrations run at container start. On a fresh database the seed runs too; on a populated one it is skipped. The data lives in the service's `cdop-db` volume. It is reproducible from `CDOP_SEED`, so backing it up is optional; Dokploy's volume backups work if hand edits ever need keeping.

## 3. Deploy webhook secret

1. In the Dokploy Compose service, open the deployments panel and copy the **deploy webhook URL**. Auto deploy must be enabled on the service.
2. Add it to the GitHub repository as the Actions secret `DOKPLOY_DEPLOY_WEBHOOK`:

```bash
gh secret set DOKPLOY_DEPLOY_WEBHOOK --repo Rethink-Carbon/cdop-reference-api
```

`docker.yml` calls `curl -fsS -X POST "$DOKPLOY_DEPLOY_WEBHOOK"` after a successful push on `main`. When the secret is empty the step logs that it is skipping the redeploy and succeeds, so forks without a Dokploy box still build.

## 4. DNS

Create an `A` record for `cdop.rethinkcarbon.co.uk` pointing at the Dokploy box. `rethinkcarbon.co.uk` has a wildcard record at its DNS host, so until the specific record exists the name resolves to the website host instead. Traefik obtains the Let's Encrypt certificate on the first HTTPS request once the record resolves. Requests on port 80 are redirected to HTTPS by the `redirect-to-https@file` middleware.

## 5. Verification

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

The API connects to Postgres directly, so `LISTEN cdop_events` works and the container log should report it rather than the poll fallback.

## Rolling back

Set `CDOP_IMAGE_TAG` to a previous `sha-…` tag on the Compose service and redeploy. Migrations are forward-only; a rollback that needs a schema change is a new migration.

## Resetting the demo data

`POST /v2/admin/reset` with the admin key reseeds (M3). Until then: stop the Compose service, remove its `cdop-db` volume on the box (`docker volume ls | grep cdop-db`, then `docker volume rm` it), and deploy again; the empty database is migrated and seeded on start.
