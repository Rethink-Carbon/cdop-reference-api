# 0011 — Optional owner-hosted Rybbit analytics

Status: accepted

## Context

The hosted demo needs visitor counts and insight into Atlas navigation and actions. The owner operates Rybbit at `https://rybbit.rethinkcodes.com` (CDOP site ID `5`). The installed v1.6.1 tracker includes hash-route query strings in its pathname even when query tracking is disabled. Atlas puts user search text in those queries, and HAL Explorer fragments may contain arbitrary resource URLs.

## Decision

Load a small local `/analytics.js` adapter on `/docs/`, `/explorer/` and `/atlas/` only when both `RYBBIT_ORIGIN` (HTTPS origin) and `RYBBIT_SITE_ID` (positive integer) are configured. Send directly to Rybbit's public `POST /api/track` endpoint using the payload protocol verified against the installed v1.6.1 `/api/script.js`. No additional dependency or remote executable script is needed. Recheck this contract when upgrading Rybbit.

Only `connect-src` is extended with that exact origin. Scalar telemetry and hosted features remain disabled. Deployments with no configuration retain the existing self-only policy (apart from the separate Mapbox exception).

Track pageviews, Atlas navigation, filter usage (booleans only), chart interactions, map selections, layout changes and link categories. Atlas detail IDs are grouped as `/detail`; query strings and arbitrary fragments are never transmitted. Referrers are reduced to origins; outbound links record only their hostname. Do not collect form contents, API keys, API payloads, resource IDs, session replay, custom user IDs or persistent browser identifiers. Rybbit still receives IP addresses, user agents, screen size and language to produce aggregate visitor, session and location statistics. Daily user ID salting is enabled for this site and its dashboard is private.

Respect Do Not Track, Global Privacy Control and Rybbit's local opt-out. Only track the hostname configured in `PUBLIC_BASE_URL`, so preview hosts cannot pollute production counts. Analytics is best effort: a blocked or unavailable destination must not stop the UI. Do not retry or replay missed visits.

## Consequences

This is an explicit, optional exception to ADR 0008's no-third-party browser requests. Historical traffic cannot be recovered. Counts exclude blockers and opted-out visitors, and direct API/MCP clients are outside browser analytics. Daily salting limits cross-day retention analysis. Local tests use an isolated fake destination; live verification visits appear in production statistics.
