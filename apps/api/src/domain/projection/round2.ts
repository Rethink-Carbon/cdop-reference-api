/**
 * ProjectAggregate → the three Round 2 draft pods (Registry, Validation and Verification
 * Metadata), vendored from the upstream `R2P-FT-Testing` branch and pinned in
 * UPSTREAM-ROUND2.json. They are drafts, not part of CDOP v2.0, and are not subsets of the
 * published Full List, so each has its own builder over the same aggregate.
 *
 * Deviations and gaps are numbered in SCHEMA-FEEDBACK.md:
 *  - CDOP-FB-032: registry and program identifiers are integers; the API emits the 1-based
 *    position in its own vocabulary, stable across seeds, and keeps the slug in the HAL resource.
 *  - CDOP-FB-034: sibling arrays carry no event key, so `validation.date[]`, `report[]` and
 *    `stage[]` follow `validation_event[]` index for index.
 *  - CDOP-FB-035, 038, 039: required values no registry publishes are reported as missing, or
 *    filled with flagged placeholders under `strict`.
 */
import type { PodName } from "@cdop/schemas";
import type { ProjectAggregate, ValidationEvent, VerificationEvent } from "../../seed/aggregate.js";
import { PROGRAMS, REGISTRIES } from "../../seed/vocab.js";
import { documentUrl, type ProjectionContext } from "./context.js";

export interface Round2Options {
  /** Fill required-but-unpublished fields with flagged placeholders so more documents validate. */
  strict?: boolean | undefined;
  /** Verification Metadata describes one verification event (default: the latest completed). */
  verificationId?: string | undefined;
}

export interface Round2Result {
  pod: PodName;
  document: Record<string, unknown>;
  missing: string[];
  placeholders: string[];
}

export const ROUND2_PLACEHOLDER = "Not published";

const iso = (d: Date | undefined): string | undefined =>
  d ? d.toISOString().slice(0, 10) : undefined;

/** Drop undefined and empty-array properties. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) delete obj[k];
  }
  return obj;
}

/** Collects what the source data could not supply, the way buildFullList does. */
function gaps(strict: boolean) {
  const missing: string[] = [];
  const placeholders: string[] = [];
  return {
    missing,
    placeholders,
    /** A required value: the real one, a flagged placeholder (strict), or reported missing. */
    text(path: string, value: string | undefined): string | undefined {
      if (value !== undefined) return value;
      if (strict) {
        if (!placeholders.includes(path)) placeholders.push(path);
        return ROUND2_PLACEHOLDER;
      }
      if (!missing.includes(path)) missing.push(path);
      return undefined;
    },
    /** A required value with no honest placeholder (dates, quantities, enum members). */
    absent<T>(path: string, value: T | undefined): T | undefined {
      if (value === undefined && !missing.includes(path)) missing.push(path);
      return value;
    },
  };
}

/** 1-based position of a vocabulary entry: the integer the draft schemas require (CDOP-FB-032). */
function ordinal(list: readonly { id: string }[], id: string): number | undefined {
  const i = list.findIndex((x) => x.id === id);
  return i >= 0 ? i + 1 : undefined;
}

function registryProjectUrl(agg: ProjectAggregate, ctx: ProjectionContext): string | undefined {
  const registry = ctx.registry(agg.registry_id);
  return (
    agg.native_project_url ??
    registry?.project_url_template
      ?.replace("{native_project_id}", agg.native_project_id)
      .replace("{standard}", agg.standard_id) ??
    registry?.url
  );
}

// ---------------------------------------------------------------------------------------------
// Registry Metadata (fields 261 to 270)

