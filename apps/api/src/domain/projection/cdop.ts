/**
 * ProjectAggregate → CDOP v2 documents. One builder produces the Full List shape; pod
 * documents are the Full List pruned to the keys that pod's schema declares, so every pod is
 * guaranteed to follow its own structure without a second mapping.
 *
 * Deviations from the schema are deliberate and numbered in SCHEMA-FEEDBACK.md:
 *  - CDOP-FB-002/003: the spaced "crediting period" group is not emitted; the mangled
 *    `credit_blockblock_start` is emitted alongside a proper `credit_block[]`.
 *  - CDOP-FB-005: `unit`/`vintage` are per-block, so a project-level Full List carries the
 *    selected block (default: most recently issued) or none; absent sections are omitted unless
 *    `strict` fills placeholders.
 */
import {
  SCHEMA_FILES,
  loadSchema,
  validatePayload,
  type JsonSchema,
  type PodName,
  type ValidationResult,
} from "@cdop/schemas";
import type { ProjectAggregate, UnitBlock } from "../../seed/aggregate.js";
import { SDG_NAMES } from "../../seed/vocab.js";
import type { ProjectionContext } from "./context.js";

export interface ProjectionOptions {
  /** Which block to render as `unit`/`vintage` (default: most recently issued active/pending block). */
  unitId?: string | undefined;
  /** Fill required-but-unavailable fields with flagged placeholders so the document validates. */
  strict?: boolean | undefined;
}

export interface ProjectionResult {
  pod: PodName;
  document: Record<string, unknown>;
  /** Sections/fields the source data could not supply (informational, also sent as a header). */
  missing: string[];
  placeholders: string[];
}

const iso = (d: Date | undefined): string | undefined =>
  d ? d.toISOString().slice(0, 10) : undefined;
const isoTs = (d: Date | undefined): string | undefined => (d ? d.toISOString() : undefined);

function compact<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined || v === null) delete obj[k];
    else if (Array.isArray(v) && v.length === 0 && !KEEP_EMPTY_ARRAYS.has(k)) delete obj[k];
  }
  return obj;
}
const KEEP_EMPTY_ARRAYS = new Set(["compliance_market_id", "status_reason", "previous"]);

/** `unit.unit_level[].unit_level_accreditation` is a one-value enum. */
const UNIT_LEVEL_ACCREDITATIONS = new Set(["CCP"]);

/** The CORSIA phases are "approved" at standard level but "scope" at unit level (CDOP-FB-029). */
function unitLevelValue(value: string): string {
  return value.startsWith("CORSIA ") ? value.replace(" approved ", " scope ") : value;
}

export function documentUrl(ctx: ProjectionContext, projectId: string, documentId: string): string {
  return `${ctx.baseUrl}/v2/projects/${projectId}/documents/${documentId}/content`;
}

export function geoFileUrl(ctx: ProjectionContext, projectId: string, fileId: string): string {
  return `${ctx.baseUrl}/v2/projects/${projectId}/geolocation-files/${fileId}/content`;
}

function pickBlock(agg: ProjectAggregate, unitId: string | undefined): UnitBlock | undefined {
  if (unitId) return agg.blocks.find((b) => b.id === unitId);
  const preferred = agg.blocks.filter((b) => b.state === "active" || b.state === "pending");
  const pool = preferred.length ? preferred : agg.blocks;
  return [...pool].sort(
    (a, b) =>
      b.vintage_start_on.getTime() - a.vintage_start_on.getTime() ||
      a.serial_number.localeCompare(b.serial_number),
  )[0];
}

function attestation(agg: ProjectAggregate, key: string): boolean | undefined {
  const v = agg.attestations[key];
  return typeof v === "boolean" ? v : undefined;
}
function attestationDoc(
  agg: ProjectAggregate,
  ctx: ProjectionContext,
  key: string,
): string | undefined {
  const v = agg.attestations[key];
  if (typeof v !== "string" || !v) return undefined;
  return v.startsWith("http") ? v : documentUrl(ctx, agg.id, v);
}

