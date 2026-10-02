/** Turns generated histories into historical CloudEvents rows (origin='seed', deterministic ids). */
import { sql } from "kysely";
import type { Database } from "../db/kysely.js";
import type { Dataset } from "./aggregate.js";
import { deterministicId } from "../domain/ids.js";

interface EventRow {
  id: string;
  type: string;
  source: string;
  subject: string;
  subject_type: string;
  project_id: string | null;
  occurred_at: Date;
  origin: "seed";
  actor_kind: string | null;
  actor_account_id: string | null;
  data: string;
  dedupe_key: string;
}

export async function backfillEvents(
  db: Database,
  ds: Dataset,
  opts: { log?: ((m: string) => void) | undefined } = {},
): Promise<number> {
  const rows: EventRow[] = [];
  for (const p of ds.projects) {
    for (const s of p.statusHistory) {
      const prev = p.statusHistory.find((x) => x.sequence === s.sequence - 1);
      rows.push({
        id: deterministicId("evt", `${p.id}:status:${s.sequence}`),
        type: s.sequence === 1 ? "org.cdop.project.created" : "org.cdop.project.status.changed",
        source: `/v2/projects/${p.id}`,
        subject: p.id,
        subject_type: "project",
        project_id: p.id,
        occurred_at: s.effective_at,
        origin: "seed",
        actor_kind: s.actor_kind,
        actor_account_id: s.actor_account_id ?? null,
        data: JSON.stringify({
          entity: "project",
          id: p.id,
          project_id: p.id,
          project_identifier: p.project_identifier,
          action: s.action ?? null,
          status: {
            from: prev?.cdop_project_status ?? null,
            to: s.cdop_project_status,
            status_reason: s.reason ?? null,
            effective_at: s.effective_at.toISOString(),
            is_current: s.is_current,
          },
          lifecycle: { from: prev?.lifecycle_state ?? null, to: s.lifecycle_state },
          registry_status: { from: prev?.native_state_code ?? null, to: s.native_state_code },
          sequence: s.sequence,
        }),
        dedupe_key: `org.cdop.project.status.changed:${p.id}:${s.sequence}`,
      });
    }
    for (const i of p.issuances) {
      rows.push({
        id: deterministicId("evt", `${p.id}:issuance:${i.id}`),
        type: "org.cdop.issuance.created",
        source: `/v2/issuances/${i.id}`,
        subject: i.id,
        subject_type: "issuance",
        project_id: p.id,
        occurred_at: i.issued_on ?? i.requested_on ?? p.created_at,
        origin: "seed",
        actor_kind: "registry",
        actor_account_id: null,
        data: JSON.stringify({
          entity: "issuance",
          id: i.id,
          project_id: p.id,
          batch_identifier: i.batch_identifier,
          kind: i.kind,
          status: { to: i.status, is_current: true },
          unit_type: i.unit_type,
          vintage: i.vintage_label,
          volume: i.volume,
          cumulative_volume: i.cumulative_volume,
        }),
        dedupe_key: `org.cdop.issuance.created:${i.id}`,
      });
    }
    for (const b of p.blocks) {
      for (const h of b.history) {
        const type =
          h.action === "issue"
            ? "org.cdop.unit.issued"
            : h.action === "transfer"
              ? "org.cdop.unit.transferred"
              : h.action === "split"
                ? "org.cdop.unit.split"
                : h.action === "convert"
                  ? "org.cdop.unit.converted"
                  : "org.cdop.unit.status.changed";
        rows.push({
          id: deterministicId("evt", `${b.id}:unit:${h.sequence}`),
          type,
          source: `/v2/units/${b.id}`,
          subject: b.id,
          subject_type: "unit",
          project_id: p.id,
          occurred_at: h.effective_at,
          origin: "seed",
          actor_kind: h.actor_kind,
          actor_account_id: h.actor_account_id ?? null,
          data: JSON.stringify({
            entity: "unit",
            id: b.id,
            project_id: p.id,
            serial_number: b.serial_number,
            action: h.action,
            status: {
              from: h.from_state
                ? (b.history.find((x) => x.sequence === h.sequence - 1)?.cdop_status ?? null)
                : null,
              to: h.cdop_status,
              status_reason: h.reason ?? null,
              effective_at: h.effective_at.toISOString(),
              is_current: h.is_current,
            },
            lifecycle: { from: h.from_state ?? null, to: h.to_state },
            owner: {
              from: h.from_owner_account_id ?? null,
              to: h.to_owner_account_id ?? b.owner_account_id,
            },
            quantity: h.quantity ?? b.block_end - b.block_start + 1,
            sequence: h.sequence,
          }),
          dedupe_key: `${type}:${b.id}:${h.sequence}`,
        });
      }
    }
    for (const d of p.documents) {
      rows.push({
        id: deterministicId("evt", `${p.id}:doc:${d.id}`),
        type: "org.cdop.document.added",
        source: `/v2/projects/${p.id}/documents/${d.id}`,
        subject: d.id,
        subject_type: "document",
        project_id: p.id,
        occurred_at: d.uploaded_at,
        origin: "seed",
        actor_kind: "developer",
        actor_account_id: d.uploaded_by_account_id ?? null,
        data: JSON.stringify({
          entity: "document",
          id: d.id,
          project_id: p.id,
          document_type_id: d.document_type_id,
          title: d.title,
        }),
        dedupe_key: `org.cdop.document.added:${d.id}`,
      });
    }
    for (const m of p.milestones) {
      if (m.completed_at)
        rows.push({
          id: deterministicId("evt", `${p.id}:ms:${m.id}`),
          type: "org.cdop.milestone.completed",
          source: `/v2/projects/${p.id}/milestones`,
          subject: m.id,
          subject_type: "milestone",
          project_id: p.id,
          occurred_at: m.completed_at,
          origin: "seed",
          actor_kind: "registry",
          actor_account_id: null,
          data: JSON.stringify({
            entity: "milestone",
            id: m.id,
            project_id: p.id,
            name: m.name,
            kind: m.kind,
            due_on: m.due_on.toISOString().slice(0, 10),
          }),
          dedupe_key: `org.cdop.milestone.completed:${m.id}`,
        });
    }
  }
  rows.sort(
    (a, b) => a.occurred_at.getTime() - b.occurred_at.getTime() || a.id.localeCompare(b.id),
  );
  const log = opts.log ?? (() => undefined);
  log(`backfilling ${rows.length} historical events`);
  await db.transaction().execute(async (trx) => {
    await sql`select set_config('cdop.suppress_row_events', 'on', true)`.execute(trx);
    for (let i = 0; i < rows.length; i += 500) {
      await trx
        .insertInto("event")
        .values(rows.slice(i, i + 500))
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
    }
  });
  return rows.length;
}