export function buildRegistryMetadata(
  agg: ProjectAggregate,
  ctx: ProjectionContext,
  opts: Round2Options = {},
): Round2Result {
  const g = gaps(opts.strict ?? false);
  const registry = ctx.registry(agg.registry_id);
  const program = ctx.program(agg.crediting_program_id);
  const current = {
    registry_identifier: ordinal(REGISTRIES, agg.registry_id),
    registry_name: registry?.cdop_name,
    registry_link: registryProjectUrl(agg, ctx),
  };
  const document = {
    registry: compact({
      identification: [compact({ ...current })],
      // No project in the dataset has changed registry, so the original registry is the current
      // one. The draft requires it anyway (CDOP-FB-033).
      original: [
        compact({
          original_registry_identifier: current.registry_identifier,
          original_registry_name: current.registry_name,
          original_registry_link: current.registry_link,
        }),
      ],
      program: [
        compact({
          program_identifier: ordinal(PROGRAMS, agg.crediting_program_id),
          program_name: program?.cdop_name,
        }),
      ],
      // "Date that the project was first registered": registration, else first listing.
      creation_date: g.absent(
        "registry.creation_date",
        iso(agg.registered_on ?? agg.listed_on ?? agg.created_at),
      ),
      // Date only, as the draft types it; the HAL resource carries the full timestamp.
      update_date: iso(agg.modified_at),
    }),
  };
  return { pod: "registry-metadata", document, missing: g.missing, placeholders: g.placeholders };
}

// ---------------------------------------------------------------------------------------------
// Validation Metadata (fields 271 to 306)

/**
 * CDM sectoral scopes as the draft lists them. Only afforestation, reforestation and agriculture
 * have a land-use scope; REDD+, improved forest management, wetland and peatland restoration and
 * biochar have none (CDOP-FB-038).
 */
const SECTORAL_SCOPE_BY_METHODOLOGY: Record<string, string> = {
  "wcc-carbon-calculator": "14. Afforestation and reforestation",
  "vcs-vm0047": "14. Afforestation and reforestation",
  "gs-ar-am0001": "14. Afforestation and reforestation",
  "plan-vivo-agroforestry": "14. Afforestation and reforestation",
  "vcs-vm0042": "15. Agriculture",
};

const VALIDATION_STAGES = [
  "Desk review",
  "On-site audits and interviews",
  "Public comment period",
  "Resolution of findings",
  "Final validation report issued",
] as const;

/** Stages a validation has reached, derived from its status and site-visit dates. */
function stagesReached(v: ValidationEvent): string[] {
  switch (v.status) {
    case "planned":
      return [];
    case "submitted":
      return ["Desk review"];
    case "in_review":
      return v.site_visit_start_on
        ? ["Desk review", "On-site audits and interviews"]
        : ["Desk review"];
    case "changes_requested":
      return [
        "Desk review",
        ...(v.site_visit_start_on ? ["On-site audits and interviews"] : []),
        "Resolution of findings",
      ];
    case "completed":
      return [...VALIDATION_STAGES];
    default:
      // rejected, expired, withdrawn: the review happened, no report was issued.
      return v.decided_on ? ["Desk review", "Resolution of findings"] : ["Desk review"];
  }
}

function stageStatus(v: ValidationEvent): "Not started" | "In progress" | "Completed" {
  if (v.status === "planned") return "Not started";
  if (["completed", "rejected", "expired", "withdrawn"].includes(v.status)) return "Completed";
  return "In progress";
}