function locationRows(
  rows: ProjectAggregate["locations"],
  kind: "project" | "facility",
): Record<string, unknown>[] {
  return rows
    .filter((l) => l.kind === kind)
    .map((l) =>
      compact({
        country_code: l.country_code,
        country_name: l.country_name,
        geographical_region_code: l.region_code,
        geographical_region_name: l.region_name,
        address_line_1: l.address_line_1,
        address_line_2: l.address_line_2,
        alternative_address: l.alternative_address,
        country_subdivision_code: l.subdivision_code,
        country_subdivision_name: l.subdivision_name,
        city: l.city,
        postal_code: l.postal_code,
      }),
    );
}

/** Build the Full List document. */
export function buildFullList(
  agg: ProjectAggregate,
  ctx: ProjectionContext,
  opts: ProjectionOptions = {},
): ProjectionResult {
  const missing: string[] = [];
  const placeholders: string[] = [];
  const strict = opts.strict ?? false;
  const registry = ctx.registry(agg.registry_id);
  const program = ctx.program(agg.crediting_program_id);
  const standard = ctx.standard(agg.standard_id);
  const developer = ctx.org(agg.developer_organisation_id);
  const vvb = ctx.org(agg.vvb_organisation_id);
  const currentEstimation =
    agg.estimations.find((e) => e.is_current) ?? agg.estimations[agg.estimations.length - 1];
  const validation =
    [...agg.validations].filter((v) => v.status === "completed").pop() ??
    agg.validations[agg.validations.length - 1];
  const registryProjectUrl =
    agg.native_project_url ??
    registry?.project_url_template
      ?.replace("{native_project_id}", agg.native_project_id)
      .replace("{standard}", agg.standard_id);
  const pdd = agg.documents.find(
    (d) => d.document_type_id.endsWith(":100000000000099") || d.document_type_id === "generic:pdd",
  );
  const bufferBalance = agg.bufferEntries.reduce(
    (acc, e) => {
      if (e.kind === "deposit") acc.deposits += e.quantity;
      else if (e.kind === "release") acc.release += e.quantity;
      else if (e.kind === "reversal_coverage") acc.coverage += e.quantity;
      else if (e.kind === "reversal_non_coverage") acc.nonCoverage += e.quantity;
      return acc;
    },
    { deposits: 0, release: 0, coverage: 0, nonCoverage: 0 },
  );

  const requireText = (
    path: string,
    value: string | undefined,
    placeholder: string,
  ): string | undefined => {
    if (value !== undefined) return value;
    if (strict) {
      placeholders.push(path);
      return placeholder;
    }
    missing.push(path);
    return undefined;
  };
  const requireBool = (path: string, value: boolean | undefined): boolean | undefined => {
    if (value !== undefined) return value;
    if (strict) {
      placeholders.push(path);
      return false;
    }
    missing.push(path);
    return undefined;
  };

  const project: Record<string, unknown> = compact({
    location: locationRows(agg.locations, "project"),
    project_name: agg.name,
    project_id_type: "current registry project id",
    project_id: agg.native_project_id,
    project_description: requireText(
      "project.project_description",
      agg.description,
      "Description not published by the registry.",
    ),
    project_design_document_link: pdd ? documentUrl(ctx, agg.id, pdd.id) : undefined,
    program_type: agg.program_type,
    activity_type: agg.activity_type,
    mitigation: agg.mitigations.map((m) =>
      compact({
        mitigation_type: m.mitigation_type,
        project_sector: m.project_sector,
        project_type: m.project_type,
        estimated_annual_emissions_mitigation: m.estimated_annual_mitigation,
        estimated_total_emissions_mitigation: m.estimated_total_mitigation,
      }),
    ),
    current_registry_project_link: registryProjectUrl,
    status: agg.statusHistory.map((s) =>
      compact({
        project_status: s.cdop_project_status,
        project_status_reason: s.reason ?? s.action,
        is_current: s.is_current,
      }),
    ),
    project_registration_date: iso(agg.registered_on),
    project_list_date: iso(agg.listed_on ?? agg.created_at),
    documents: agg.documents
      .filter((d) => CDOP_DOC_TYPE_BY_ID.get(d.document_type_id))
      .map((d) => ({
        other_project_documentation_type: CDOP_DOC_TYPE_BY_ID.get(d.document_type_id),
        other_project_documentation_link: documentUrl(ctx, agg.id, d.id),
      })),
    project_identifier: agg.project_identifier,
    audits: agg.verifications
      .filter((v) => v.status === "completed" && v.verified_on)
      .map((v) =>
        compact({
          auditor_name:
            ctx.org(v.vvb_organisation_id)?.legal_name ??
            vvb?.legal_name ??
            "Verification body not published",
          auditor_site_visit_start_date: iso(
            v.site_visit_start_on ?? v.submitted_on ?? v.verified_on,
          ),
          auditor_site_visit_end_date: iso(
            v.site_visit_end_on ?? v.site_visit_start_on ?? v.submitted_on ?? v.verified_on,
          ),
          verification_report_url: v.report_document_id
            ? documentUrl(ctx, agg.id, v.report_document_id)
            : (v.report_url ?? `${ctx.baseUrl}/v2/projects/${agg.id}/verifications/${v.id}`),
          verification_report_date: iso(v.verified_on),
        }),
      ),
    attestations: ["child_labor", "labor_worker", "land_ownership", "human_rights"]
      .filter((k) => attestation(agg, `${k}_attestation`) === true)
      .map((k) => ATTESTATION_ENUM[k]),
    carbon_concession_contract_length: attestation(agg, "carbon_concession_contract_length"),
    carbon_concession_contract: attestationDoc(agg, ctx, "carbon_concession_contract"),
    carbon_credit_ownership_attestation: requireBool(
      "project.carbon_credit_ownership_attestation",
      attestation(agg, "carbon_credit_ownership_attestation"),
    ),
    carbon_credit_ownership_documentation: requireText(
      "project.carbon_credit_ownership_documentation",
      attestationDoc(agg, ctx, "carbon_credit_ownership_documentation"),
      `${ctx.baseUrl}/problems/not-published`,
    ),
    child_labor_attestation: attestation(agg, "child_labor_attestation"),
    child_labor_documentation: attestationDoc(agg, ctx, "child_labor_documentation"),
    community_frameworks: agg.community_frameworks,
    cultural_site_borders: attestation(agg, "cultural_site_borders"),
    cultural_site_designation: attestation(agg, "cultural_site_designation"),
    labor_worker_attestation: attestation(agg, "labor_worker_attestation"),
    labor_worker_documentation: attestationDoc(agg, ctx, "labor_worker_documentation"),
    land_right_attestation: attestation(agg, "land_right_attestation"),
    land_rights_documentation: attestationDoc(agg, ctx, "land_rights_documentation"),
    land_ownership_attestation: attestation(agg, "land_ownership_attestation"),
    land_ownership_documentation: attestationDoc(agg, ctx, "land_ownership_documentation"),
    legal_compliance_attestation: requireBool(
      "project.legal_compliance_attestation",
      attestation(agg, "legal_compliance_attestation"),
    ),
    legal_compliance_documentation: requireText(
      "project.legal_compliance_documentation",
      attestationDoc(agg, ctx, "legal_compliance_documentation"),
      `${ctx.baseUrl}/problems/not-published`,
    ),
    previous_project_crediting_program: agg.previous_program ?? false,
    project_governance_structure: requireText(
      "project.project_governance_structure",
      agg.governance_structure,
      "Governance structure not published by the registry.",
    ),
    public_comment: agg.public_comment,
    public_comment_summary: agg.public_comment_summary,
    current_registry_project_id: agg.native_project_id,
    crediting_period: agg.crediting_period_type
      ? [
          compact({
            project_crediting_period_type: agg.crediting_period_type,
            maximum_cumulative_crediting_duration: agg.max_cumulative_crediting_years,
            maximum_number_of_crediting_periods: agg.max_crediting_periods,
          }),
        ]
      : [],
    estimated_total_years:
      agg.estimated_total_years ??
      agg.duration_years ??
      currentEstimation?.total_years ??
      (strict
        ? (placeholders.push("project.estimated_total_years"), 0)
        : (missing.push("project.estimated_total_years"), undefined)),
    buffer_pool: agg.bufferEntries.length
      ? [
          {
            buffer_pool_deposits: Math.round(bufferBalance.deposits),
            buffer_pool_release: Math.round(bufferBalance.release),
            buffer_pool_reversal_coverage: Math.round(bufferBalance.coverage),
            buffer_pool_reversal_non_coverage: Math.round(bufferBalance.nonCoverage),
          },
        ]
      : [],
    project_risk: agg.project_risk ? JSON.stringify(agg.project_risk) : undefined,
    financing_options: agg.finance?.financing_options ?? [],
    costs_and_revenue:
      agg.finance && agg.finance.expected_initial_costs !== undefined
        ? [
            {
              expected_initial_costs: agg.finance.expected_initial_costs,
              expected_annual_costs: agg.finance.expected_annual_costs ?? 0,
              expected_annual_revenue: agg.finance.expected_annual_revenue ?? 0,
            },
          ]
        : [],
    declaring_entity_name: requireText(
      "project.declaring_entity_name",
      ctx.org(agg.finance?.declaring_entity_organisation_id)?.legal_name ?? developer?.legal_name,
      "Not declared",
    ),
    community_benefit_mechanism_type: agg.finance?.community_benefit_mechanisms ?? [],
    funding:
      agg.finance && agg.finance.total_funding_required !== undefined
        ? [
            {
              project_total_funding_required: agg.finance.total_funding_required,
              project_total_funding_secured: agg.finance.total_funding_secured ?? 0,
            },
          ]
        : [],
    compliance_market_id: agg.labels
      .filter((l) => l.kind === "compliance_eligibility")
      .map((l) => l.accreditation_id ?? l.label_id),
    other: [],
    project_level: agg.labels
      .filter((l) => l.kind !== "compliance_potential")
      .map((l) => {
        const label = ctx.label(l.label_id);
        return compact({
          project_level_accreditation:
            l.kind === "accreditation" ? label?.cdop_enum_value : undefined,
          project_level_accreditation_start_date: iso(
            l.start_on ?? l.approved_on ?? agg.validated_on ?? agg.created_at,
          ),
          project_level_accreditation_expiry_date: iso(
            l.expiry_on ?? new Date(Date.UTC(2100, 0, 1)),
          ),
          project_level_accreditation_website:
            l.url ?? label?.url ?? `${ctx.baseUrl}/v2/reference/labels`,
          project_level_compliance_eligibility:
            l.kind === "compliance_eligibility" ? label?.cdop_enum_value : undefined,
          project_level_compliance_approval_date: iso(
            l.approved_on ?? l.start_on ?? agg.validated_on ?? agg.created_at,
          ),
        });
      }),
  });

  const stakeholders = agg.stakeholders.filter((s) => !s.is_primary_developer);
  const project_stakeholder: Record<string, unknown> = compact({
    location: developer
      ? [
          compact({
            country_code: developer.country_code,
            country_name: developer.country_name,
            geographical_region_code: developer.region_code,
            geographical_region_name: developer.region_name,
            address_line_1: developer.address_line_1,
            country_subdivision_code: developer.subdivision_code,
            country_subdivision_name: developer.subdivision_name,
            city: developer.city,
            postal_code: developer.postal_code,
          }),
        ]
      : [],
    project_developer_name: requireText(
      "project_stakeholder.project_developer_name",
      developer?.legal_name,
      "Developer not published",
    ),
    project_developer_website: developer?.website,
    project_developer_email: developer?.email,
    project_developer_phone: developer?.phone,
    stakeholders: stakeholders.map((s) => {
      const org = ctx.org(s.organisation_id);
      return compact({
        project_stakeholder_type: s.stakeholder_type,
        project_stakeholder_name: org?.legal_name ?? s.organisation_id,
        project_stakeholder_website: org?.website,
        project_stakeholder_email: org?.email,
        project_stakeholder_phone: org?.phone,
      });
    }),
    list_of_landowners: agg.landowners,
    organization: developer
      ? [
          compact({
            organization_team_experience: developer.team_experience ?? "Not published",
            organization_role: developer.cdop_role ?? "Project developer",
            organization_project_employees: developer.project_employees ?? 0,
            organization_employees: developer.employees ?? 0,
            organization_founding_year: iso(developer.founded_on) ?? "1970-01-01",
            organization_mission: developer.mission ?? "Not published",
            organization_legal_name: developer.legal_name,
            organization_project_experience: developer.project_experience_years ?? 0,
            organization_url: developer.website ?? `${ctx.baseUrl}/v2/accounts`,
          }),
        ]
      : [],
    expected_community_proceeds: agg.finance?.expected_community_proceeds,
    counterparty: agg.agreements.flatMap((a) =>
      a.counterparties.map((c) =>
        compact({
          agreement_counterparty_sector: c.sector,
          agreement_counterparty_name: ctx.org(c.organisation_id)?.legal_name,
          agreement_counterparty_role: c.role,
        }),
      ),
    ),
  });

  const facility: Record<string, unknown> = { location: locationRows(agg.locations, "facility") };
  if ((facility.location as unknown[]).length === 0) delete facility.location;

  const geolocation_file: Record<string, unknown> = {
    location: agg.geolocationFiles.map((g) =>
      compact({
        file_name: g.file_name,
        file_format: g.file_format,
        validity_start_date: iso(g.validity_start_on),
        validity_end_date: iso(g.validity_end_on),
        file_status: g.file_status,
        file_created_on: isoTs(g.file_created_at),
        file_edited_on: isoTs(g.file_edited_at),
        file_deleted_on: isoTs(g.file_deleted_at),
        area_type: g.area_type,
        geometry_type: g.geometry_type,
      }),
    ),
  };

  const crediting_program: Record<string, unknown> = compact({
    crediting_program: program
      ? [{ crediting_program_name: program.cdop_name, is_current: true }]
      : [],
    standard: standard ? [{ standard_name: standard.cdop_name, is_current: true }] : [],
    initial_standard_version: standard?.versions[0],
    current_standard_version:
      ctx.standardVersion(agg.standard_version_id) ??
      standard?.versions[standard.versions.length - 1],
  });

  const mv = ctx.methodologyVersion(agg.methodology_version_id);
  const methodology: Record<string, unknown> = {
    versions: mv
      ? [
          compact({
            methodology: mv.cdop_name,
            version: mv.version,
            is_current: true,
            document: mv.document_url,
          }),
        ]
      : [],
  };

  const registryDoc: Record<string, unknown> = compact({
    origin_registry: registry?.cdop_name,
    current_registry: registry?.cdop_name,
    previous: [],
    current_project_issuance_registry: registry?.cdop_name,
  });

  const validationDoc: Record<string, unknown> = compact({
    validation_body_name: ctx.org(validation?.vvb_organisation_id)?.legal_name ?? vvb?.legal_name,
    validation_date: iso(validation?.decided_on),
    validation_report: validation?.report_document_id
      ? documentUrl(ctx, agg.id, validation.report_document_id)
      : validation?.report_url,
    validation: agg.validations
      .filter((v) => v.crediting_period_id)
      .map((v) => {
        const cp = agg.creditingPeriods.find((c) => c.id === v.crediting_period_id);
        return cp
          ? {
              validation_id: v.sequence,
              current_crediting_period_start_date: iso(cp.start_on),
              current_crediting_period_end_date: iso(cp.end_on),
              current_crediting_period_number: cp.number,
            }
          : undefined;
      })
      .filter(Boolean),
    event: agg.validations.map((v) => ({
      validation_id: v.sequence,
      validation_type: v.validation_type,
    })),
  });

  const issuance: Record<string, unknown> = {
    issuance: agg.issuances.map((i) => {
      const ver = agg.verifications.find((v) => v.id === i.verification_event_id);
      return compact({
        batch_identifier: i.batch_identifier,
        issuance_url: i.url ?? `${ctx.baseUrl}/v2/issuances/${i.id}`,
        date_of_issuance: iso(i.issued_on),
        date_of_verification: iso(ver?.verified_on),
        verification_period_start: iso(ver?.monitoring_period_start_on ?? i.vintage_start_on),
        verification_period_end: iso(ver?.monitoring_period_end_on ?? i.vintage_end_on),
        batch_issued_volume: i.volume,
        cumulative_issued_volume: i.cumulative_volume,
        issuance_status: i.status,
      });
    }),
  };

  const block = pickBlock(agg, opts.unitId);
  let unit: Record<string, unknown> | undefined;
  let vintage: Record<string, unknown> | undefined;
  if (block) {
    const retirement = agg.retirements.find((r) => r.id === block.retirement_id);
    const source = block.source_block_id
      ? agg.blocks.find((b) => b.id === block.source_block_id)
      : undefined;
    unit = compact({
      descriptor: [{ metric: block.metric, type: block.unit_type }],
      owner_account_id: block.owner_account_id,
      retirement: retirement
        ? [
            compact({
              retirement_beneficiary: retirement.beneficiary_name,
              retirement_detail: retirement.detail,
            }),
          ]
        : [],
      reference: [
        compact({
          serial_number: block.serial_number,
          source_serial_number: source?.serial_number,
        }),
      ],
      status: block.history.map((h) =>
        compact({ status: h.cdop_status, status_reason: h.reason, is_current: h.is_current }),
      ),
      // Unit Description wants block_start inside the array; Full List wants the mangled key (CDOP-FB-003).
      credit_block: [
        {
          quantity: block.block_end - block.block_start + 1,
          block_start: block.block_start,
          block_end: block.block_end,
        },
      ],
      credit_blockblock_start: block.block_start,
      expected_carbon_credit_price: agg.finance?.expected_credit_price,
      realized_transaction_price: agg.finance?.realized_transaction_price,
      unit_level: block.labels
        .map((id) => ctx.label(id))
        .filter((l): l is NonNullable<typeof l> => !!l)
        // A label is either an accreditation or a compliance eligibility, so each entry carries
        // one half of what the schema requires together (CDOP-FB-029). Never both: stamping an
        // accreditation on a unit that only has CORSIA eligibility would be a false claim.
        .map((l) => {
          const value = unitLevelValue(l.cdop_enum_value ?? l.name);
          return UNIT_LEVEL_ACCREDITATIONS.has(value)
            ? {
                unit_level_accreditation: value,
                unit_level_accreditation_start_date: iso(block.vintage_start_on),
                unit_level_accreditation_id: `${l.id}:${block.id}`,
                unit_level_accreditation_website: l.url ?? `${ctx.baseUrl}/v2/reference/labels`,
              }
            : {
                unit_level_compliance_eligibility: value,
                unit_level_compliance_approval_date: iso(block.vintage_start_on),
              };
        }),
    });
    vintage = { vintage: iso(block.vintage_start_on) };
  } else if (strict) {
    placeholders.push("unit", "vintage");
    unit = {
      descriptor: [{ metric: agg.unit_metric, type: standard?.id === "wcc" ? "PIU" : "VCU" }],
      owner_account_id: "",
      reference: [],
      status: [],
      credit_block: [],
      credit_blockblock_start: 0,
    };
    vintage = { vintage: iso(agg.start_on ?? agg.created_at) };
  } else {
    missing.push("unit", "vintage");
  }

  const estimations: Record<string, unknown> | undefined = currentEstimation
    ? compact({
        estimation_event: agg.estimations.map((e) => ({
          estimation_id: e.sequence,
          estimation_event_date: iso(e.event_on),
          estimated_issuance_date: e.vintages
            .map((v) => iso(v.estimated_issuance_on))
            .filter(Boolean),
        })),
        status: agg.estimations.map((e) =>
          compact({
            estimation_status: e.status,
            estimated_status_reason: e.status_reason,
            is_current: e.is_current,
          }),
        ),
        vintage_mitigation: currentEstimation.vintages.map((v) => ({
          vintage_year: v.vintage_year,
          estimated_vintage_emissions_mitigation: v.estimated_mitigation,
        })),
        monitoring: currentEstimation.vintages.map((v) =>
          compact({
            estimated_monitoring_period_start_date: iso(
              v.monitoring_start_on ?? v.vintage_start_on,
            ),
            estimated_monitoring_period_end_date: iso(v.monitoring_end_on ?? v.vintage_end_on),
          }),
        ),
      })
    : undefined;
  if (!estimations) missing.push("estimations");

  let cobenefits: Record<string, unknown> | undefined;
  if (agg.sdgs.length > 0) {
    cobenefits = compact({
      sdgs_the_project_plans_to_contribute_to: agg.sdgs.map((n) => SDG_NAMES[n]).filter(Boolean),
      methods_used_to_assess_sdgs_and_other_cobenefits: agg.cobenefitMethods.length
        ? agg.cobenefitMethods
        : ["Not published"],
      cobenefit_target: agg.cobenefits.map((t) =>
        compact({
          cobenefits_type: t.cobenefit_type,
          overview_of_the_projects_impact: t.impact_overview,
          "overview_of_the_projects_approach_to_ track_and_quantify": t.approach,
          indicator_id: t.indicator_id,
          unit_description: t.unit_description,
          unit_type: t.unit_type,
          unit_symbol: t.unit_symbol,
          unit_monitoring_frequency: t.monitoring_frequency,
          baseline_value: t.baseline_value,
          target_value: t.target_value,
          supporting_evidence: t.supporting_evidence_url,
        }),
      ),
      cobenefit_impact: agg.cobenefits.flatMap((t) =>
        t.impacts.map((i) =>
          compact({
            cobenefits_type: t.cobenefit_type,
            achieved_project_impact: i.achieved_impact,
            indicator_id: t.indicator_id,
            achieved_value: i.achieved_value,
            change_type: i.change_type,
            supporting_evidence: i.supporting_evidence_url,
          }),
        ),
      ),
    });
  } else if (strict) {
    placeholders.push("cobenefits");
    cobenefits = {
      sdgs_the_project_plans_to_contribute_to: [SDG_NAMES[13]],
      methods_used_to_assess_sdgs_and_other_cobenefits: ["Not assessed"],
    };
  } else {
    missing.push("cobenefits");
  }

  const firstAgreement = agg.agreements[0];
  let agreement: Record<string, unknown> | undefined;
  if (firstAgreement) {
    const a = firstAgreement;
    agreement = compact({
      agreement_notes: a.notes,
      agreement_type: a.agreement_type,
      offtake: a.offtakes.map((o) =>
        compact({
          offtake_agreement_contracted_credit_volume: o.contracted_volume,
          offtake_agreement_contracted_credit_price: o.contracted_price,
          offtake_agreement_credit_vintage_start: o.vintage_start_year,
          offtake_agreement_credit_vintage_end: o.vintage_end_year,
          offtake_agreement_credit_requirements: o.requirements,
        }),
      ),
      date:
        a.effective_on || a.expiry_on
          ? [
              compact({
                agreement_effective_date: iso(a.effective_on),
                agreement_expiry_date: iso(a.expiry_on),
              }),
            ]
          : [],
      agreement_commitment_amount: a.commitment_amount,
      insurance: a.insurance.map((i) =>
        compact({
          agreement_insurance_policy_exists: i.policy_exists,
          agreement_insurer_name: i.insurer_name,
          agreement_insurance_policy_reference: i.policy_reference,
          agreement_insurance_coverage_type: i.coverage_type,
        }),
      ),
      agreement_currency: a.currency,
      agreement_marketplace_or_venue: a.marketplace_or_venue,
      collateral_type: a.collateral_type,
      project_financing_stage: a.financing_stage,
      agreement_governing_law: a.governing_law,
      funding_details: a.funding.map((f) =>
        compact({
          funding_source_category: f.source_category,
          funding_source_expected_disbursement_date: iso(f.expected_disbursement_on),
          funding_source_disbursement_schedule: f.disbursement_schedule,
          funding_conditions_precedent: f.conditions_precedent,
          funding_is_fully_committed: f.is_fully_committed,
          funding_commitment_status: f.commitment_status,
          funding_commitment_status_reason: f.status_reason,
          is_current: f.is_current,
        }),
      ),
    });
  } else if (strict) {
    placeholders.push("agreement");
    agreement = {
      agreement_type: "grant",
      agreement_notes: "Placeholder: no financial agreement is published for this project.",
    };
  } else {
    missing.push("agreement");
  }

  const standardLabel = ctx.label("icvcm");
  const carbon_crediting_standard: Record<string, unknown> | undefined =
    ["vcs", "gs4gg", "acr"].includes(agg.standard_id) && standardLabel
      ? { carbon_standard_level_accreditation: standardLabel.cdop_enum_value }
      : undefined;

  const document: Record<string, unknown> = {
    project,
    project_stakeholder,
    ...(Object.keys(facility).length ? { facility } : {}),
    geolocation_file,
    crediting_program,
    methodology,
    registry: registryDoc,
    validation: validationDoc,
    issuance,
    ...(unit ? { unit } : {}),
    ...(vintage ? { vintage } : {}),
    ...(estimations ? { estimations } : {}),
    ...(cobenefits ? { cobenefits } : {}),
    ...(agreement ? { agreement } : {}),
    ...(carbon_crediting_standard ? { carbon_crediting_standard } : {}),
  };
  return { pod: "full-list", document, missing, placeholders };
}

