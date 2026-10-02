# ADR 0005: CloudEvents over a single outbox table

Status: accepted. Date: 2026-09-20.

## Context

CDOP has no model for change. Consumers of a registry API need to learn that a project moved state, a block was retired, or a document was replaced, without re-reading everything. They need exact resume after a disconnect, an ordering they can trust, and a way to receive changes made outside the API (a row edited in the database console during a demo). Producers need retries and simulator re-runs not to duplicate events.

## Decision

One table, `cdop.event`, is the outbox. API services, the seeder, the simulator and database triggers all write to it. Each row is a CloudEvents 1.0 structured event: `id`, `type`, `source`, `subject`, `time`, plus extensions `sequence`, `actor`, `origin`, `correlationid` and `apiversion`. `type` follows two rules: every status-record append is `org.cdop.<entity>.status.changed`; other facts have named types (`org.cdop.unit.transferred`, `org.cdop.row.changed`, and so on). `dedupe_key` is unique, which makes retries idempotent.

Fan-out: a dedicated `pg` connection issues `LISTEN cdop_events`; a trigger `NOTIFY`s the sequence and the listener re-reads the row. A poll every two seconds is the fallback, bounded by `xact_id < pg_snapshot_xmin(pg_current_snapshot())` so a resume never skips a row committed late by a concurrent transaction. Consumers use SSE (`/v2/events`, `Last-Event-ID` = sequence, heartbeat 15 s), a pull feed (`/v2/changes`, long-poll up to 30 s), or Standard-Webhooks-signed webhooks claimed with `SKIP LOCKED` and retried eight times over about eight hours. Retention is 180 days or 500 000 rows; an older `Last-Event-ID` gets a problem with a `resync` link.

## Consequences

- One write path for events; every consumer sees the same sequence.
- Edits in Supabase Studio surface as `org.cdop.row.changed` with the changed columns, which is the demo line.
- Supabase's transaction-mode pooler cannot `LISTEN`; the hosted deployment uses the session pooler (`DATABASE_LISTEN_URL`) and the poll path works everywhere.
- Sequence numbers can have gaps after rollbacks; consumers must treat them as ordering, not counting.
- Webhook delivery adds a dispatcher loop and a `webhook_delivery` table; both are small.

## Alternatives considered

- **Logical replication or Debezium**: exact, but heavy to run and it exposes table shapes rather than domain events.
- **Triggers that call webhooks directly**: no replay, no ordering, and the database does network I/O.
- **A message broker**: operational cost with no benefit at this scale; the outbox can feed one later.
- **Polling `modified_at` only**: no deletions, no per-change granularity, no actor.