export function buildValidationMetadata(
  agg: ProjectAggregate,
  ctx: ProjectionContext,
  opts: Round2Options = {},
): Round2Result {
  const g = gaps(opts.strict ?? false);
  const events = [...agg.validations].sort((a, b) => a.sequence - b.sequence);
  const current = [...events].reverse().find((v) => v.status === "completed") ?? events.at(-1);
  const period = agg.creditingPeriods.find((c) => c.is_current) ?? agg.creditingPeriods.at(-1);
  const mv = ctx.methodologyVersion(agg.methodology_version_id);
  const scope = mv ? SECTORAL_SCOPE_BY_METHODOLOGY[mv.methodology_id] : undefined;

  const reportLink = (v: ValidationEvent): string | undefined =>
    v.report_document_id ? documentUrl(ctx, agg.id, v.report_document_id) : v.report_url;

  const validation = compact({
    crediting_period: period
      ? [
          {
            current_crediting_period_end_date: iso(period.end_on),
            current_crediting_period_number: period.number,
            current_crediting_period_start_date: iso(period.start_on),
          },
        ]
      : [],
    // One row per validation event, in event order: the draft gives the arrays no shared key.
    date: events.map((v) =>
      compact({
        date_validation_expiration: g.absent(
          "validation.date.date_validation_expiration",
          iso(v.expires_on ?? agg.validation_deadline_on),
        ),
        date_validation_planned: g.absent(
          "validation.date.date_validation_planned",
          iso(v.site_visit_start_on),
        ),
        date_validation_requested: g.absent(
          "validation.date.date_validation_requested",
          iso(v.submitted_on),
        ),
      }),
    ),
    validation_event: events.map((v) =>
      compact({
        validation_id: v.sequence,
        validation_type: "Project validation",
        validation_date: g.absent(
          "validation.validation_event.validation_date",
          iso(v.decided_on ?? v.site_visit_start_on ?? v.submitted_on),
        ),
        validation_is_planned: v.status === "planned",
        validation_period_end_date: g.absent(
          "validation.validation_event.validation_period_end_date",
          iso(v.decided_on ?? v.site_visit_end_on ?? v.site_visit_start_on),
        ),
        validation_period_start_date: g.absent(
          "validation.validation_event.validation_period_start_date",
          iso(v.submitted_on ?? v.site_visit_start_on),
        ),
      }),
    ),
    report: events.map((v) =>
      compact({
        validation_report_link: reportLink(v),
        validation_report_summary: v.notes,
      }),
    ),
    stage: current
      ? stagesReached(current).length
        ? [{ validation_stages: stagesReached(current) }]
        : []
      : [],
  });

  const reached = current ? stagesReached(current) : [];
  const project = compact({
    validation_stage: current
      ? [
          {
            current_validation_stage: reached.at(-1) ?? VALIDATION_STAGES[0],
            current_validation_stage_status: stageStatus(current),
          },
        ]
      : [],
    date: events
      .filter((v) => v !== current && v.status === "completed" && v.decided_on)
      .map((v) => ({ date_previous_validation: iso(v.decided_on) })),
    validation_status: current?.status === "completed",
  });

  const bodies = [
    ...new Set(events.map((v) => v.vvb_organisation_id ?? agg.vvb_organisation_id)),
  ].flatMap((id) => {
    const org = ctx.org(id);
    if (!org) return [];
    return [
      compact({
        validation_body_id: org.id,
        validation_body_name: org.legal_name,
        validator_name: g.text("validation_body.details.validator_name", undefined),
        validation_body_sectoral_scopes: g.absent(
          "validation_body.details.validation_body_sectoral_scopes",
          scope ? [scope] : undefined,
        ),
        validation_body_selection: g.text(
          "validation_body.details.validation_body_selection",
          undefined,
        ),
        validation_body_team_members_and_roles: g.text(
          "validation_body.details.validation_body_team_members_and_roles",
          undefined,
        ),
      }),
    ];
  });

  const document = {
    validation,
    project,
    validation_body: compact({ details: bodies }),
  };
  return {
    pod: "validation-metadata",
    document,
    missing: g.missing,
    placeholders: g.placeholders,
  };
}

// ---------------------------------------------------------------------------------------------
// Verification Metadata (fields 307 to 330)

const CLAIM_TYPE: Record<string, string> = {
  CARBON_REMOVAL: "Carbon removal",
  EMISSION_REDUCTION: "Emission reduction",
  EMISSION_AVOIDANCE: "Emission avoidance",
};

const QUANTITY_UOM: Record<string, string> = {
  tCO2e: "tCO2e (Metric tonnes of CO2 equivalent)",
  kgCO2e: "kgCO2e (Kilograms of CO2 equivalent)",
};

function auditStatus(v: VerificationEvent): string | undefined {
  if (v.status === "completed")
    return v.opinion === "negative"
      ? "Fail (Non-compliant / verification rejected)"
      : v.opinion === "qualified"
        ? "Pass with reservations (Approved, but with Forward Action Requests / FARs)"
        : "Pass (Fully compliant with zero reserves)";
  if (v.status === "rejected") return "Fail (Non-compliant / verification rejected)";
  if (v.status === "changes_requested")
    return "Requires corrective action (On hold pending CAR resolution)";
  if (["planned", "submitted", "in_review"].includes(v.status))
    return "Pending review (Audit currently in progress)";
  return undefined;
}

/** The verification a project-level Verification Metadata document describes. */
export function selectVerification(
  agg: ProjectAggregate,
  verificationId?: string,
): VerificationEvent | undefined {
  if (verificationId) return agg.verifications.find((v) => v.id === verificationId);
  const ordered = [...agg.verifications].sort((a, b) => a.sequence - b.sequence);
  return [...ordered].reverse().find((v) => v.status === "completed") ?? ordered.at(-1);
}

