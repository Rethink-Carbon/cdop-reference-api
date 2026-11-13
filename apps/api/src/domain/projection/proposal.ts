/** Rethink's review profile. It is an experiment, not a published CDOP schema. */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ProjectAggregate } from "../../seed/aggregate.js";
import { LIFECYCLE_STATES } from "../lifecycle/types.js";

export const PROPOSAL_VERSION = "0.1.0";
export const PROPOSAL_LABEL = `rethink-proposal-${PROPOSAL_VERSION}`;
export const PROPOSAL_FEEDBACK = [
  "CDOP-FB-010",
  "CDOP-FB-012",
  "CDOP-FB-013",
  "CDOP-FB-014",
  "CDOP-FB-015",
];
// Fixed issuer namespace for this reference implementation only. Importers must preserve the
// assigned ID; two issuers cannot independently infer a shared identity from registry attributes.
const PROJECT_NAMESPACE = "561309a6-95ed-4ec1-82de-548293402fac";

export function proposalProjectId(immutableId: string): string {
  const digest = createHash("sha1")
    .update(Buffer.from(PROJECT_NAMESPACE.replaceAll("-", ""), "hex"))
    .update(immutableId)
    .digest();
  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x50;
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80;
  const h = digest.subarray(0, 16).toString("hex");
  return `urn:uuid:${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const id = z.string().min(1);
const projectId = z
  .string()
  .regex(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const lifecycle = z.enum(LIFECYCLE_STATES as [string, ...string[]]);
const unitState = z.enum([
  "pending",
  "active",
  "on_hold",
  "buffer",
  "retired",
  "cancelled",
  "expired",
]);
const actor = z.object({ kind: id, account_id: id.optional() }).strict();
const event = z
  .object({
    event_id: id,
    sequence: z.number().int().positive(),
    effective_at: z.string().datetime({ offset: true }),
    recorded_at: z.string().datetime({ offset: true }),
    actor,
    action: id,
    reason: z.string().optional(),
    from_state: id.nullable(),
    to_state: id,
    is_current: z.boolean(),
  })
  .strict();

export const ProposalDocument = z
  .object({
    profile: z.literal(PROPOSAL_LABEL),
    status: z.literal("proposal"),
    project: z
      .object({
        project_id: projectId,
        project_name: id,
        registry: z.object({ registry_id: id, registry_project_id: id }).strict(),
        lifecycle_stage: lifecycle,
        is_on_hold: z.boolean(),
        authorization: z.object({ status: z.literal("not_reported") }).strict(),
        registry_status: z.object({ code: id, vocabulary: id }).strict(),
        status_history: z.array(event.extend({ lifecycle_stage: lifecycle })).min(1),
      })
      .strict(),
    verifications: z.array(
      z
        .object({
          verification_id: id,
          project_id: projectId,
          status: z.enum([
            "planned",
            "submitted",
            "in_review",
            "changes_requested",
            "completed",
            "rejected",
            "withdrawn",
          ]),
          period_start: z.string().date(),
          period_end: z.string().date(),
          verified_on: z.string().date().optional(),
        })
        .strict(),
    ),
    validations: z.array(z.object({ validation_id: id, project_id: projectId }).strict()),
    issuances: z.array(
      z
        .object({
          issuance_id: id,
          project_id: projectId,
          kind: z.enum(["ex_ante", "ex_post", "conversion", "buffer"]),
          status: z.enum(["pre_issuance", "pending_issuance", "issuing", "complete", "failed"]),
          verification_id: id.optional(),
          validation_id: id.optional(),
          quantity: z.number().nonnegative(),
          unit_of_measure: id,
        })
        .strict(),
    ),
    units: z.array(
      z
        .object({
          unit_id: id,
          project_id: projectId,
          issuance_id: id,
          status: unitState,
          status_reason: z.string().optional(),
          serial_number: id,
          status_history: z
            .array(event.extend({ from_state: unitState.nullable(), to_state: unitState }))
            .min(1),
        })
        .strict(),
    ),
  })
  .strict();

export type Proposal = z.infer<typeof ProposalDocument>;
export const PROPOSAL_SCHEMA = {
  ...z.toJSONSchema(ProposalDocument, { target: "draft-2020-12" }),
  $id: `https://cdop.rethinkcarbon.co.uk/v2/proposals/${PROPOSAL_VERSION}/schema`,
  title: "Rethink identity and lifecycle proposal 0.1.0",
  description:
    "Experimental review profile for FB-010 and FB-012–015. Cross-record links and history continuity are checked by the companion validator.",
};

const ISSUANCE_STATES = {
  "Pre-issuance": "pre_issuance",
  "Pending Issuance": "pending_issuance",
  Issuing: "issuing",
  Complete: "complete",
  Failed: "failed",
} as const;