const ATTESTATION_ENUM: Record<string, string> = {
  child_labor: "child labor attestation",
  labor_worker: "labor worker attestation",
  land_ownership: "legal land ownership attestation",
  human_rights: "human rights attestation",
};

/** document_type ids that map to CDOP's six other_project_documentation_type values. */
const CDOP_DOC_TYPE_BY_ID = new Map<string, string>([
  ["wcc:300000000000001", "project monitoring report"],
  ["wcc:103000000000410", "project monitoring report"],
  ["wcc:103000000000409", "loss event report"],
  ["pc:300000000000001", "project monitoring report"],
  ["pc:100000000000511", "project monitoring plan"],
  ["pc:100000000000510", "non-permanence risk assessment"],
  ["generic:monitoring-report", "project monitoring report"],
  ["generic:monitoring-plan", "project monitoring plan"],
  ["generic:nonpermanence-risk-report", "non-permanence risk assessment"],
  ["generic:consultation-record", "consultation record"],
  ["generic:loss-event-report", "loss event report"],
  ["generic:cancellation-certificate", "voluntary cancellation certification"],
]);

/** Keep only the keys a schema declares (recursively). Arrays of objects are pruned per item. */
export function pruneToSchema(value: unknown, schema: JsonSchema | undefined): unknown {
  if (!schema) return value;
  if (
    schema.type === "object" &&
    schema.properties &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const out: Record<string, unknown> = {};
    for (const [k, sub] of Object.entries(schema.properties)) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = pruneToSchema(v, sub);
    }
    return out;
  }
  if (schema.type === "array" && Array.isArray(value))
    return value.map((item) => pruneToSchema(item, schema.items));
  return value;
}

/** Build the document for any pod: Full List first, then prune to the pod's own structure. */
export function buildPodDocument(
  agg: ProjectAggregate,
  ctx: ProjectionContext,
  pod: PodName,
  opts: ProjectionOptions = {},
): ProjectionResult {
  const full = buildFullList(agg, ctx, opts);
  if (pod === "full-list") return full;
  const schema = loadSchema(pod);
  const pruned = pruneToSchema(full.document, schema) as Record<string, unknown>;
  const declared = new Set(Object.keys(schema.properties ?? {}));
  return {
    pod,
    document: pruned,
    missing: full.missing.filter((m) => declared.has(m.split(".")[0] as string)),
    placeholders: full.placeholders.filter((p) => declared.has(p.split(".")[0] as string)),
  };
}

export function validateDocument(pod: PodName, document: unknown): ValidationResult {
  return validatePayload(pod, document);
}

export const POD_SCHEMA_FILE = SCHEMA_FILES;