export function buildVerificationMetadata(
  agg: ProjectAggregate,
  ctx: ProjectionContext,
  opts: Round2Options = {},
): Round2Result {
  const g = gaps(opts.strict ?? false);
  const v = selectVerification(agg, opts.verificationId);
  if (!v) {
    g.missing.push("verification");
    return { pod: "verification-metadata", document: {}, missing: g.missing, placeholders: [] };
  }
  const standard = ctx.standard(agg.standard_id);
  const standardVersion = ctx.standardVersion(agg.standard_version_id);
  const mv = ctx.methodologyVersion(agg.methodology_version_id);
  const vvb = ctx.org(v.vvb_organisation_id ?? agg.vvb_organisation_id);
  const verified =
    v.gross_verified_quantity === undefined
      ? undefined
      : v.gross_verified_quantity -
        v.leakage_deduction -
        v.buffer_deduction -
        v.uncertainty_deduction;
  // The draft says "percentage or absolute"; the API always sends the percentage (CDOP-FB-040).
  const uncertaintyPercent =
    v.uncertainty_basis === "percentage"
      ? v.uncertainty_margin
      : v.gross_verified_quantity
        ? Math.round((v.uncertainty_deduction / v.gross_verified_quantity) * 10000) / 100
        : undefined;
  const period = `${iso(v.monitoring_period_start_on)} to ${iso(v.monitoring_period_end_on)}`;

  const verification = compact({
    verification_id: v.id,
    verification_vvb_id: vvb ? [vvb.id] : [],
    details: [
      compact({
        verification_claim_type: g.absent(
          "verification.details.verification_claim_type",
          CLAIM_TYPE[v.claim_type],
        ),
        verification_description: `Verification ${v.sequence} of ${agg.name}, covering the monitoring period ${period}.`,
      }),
    ],
    verification_project_id: agg.native_project_id,
    reporting: [
      compact({
        verification_reporting_period_start: iso(v.monitoring_period_start_on),
        verification_reporting_period_end: iso(v.monitoring_period_end_on),
        verification_date: g.absent("verification.reporting.verification_date", iso(v.verified_on)),
      }),
    ],
    quantity: [
      compact({
        verified_quantity: g.absent("verification.quantity.verified_quantity", verified),
        verification_quantity_uom: g.absent(
          "verification.quantity.verification_quantity_uom",
          QUANTITY_UOM[v.uom],
        ),
      }),
    ],
    standard: standard
      ? [
          compact({
            verification_applied_standard: standardVersion
              ? `${standard.cdop_name} v${standardVersion}`
              : standard.cdop_name,
            verification_applied_methodology_protocol: mv
              ? `${mv.cdop_name} v${mv.version}`
              : undefined,
          }),
        ]
      : [],
    verification_report_url: [
      v.report_document_id
        ? documentUrl(ctx, agg.id, v.report_document_id)
        : (v.report_url ?? `${ctx.baseUrl}/v2/projects/${agg.id}/verifications/${v.id}`),
    ],
    // No registry in the dataset issues verifiable credentials (CDOP-FB-039).
    verification_credential_issuer_id: g.text(
      "verification.verification_credential_issuer_id",
      undefined,
    ),
    deductions:
      verified === undefined
        ? []
        : [
            compact({
              verification_leakage_risk_mitigation: v.leakage_deduction > 0,
              verification_leakage_deduction_quantity: v.leakage_deduction,
              verification_uncertainty_deduction_margin: uncertaintyPercent,
              verification_buffer_pool_deduction_quantity: v.buffer_deduction,
            }),
          ],
    status: [
      compact({
        verification_audit_checkpoint_status: auditStatus(v),
        is_current: true,
      }),
    ],
  });

  return {
    pod: "verification-metadata",
    document: { verification },
    missing: g.missing,
    placeholders: g.placeholders,
  };
}

export function buildRound2Document(
  agg: ProjectAggregate,
  ctx: ProjectionContext,
  pod: PodName,
  opts: Round2Options = {},
): Round2Result {
  switch (pod) {
    case "registry-metadata":
      return buildRegistryMetadata(agg, ctx, opts);
    case "validation-metadata":
      return buildValidationMetadata(agg, ctx, opts);
    case "verification-metadata":
      return buildVerificationMetadata(agg, ctx, opts);
    default:
      throw new Error(`${pod} is not a Round 2 pod`);
  }
}