export function buildProposal(p: ProjectAggregate): Proposal {
  const globalId = proposalProjectId(p.id);
  const history = [...p.statusHistory].sort((a, b) => a.sequence - b.sequence);
  return {
    profile: PROPOSAL_LABEL,
    status: "proposal",
    project: {
      project_id: globalId,
      project_name: p.name,
      registry: { registry_id: p.registry_id, registry_project_id: p.native_project_id },
      lifecycle_stage: p.lifecycle_state,
      is_on_hold: p.is_on_hold,
      // The source aggregate does not report Article 6 authorization. Never infer it from status.
      authorization: { status: "not_reported" },
      registry_status: { code: p.native_state_code, vocabulary: p.standard_id },
      status_history: history.map((s, i) => ({
        event_id: s.id,
        sequence: s.sequence,
        effective_at: s.effective_at.toISOString(),
        // Synthetic seed records are recorded at their effective time, as in db/writer.ts.
        recorded_at: (s.recorded_at ?? s.effective_at).toISOString(),
        actor: {
          kind: s.actor_kind,
          ...(s.actor_account_id ? { account_id: s.actor_account_id } : {}),
        },
        action: s.action ?? "initialise",
        ...(s.reason !== undefined ? { reason: s.reason } : {}),
        from_state: history[i - 1]?.native_state_code ?? null,
        to_state: s.native_state_code,
        lifecycle_stage: s.lifecycle_state,
        is_current: i === history.length - 1,
      })),
    },
    verifications: p.verifications.map((v) => ({
      verification_id: v.id,
      project_id: globalId,
      status: v.status,
      period_start: v.monitoring_period_start_on.toISOString().slice(0, 10),
      period_end: v.monitoring_period_end_on.toISOString().slice(0, 10),
      ...(v.verified_on ? { verified_on: v.verified_on.toISOString().slice(0, 10) } : {}),
    })),
    validations: p.validations.map((v) => ({ validation_id: v.id, project_id: globalId })),
    issuances: p.issuances.map((s) => {
      if (s.status === "Verified")
        throw new Error(`Issuance ${s.id}: Verified is a precondition, not an issuance state`);
      return {
        issuance_id: s.id,
        project_id: globalId,
        kind: s.kind,
        status: ISSUANCE_STATES[s.status],
        ...(s.verification_event_id ? { verification_id: s.verification_event_id } : {}),
        ...(s.validation_event_id ? { validation_id: s.validation_event_id } : {}),
        quantity: s.volume,
        unit_of_measure: s.metric,
      };
    }),
    units: p.blocks.map((u) => {
      const rows = [...u.history].sort((a, b) => a.sequence - b.sequence);
      return {
        unit_id: u.id,
        project_id: globalId,
        issuance_id: u.issuance_id,
        status: u.state,
        ...(u.state_reason !== undefined ? { status_reason: u.state_reason } : {}),
        serial_number: u.serial_number,
        status_history: rows.map((h, i) => ({
          event_id: h.id,
          sequence: h.sequence,
          effective_at: h.effective_at.toISOString(),
          recorded_at: (h.recorded_at ?? h.effective_at).toISOString(),
          actor: {
            kind: h.actor_kind,
            ...(h.actor_account_id ? { account_id: h.actor_account_id } : {}),
          },
          action: h.action,
          ...(h.reason !== undefined ? { reason: h.reason } : {}),
          from_state: h.from_state ?? null,
          to_state: h.to_state,
          is_current: i === rows.length - 1,
        })),
      };
    }),
  };
}

/** Schema validation plus the relationships JSON Schema cannot express. */
export function validateProposal(value: unknown): { valid: boolean; errors: string[] } {
  const parsed = ProposalDocument.safeParse(value);
  if (!parsed.success)
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  const d = parsed.data;
  const errors: string[] = [];
  const checkHistory = (rows: z.infer<typeof event>[], current: string, path: string) => {
    for (const [i, row] of rows.entries()) {
      if (row.sequence !== i + 1)
        errors.push(`${path}: sequences must start at 1 and be contiguous`);
      if (i === 0 && row.from_state !== null)
        errors.push(`${path}: complete history must begin with a null from_state`);
      if (i && row.from_state !== rows[i - 1]?.to_state)
        errors.push(`${path}: broken from/to chain at ${row.sequence}`);
      if (row.is_current !== (i === rows.length - 1))
        errors.push(`${path}: only the last sequence is current`);
    }
    if (rows.at(-1)?.to_state !== current)
      errors.push(`${path}: history does not reach current state`);
  };
  checkHistory(d.project.status_history, d.project.registry_status.code, "project.status_history");
  if (d.project.status_history.at(-1)?.lifecycle_stage !== d.project.lifecycle_stage)
    errors.push("project: history does not reach current lifecycle stage");
  const ids = new Set<string>();
  const unique = (key: string) => {
    if (ids.has(key)) errors.push(`duplicate id: ${key}`);
    ids.add(key);
  };
  for (const s of d.project.status_history) unique(s.event_id);
  const verifications = new Map(d.verifications.map((v) => [v.verification_id, v]));
  const validations = new Set(d.validations.map((v) => v.validation_id));
  const issuances = new Set(d.issuances.map((s) => s.issuance_id));
  for (const row of [...d.verifications, ...d.validations, ...d.issuances, ...d.units]) {
    if (row.project_id !== d.project.project_id)
      errors.push("foreign project_id in related record");
  }
  for (const v of d.verifications) {
    unique(v.verification_id);
    if (v.period_end < v.period_start)
      errors.push(`${v.verification_id}: reversed monitoring period`);
    if (v.status === "completed" && !v.verified_on)
      errors.push(`${v.verification_id}: completed verification needs verified_on`);
  }
  for (const v of d.validations) unique(v.validation_id);
  for (const s of d.issuances) {
    unique(s.issuance_id);
    if (s.verification_id && !verifications.has(s.verification_id))
      errors.push(`${s.issuance_id}: missing verification`);
    if (s.validation_id && !validations.has(s.validation_id))
      errors.push(`${s.issuance_id}: missing validation`);
    if (
      s.status === "complete" &&
      ["ex_post", "conversion"].includes(s.kind) &&
      (!s.verification_id || verifications.get(s.verification_id)?.status !== "completed")
    )
      errors.push(`${s.issuance_id}: completed ex-post issuance needs a completed verification`);
  }
  for (const u of d.units) {
    unique(u.unit_id);
    if (!issuances.has(u.issuance_id)) errors.push(`${u.unit_id}: missing issuance`);
    for (const h of u.status_history) unique(h.event_id);
    checkHistory(u.status_history, u.status, `units.${u.unit_id}.status_history`);
  }
  return { valid: errors.length === 0, errors };
}
