/**
 * Writes a generated Dataset into the cdop schema. Row-event and touch-project triggers are
 * suppressed for the transaction (the seed backfills its own events); dates are serialised as
 * ISO strings so `date` columns never shift with the process timezone.
 */
import { sql } from "kysely";
import type { Database } from "./kysely.js";
import type { Dataset, ProjectAggregate } from "../seed/aggregate.js";
import {
  REGISTRIES,
  PROGRAMS,
  STANDARDS,
  METHODOLOGIES,
  LABELS,
  DOCUMENT_TYPES,
} from "../seed/vocab.js";
import { MACHINES } from "../domain/lifecycle/index.js";
import { UNIT_TRANSITIONS } from "../domain/lifecycle/units.js";
import { listEnums } from "@cdop/schemas";

const d = (v: Date | undefined): string | null => (v ? v.toISOString().slice(0, 10) : null);
const ts = (v: Date | undefined): Date | null => v ?? null;
const n = <T>(v: T | undefined): T | null => (v === undefined ? null : v);

const CHUNK = 500;
async function insertChunks<T extends object>(
  exec: (rows: T[]) => Promise<unknown>,
  rows: T[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) await exec(rows.slice(i, i + CHUNK));
}

export async function resetData(db: Database): Promise<void> {
  await sql`truncate table
    cdop.event, cdop.webhook_delivery, cdop.webhook, cdop.idempotency_key, cdop.sim_run,
    cdop.cobenefit_impact, cdop.cobenefit_target, cdop.cobenefit_method,
    cdop.agreement_counterparty, cdop.agreement_funding, cdop.agreement_insurance, cdop.agreement_offtake, cdop.agreement,
    cdop.document, cdop.unit_label, cdop.buffer_pool_entry, cdop.cancellation, cdop.retirement, cdop.transfer,
    cdop.unit_status_history, cdop.unit_block, cdop.issuance, cdop.milestone, cdop.estimation_vintage, cdop.estimation,
    cdop.verification_event, cdop.validation_event, cdop.project_registry_history, cdop.project_landowner,
    cdop.project_label, cdop.project_stakeholder, cdop.project_sdg, cdop.project_finance, cdop.geolocation_file,
    cdop.crediting_period, cdop.project_status_history, cdop.project_mitigation, cdop.project_location, cdop.project,
    cdop.account, cdop.organisation, cdop.lifecycle_transition, cdop.native_transition, cdop.native_state,
    cdop.label, cdop.document_type, cdop.cdop_vocabulary, cdop.methodology_version, cdop.methodology,
    cdop.standard_version, cdop.standard, cdop.crediting_program, cdop.registry
    restart identity cascade`.execute(db);
}

export async function writeVocabulary(db: Database): Promise<void> {
  await db
    .insertInto("registry")
    .values(
      REGISTRIES.map((r) => ({
        id: r.id,
        cdop_name: r.cdop_name,
        operator_name: n(r.operator_name),
        url: n(r.url),
        project_url_template: n(r.project_url_template),
        serial_grammar: n(r.serial_grammar),
        country_code: n(r.country_code),
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await db
    .insertInto("crediting_program")
    .values(PROGRAMS.map((p) => ({ id: p.id, cdop_name: p.cdop_name, url: n(p.url) })))
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await db
    .insertInto("standard")
    .values(
      STANDARDS.map((s) => ({
        id: s.id,
        cdop_name: s.cdop_name,
        short_code: s.short_code,
        crediting_program_id: s.crediting_program_id,
        registry_id: s.registry_id,
        native_standard_id: n(s.native_standard_id),
        unit_type_pending: n(s.unit_type_pending),
        unit_type_verified: s.unit_type_verified,
        default_buffer_rate: n(s.default_buffer_rate),
        vintage_period_years: s.vintage_period_years,
        verification_schedule: JSON.stringify(s.verification_schedule),
        status_vocabulary: s.status_vocabulary,
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await db
    .insertInto("standard_version")
    .values(
      STANDARDS.flatMap((s) =>
        s.versions.map((v, i) => ({
          id: `${s.id}@${v}`,
          standard_id: s.id,
          version: v,
          is_current: i === s.versions.length - 1,
        })),
      ),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await db
    .insertInto("methodology")
    .values(
      METHODOLOGIES.map((m) => ({
        id: m.id,
        cdop_name: m.cdop_name,
        code: n(m.code),
        title: n(m.title),
        standard_id: m.standard_id,
        sector: n(m.sector),
        url: n(m.url),
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await db
    .insertInto("methodology_version")
    .values(
      METHODOLOGIES.flatMap((m) =>
        m.versions.map((v, i) => ({
          id: `${m.id}@${v}`,
          methodology_id: m.id,
          version: v,
          document_url: n(m.url),
          is_current: i === m.versions.length - 1,
        })),
      ),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await db
    .insertInto("label")
    .values(
      LABELS.map((l) => ({
        id: l.id,
        name: l.name,
        level: l.level,
        issuer: n(l.issuer),
        url: n(l.url),
        cdop_enum_value: n(l.cdop_enum_value),
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await db
    .insertInto("document_type")
    .values(
      DOCUMENT_TYPES.map((t) => ({
        id: t.id,
        standard_id: n(t.standard_id),
        native_id: n(t.native_id),
        name: t.name,
        cdop_type: n(t.cdop_type),
        kind: t.kind,
        stage: t.stage,
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  const vocabRows = listEnums().flatMap((e) =>
    e.values.map((term, sort) => ({
      vocabulary: e.path,
      term,
      sort,
      cdop_field_id: n(e.fieldId),
      cdop_field_path: e.path,
    })),
  );
  await insertChunks(
    (rows) =>
      db
        .insertInto("cdop_vocabulary")
        .values(rows)
        .onConflict((oc) => oc.columns(["vocabulary", "term"]).doNothing())
        .execute(),
    vocabRows,
  );
  for (const machine of Object.values(MACHINES)) {
    await db
      .insertInto("native_state")
      .values(
        machine.states.map((s, i) => ({
          standard_id: machine.standardId,
          code: s.code,
          name: s.name,
          owner_actor: s.owner,
          lifecycle_state: s.lifecycle,
          cdop_project_status: s.cdopStatus,
          phase: n(s.phase),
          is_terminal: s.terminal ?? false,
          sort: i,
        })),
      )
      .onConflict((oc) => oc.columns(["standard_id", "code"]).doNothing())
      .execute();
    await db
      .insertInto("native_transition")
      .values(
        machine.transitions.map((t) => ({
          standard_id: machine.standardId,
          from_code: t.from,
          action: t.action,
          actor: t.actor,
          intent: t.intent,
          to_code: t.to,
          label: t.label,
          requires_reason: t.requiresReason ?? false,
        })),
      )
      .onConflict((oc) => oc.columns(["standard_id", "from_code", "action"]).doNothing())
      .execute();
  }
  await db
    .insertInto("lifecycle_transition")
    .values(
      UNIT_TRANSITIONS.map((t) => ({
        entity: "unit",
        from_state: t.from,
        action: t.action,
        actor: t.actor,
        to_state: t.to,
        emits_event: t.emits,
        label: t.label,
      })),
    )
    .onConflict((oc) => oc.columns(["entity", "from_state", "action"]).doNothing())
    .execute();
}

export async function writeParties(db: Database, ds: Dataset): Promise<void> {
  await insertChunks(
    (rows) => db.insertInto("organisation").values(rows).execute(),
    ds.organisations.map((o) => ({
      id: o.id,
      legal_name: o.legal_name,
      trading_name: n(o.trading_name),
      website: n(o.website),
      email: n(o.email),
      phone: n(o.phone),
      classification: n(o.classification),
      cdop_role: n(o.cdop_role),
      country_code: o.country_code,
      country_name: n(o.country_name),
      region_code: n(o.region_code),
      region_name: n(o.region_name),
      subdivision_code: n(o.subdivision_code),
      subdivision_name: n(o.subdivision_name),
      city: n(o.city),
      postal_code: n(o.postal_code),
      address_line_1: n(o.address_line_1),
      founded_on: d(o.founded_on),
      employees: n(o.employees),
      project_employees: n(o.project_employees),
      mission: n(o.mission),
      team_experience: n(o.team_experience),
      project_experience_years: n(o.project_experience_years),
    })),
  );
  // Parents before children.
  const accounts = [...ds.accounts].sort(
    (a, b) => Number(!!a.parent_account_id) - Number(!!b.parent_account_id),
  );
  await insertChunks(
    (rows) => db.insertInto("account").values(rows).execute(),
    accounts.map((a) => ({
      id: a.id,
      registry_id: a.registry_id,
      organisation_id: n(a.organisation_id),
      native_account_id: n(a.native_account_id),
      name: a.name,
      account_type: a.account_type,
      status: a.status,
      parent_account_id: n(a.parent_account_id),
      is_master: a.is_master,
      standard_id: n(a.standard_id),
      opened_on: d(a.opened_on),
      country_code: n(a.country_code),
      holdings_public: a.holdings_public,
      retirements_public: a.retirements_public,
    })),
  );
}

export async function writeProjects(db: Database, projects: ProjectAggregate[]): Promise<void> {
  // Masters before members (self-referencing FK).
  const ordered = [...projects].sort(
    (a, b) => Number(!!a.master_project_id) - Number(!!b.master_project_id),
  );
  await insertChunks(
    (rows) => db.insertInto("project").values(rows).execute(),
    ordered.map((p) => ({
      id: p.id,
      project_identifier: p.project_identifier,
      registry_id: p.registry_id,
      standard_id: p.standard_id,
      standard_version_id: n(p.standard_version_id),
      crediting_program_id: p.crediting_program_id,
      methodology_version_id: n(p.methodology_version_id),
      native_project_id: p.native_project_id,
      native_project_url: n(p.native_project_url),
      name: p.name,
      description: n(p.description),
      program_type: n(p.program_type),
      activity_type: n(p.activity_type),
      master_project_id: n(p.master_project_id),
      developer_account_id: n(p.developer_account_id),
      developer_organisation_id: n(p.developer_organisation_id),
      vvb_organisation_id: n(p.vvb_organisation_id),
      lifecycle_state: p.lifecycle_state,
      native_state_code: p.native_state_code,
      native_state_name: n(p.native_state_name),
      cdop_project_status: p.cdop_project_status,
      is_on_hold: p.is_on_hold,
      listed_on: d(p.listed_on),
      registered_on: d(p.registered_on),
      validated_on: d(p.validated_on),
      first_verified_on: d(p.first_verified_on),
      closed_on: d(p.closed_on),
      validation_deadline_on: d(p.validation_deadline_on),
      country_code: p.country_code,
      country_name: p.country_name,
      region_code: p.region_code,
      region_name: p.region_name,
      subdivision_code: n(p.subdivision_code),
      subdivision_name: n(p.subdivision_name),
      city: n(p.city),
      centroid_lat: p.centroid[1],
      centroid_lon: p.centroid[0],
      min_lon: p.bbox[0],
      min_lat: p.bbox[1],
      max_lon: p.bbox[2],
      max_lat: p.bbox[3],
      grid_reference: n(p.grid_reference),
      area_ha: n(p.area_ha),
      start_on: d(p.start_on),
      end_on: d(p.end_on),
      duration_years: n(p.duration_years),
      crediting_period_type: n(p.crediting_period_type),
      max_cumulative_crediting_years: n(p.max_cumulative_crediting_years),
      max_crediting_periods: n(p.max_crediting_periods),
      estimated_annual_mitigation: n(p.estimated_annual_mitigation),
      estimated_total_mitigation: n(p.estimated_total_mitigation),
      estimated_total_years: n(p.estimated_total_years),
      buffer_rate: n(p.buffer_rate),
      unit_metric: p.unit_metric,
      attestations: JSON.stringify(p.attestations),
      governance_structure: n(p.governance_structure),
      community_frameworks: n(p.community_frameworks),
      public_comment: n(p.public_comment),
      public_comment_summary: n(p.public_comment_summary),
      previous_program: n(p.previous_program),
      project_risk: p.project_risk ? JSON.stringify(p.project_risk) : null,
      native_attributes: JSON.stringify(p.native_attributes),
      created_at: p.created_at,
      modified_at: p.modified_at,
    })),
  );

  const locations = projects.flatMap((p) =>
    p.locations.map((l) => ({
      id: l.id,
      project_id: p.id,
      kind: l.kind,
      is_primary: l.is_primary,
      country_code: l.country_code,
      country_name: l.country_name,
      region_code: l.region_code,
      region_name: l.region_name,
      subdivision_code: n(l.subdivision_code),
      subdivision_name: n(l.subdivision_name),
      address_line_1: n(l.address_line_1),
      address_line_2: n(l.address_line_2),
      alternative_address: n(l.alternative_address),
      city: n(l.city),
      postal_code: n(l.postal_code),
      sort: l.sort,
    })),
  );
  await insertChunks((rows) => db.insertInto("project_location").values(rows).execute(), locations);

  const mitigations = projects.flatMap((p) =>
    p.mitigations.map((m) => ({
      id: m.id,
      project_id: p.id,
      mitigation_type: m.mitigation_type,
      project_sector: m.project_sector,
      project_type: m.project_type,
      estimated_annual_mitigation: m.estimated_annual_mitigation,
      estimated_total_mitigation: m.estimated_total_mitigation,
      sort: m.sort,
    })),
  );
  await insertChunks(
    (rows) => db.insertInto("project_mitigation").values(rows).execute(),
    mitigations,
  );

  const status = projects.flatMap((p) =>
    p.statusHistory.map((s) => ({
      id: s.id,
      project_id: p.id,
      sequence: s.sequence,
      lifecycle_state: s.lifecycle_state,
      native_state_code: s.native_state_code,
      native_state_name: n(s.native_state_name),
      cdop_project_status: s.cdop_project_status,
      action: n(s.action),
      intent: n(s.intent),
      reason: n(s.reason),
      actor_kind: s.actor_kind,
      actor_account_id: n(s.actor_account_id),
      effective_at: s.effective_at,
      recorded_at: s.effective_at,
      is_current: s.is_current,
      event_id: null,
    })),
  );
  await insertChunks(
    (rows) => db.insertInto("project_status_history").values(rows).execute(),
    status,
  );

  const validations = projects.flatMap((p) =>
    p.validations.map((v) => ({
      id: v.id,
      project_id: p.id,
      sequence: v.sequence,
      validation_type: v.validation_type,
      status: v.status,
      vvb_organisation_id: n(v.vvb_organisation_id),
      vvb_account_id: n(v.vvb_account_id),
      submitted_on: d(v.submitted_on),
      site_visit_start_on: d(v.site_visit_start_on),
      site_visit_end_on: d(v.site_visit_end_on),
      decided_on: d(v.decided_on),
      opinion: n(v.opinion),
      crediting_period_id: null,
      report_document_id: null,
      statement_document_id: null,
      report_url: n(v.report_url),
      expires_on: d(v.expires_on),
      notes: n(v.notes),
    })),
  );
  await insertChunks(
    (rows) => db.insertInto("validation_event").values(rows).execute(),
    validations,
  );

  const periods = projects.flatMap((p) =>
    p.creditingPeriods.map((c) => ({
      id: c.id,
      project_id: p.id,
      number: c.number,
      start_on: d(c.start_on) as string,
      end_on: d(c.end_on) as string,
      duration_years: c.duration_years,
      period_type: c.period_type,
      validation_event_id: n(c.validation_event_id),
      is_current: c.is_current,
    })),
  );
  await insertChunks((rows) => db.insertInto("crediting_period").values(rows).execute(), periods);
  // Validation → crediting period back-reference.
  for (const p of projects)
    for (const v of p.validations)
      if (v.crediting_period_id)
        await db
          .updateTable("validation_event")
          .set({ crediting_period_id: v.crediting_period_id })
          .where("id", "=", v.id)
          .execute();

  const verifications = projects.flatMap((p) =>
    p.verifications.map((v) => ({
      id: v.id,
      project_id: p.id,
      sequence: v.sequence,
      monitoring_period_start_on: d(v.monitoring_period_start_on) as string,
      monitoring_period_end_on: d(v.monitoring_period_end_on) as string,
      status: v.status,
      vvb_organisation_id: n(v.vvb_organisation_id),
      site_visit_start_on: d(v.site_visit_start_on),
      site_visit_end_on: d(v.site_visit_end_on),
      submitted_on: d(v.submitted_on),
      verified_on: d(v.verified_on),
      opinion: n(v.opinion),
      claim_type: v.claim_type,
      uom: v.uom,
      predicted_quantity: n(v.predicted_quantity),
      claimed_quantity: n(v.claimed_quantity),
      gross_verified_quantity: n(v.gross_verified_quantity),
      leakage_deduction: v.leakage_deduction,
      buffer_deduction: v.buffer_deduction,
      uncertainty_deduction: v.uncertainty_deduction,
      uncertainty_basis: n(v.uncertainty_basis),
      uncertainty_margin: n(v.uncertainty_margin),
      cumulative_verified_quantity: n(v.cumulative_verified_quantity),
      issuance_id: null,
      report_document_id: null,
      statement_document_id: null,
      report_url: n(v.report_url),
    })),
  );
  await insertChunks(
    (rows) => db.insertInto("verification_event").values(rows).execute(),
    verifications,
  );

  const estimations = projects.flatMap((p) =>
    p.estimations.map((e) => ({
      id: e.id,
      project_id: p.id,
      sequence: e.sequence,
      event_on: d(e.event_on) as string,
      status: e.status,
      status_reason: n(e.status_reason),
      validated_by_validation_event_id: n(e.validated_by_validation_event_id),
      superseded_by_estimation_id: null,
      total_mitigation: n(e.total_mitigation),
      annual_mitigation: n(e.annual_mitigation),
      total_years: n(e.total_years),
      is_current: e.is_current,
    })),
  );
  await insertChunks((rows) => db.insertInto("estimation").values(rows).execute(), estimations);
  for (const p of projects)
    for (const e of p.estimations)
      if (e.superseded_by_estimation_id)
        await db
          .updateTable("estimation")
          .set({ superseded_by_estimation_id: e.superseded_by_estimation_id })
          .where("id", "=", e.id)
          .execute();
  const vintages = projects.flatMap((p) =>
    p.estimations.flatMap((e) =>
      e.vintages.map((v) => ({
        id: v.id,
        estimation_id: e.id,
        project_id: p.id,
        vintage_start_on: d(v.vintage_start_on) as string,
        vintage_end_on: d(v.vintage_end_on) as string,
        vintage_year: v.vintage_year,
        estimated_mitigation: v.estimated_mitigation,
        estimated_claimable: n(v.estimated_claimable),
        estimated_buffer: n(v.estimated_buffer),
        monitoring_start_on: d(v.monitoring_start_on),
        monitoring_end_on: d(v.monitoring_end_on),
        estimated_issuance_on: d(v.estimated_issuance_on),
      })),
    ),
  );
  await insertChunks(
    (rows) => db.insertInto("estimation_vintage").values(rows).execute(),
    vintages,
  );

  const geo = projects.flatMap((p) =>
    p.geolocationFiles.map((g) => ({
      id: g.id,
      project_id: p.id,
      file_name: g.file_name,
      file_format: g.file_format,
      area_type: g.area_type,
      geometry_type: g.geometry_type,
      file_status: g.file_status,
      validity_start_on: d(g.validity_start_on) as string,
      validity_end_on: d(g.validity_end_on),
      file_created_at: g.file_created_at,
      file_edited_at: ts(g.file_edited_at),
      file_deleted_at: ts(g.file_deleted_at),
      crs: g.crs,
      geojson: JSON.stringify(g.geojson),
      area_ha: n(g.area_ha),
      min_lon: g.bbox[0],
      min_lat: g.bbox[1],
      max_lon: g.bbox[2],
      max_lat: g.bbox[3],
      sha256: null,
    })),
  );
  await insertChunks((rows) => db.insertInto("geolocation_file").values(rows).execute(), geo);

  const finance = projects
    .filter((p) => p.finance)
    .map((p) => {
      const f = p.finance as NonNullable<ProjectAggregate["finance"]>;
      return {
        project_id: p.id,
        expected_initial_costs: n(f.expected_initial_costs),
        expected_annual_costs: n(f.expected_annual_costs),
        expected_annual_revenue: n(f.expected_annual_revenue),
        total_funding_required: n(f.total_funding_required),
        total_funding_secured: n(f.total_funding_secured),
        financing_options: f.financing_options,
        community_benefit_mechanisms: f.community_benefit_mechanisms,
        expected_community_proceeds: n(f.expected_community_proceeds),
        declaring_entity_organisation_id: n(f.declaring_entity_organisation_id),
        expected_credit_price: n(f.expected_credit_price),
        realized_transaction_price: n(f.realized_transaction_price),
        currency: n(f.currency),
      };
    });
  await insertChunks((rows) => db.insertInto("project_finance").values(rows).execute(), finance);

  const sdgs = projects.flatMap((p) => p.sdgs.map((s) => ({ project_id: p.id, sdg_number: s })));
  await insertChunks((rows) => db.insertInto("project_sdg").values(rows).execute(), sdgs);
  const methods = projects.flatMap((p) =>
    p.cobenefitMethods.map((m, i) => ({ project_id: p.id, method: m, sort: i })),
  );
  await insertChunks((rows) => db.insertInto("cobenefit_method").values(rows).execute(), methods);
  const landowners = projects.flatMap((p) =>
    p.landowners.map((l, i) => ({ project_id: p.id, name: l, sort: i })),
  );
  await insertChunks(
    (rows) => db.insertInto("project_landowner").values(rows).execute(),
    landowners,
  );
  const stakeholders = projects.flatMap((p) =>
    p.stakeholders.map((s) => ({
      id: s.id,
      project_id: p.id,
      organisation_id: s.organisation_id,
      stakeholder_type: s.stakeholder_type,
      is_primary_developer: s.is_primary_developer,
      role_started_on: d(s.role_started_on),
      role_ended_on: d(s.role_ended_on),
    })),
  );
  await insertChunks(
    (rows) => db.insertInto("project_stakeholder").values(rows).execute(),
    stakeholders,
  );
  const plabels = projects.flatMap((p) =>
    p.labels.map((l) => ({
      id: l.id,
      project_id: p.id,
      label_id: l.label_id,
      kind: l.kind,
      start_on: d(l.start_on),
      expiry_on: d(l.expiry_on),
      approved_on: d(l.approved_on),
      url: n(l.url),
      accreditation_id: n(l.accreditation_id),
    })),
  );
  await insertChunks((rows) => db.insertInto("project_label").values(rows).execute(), plabels);

  const milestones = projects.flatMap((p) =>
    p.milestones.map((m) => ({
      id: m.id,
      project_id: p.id,
      kind: m.kind,
      name: m.name,
      sequence: m.sequence,
      due_on: d(m.due_on) as string,
      completed_at: ts(m.completed_at),
      completed_by_validation_event_id: n(m.completed_by_validation_event_id),
      completed_by_verification_event_id: n(m.completed_by_verification_event_id),
    })),
  );
  await insertChunks((rows) => db.insertInto("milestone").values(rows).execute(), milestones);

  const issuances = projects.flatMap((p) =>
    p.issuances.map((i) => ({
      id: i.id,
      project_id: p.id,
      batch_identifier: i.batch_identifier,
      sequence: i.sequence,
      kind: i.kind,
      verification_event_id: n(i.verification_event_id),
      validation_event_id: n(i.validation_event_id),
      status: i.status,
      issued_on: d(i.issued_on),
      requested_on: d(i.requested_on),
      unit_type: i.unit_type,
      unit_class: i.unit_class,
      metric: i.metric,
      vintage_start_on: d(i.vintage_start_on) as string,
      vintage_end_on: d(i.vintage_end_on) as string,
      vintage_label: i.vintage_label,
      volume: i.volume,
      cumulative_volume: i.cumulative_volume,
      recipient_account_id: n(i.recipient_account_id),
      url: n(i.url),
    })),
  );
  await insertChunks((rows) => db.insertInto("issuance").values(rows).execute(), issuances);
  for (const p of projects)
    for (const v of p.verifications)
      if (v.issuance_id)
        await db
          .updateTable("verification_event")
          .set({ issuance_id: v.issuance_id })
          .where("id", "=", v.id)
          .execute();

  // Blocks: sources before splits/conversions (self-referencing FK), then history.
  const blockRows = projects.flatMap((p) =>
    p.blocks.map((b) => ({
      id: b.id,
      project_id: p.id,
      issuance_id: b.issuance_id,
      serial_number: b.serial_number,
      source_block_id: n(b.source_block_id),
      block_start: b.block_start,
      block_end: b.block_end,
      unit_type: b.unit_type,
      unit_class: b.unit_class,
      metric: b.metric,
      vintage_start_on: d(b.vintage_start_on) as string,
      vintage_end_on: d(b.vintage_end_on) as string,
      vintage_label: b.vintage_label,
      owner_account_id: b.owner_account_id,
      state: b.state,
      state_reason: n(b.state_reason),
      native_status_code: n(b.native_status_code),
      native_status_name: n(b.native_status_name),
      cdop_status: b.cdop_status,
      retirement_id: null,
      cancellation_id: null,
      labels_cached: b.labels,
    })),
  );
  const known = new Set<string>();
  const pending = [...blockRows];
  while (pending.length) {
    const ready = pending.filter((b) => !b.source_block_id || known.has(b.source_block_id));
    if (!ready.length) throw new Error("unit_block source_block_id cycle");
    await insertChunks((rows) => db.insertInto("unit_block").values(rows).execute(), ready);
    for (const r of ready) known.add(r.id);
    for (const r of ready) pending.splice(pending.indexOf(r), 1);
  }
  const history = projects.flatMap((p) =>
    p.blocks.flatMap((b) =>
      b.history.map((h) => ({
        id: h.id,
        block_id: b.id,
        project_id: p.id,
        sequence: h.sequence,
        from_state: n(h.from_state),
        to_state: h.to_state,
        cdop_status: h.cdop_status,
        action: h.action,
        reason: n(h.reason),
        actor_kind: h.actor_kind,
        actor_account_id: n(h.actor_account_id),
        from_owner_account_id: n(h.from_owner_account_id),
        to_owner_account_id: n(h.to_owner_account_id),
        quantity: n(h.quantity),
        effective_at: h.effective_at,
        recorded_at: h.effective_at,
        is_current: h.is_current,
        event_id: null,
      })),
    ),
  );
  await insertChunks(
    (rows) => db.insertInto("unit_status_history").values(rows).execute(),
    history,
  );

  const transfers = projects.flatMap((p) =>
    p.transfers.map((t) => ({
      id: t.id,
      project_id: p.id,
      block_id: t.block_id,
      kind: t.kind,
      from_account_id: t.from_account_id,
      to_account_id: t.to_account_id,
      quantity: t.quantity,
      price: n(t.price),
      currency: n(t.currency),
      status: t.status,
      requested_at: t.requested_at,
      settled_at: ts(t.settled_at),
      remarks: n(t.remarks),
    })),
  );
  await insertChunks((rows) => db.insertInto("transfer").values(rows).execute(), transfers);
  const retirements = projects.flatMap((p) =>
    p.retirements.map((r) => ({
      id: r.id,
      project_id: p.id,
      block_id: r.block_id,
      account_id: r.account_id,
      quantity: r.quantity,
      retired_at: r.retired_at,
      beneficiary_name: n(r.beneficiary_name),
      beneficiary_organisation_id: n(r.beneficiary_organisation_id),
      purpose: n(r.purpose),
      detail: n(r.detail),
      vintage_label: r.vintage_label,
      certificate_document_id: null,
    })),
  );
  await insertChunks((rows) => db.insertInto("retirement").values(rows).execute(), retirements);
  const cancellations = projects.flatMap((p) =>
    p.cancellations.map((c) => ({
      id: c.id,
      project_id: p.id,
      block_id: c.block_id,
      account_id: n(c.account_id),
      quantity: c.quantity,
      cancelled_at: c.cancelled_at,
      reason: c.reason,
      detail: n(c.detail),
      replacement_block_id: n(c.replacement_block_id),
    })),
  );
  await insertChunks((rows) => db.insertInto("cancellation").values(rows).execute(), cancellations);
  for (const p of projects) {
    for (const b of p.blocks) {
      if (b.retirement_id || b.cancellation_id)
        await db
          .updateTable("unit_block")
          .set({ retirement_id: n(b.retirement_id), cancellation_id: n(b.cancellation_id) })
          .where("id", "=", b.id)
          .execute();
    }
  }
  const buffer = projects.flatMap((p) =>
    p.bufferEntries.map((e) => ({
      id: e.id,
      project_id: p.id,
      standard_id: e.standard_id,
      kind: e.kind,
      quantity: e.quantity,
      occurred_on: d(e.occurred_on) as string,
      block_id: n(e.block_id),
      verification_event_id: n(e.verification_event_id),
      notes: n(e.notes),
    })),
  );
  await insertChunks((rows) => db.insertInto("buffer_pool_entry").values(rows).execute(), buffer);
  const unitLabels = projects.flatMap((p) =>
    p.blocks.flatMap((b) =>
      b.labels.map((l) => ({ block_id: b.id, label_id: l, kind: "accreditation" as const })),
    ),
  );
  await insertChunks(
    (rows) =>
      db
        .insertInto("unit_label")
        .values(rows)
        .onConflict((oc) => oc.doNothing())
        .execute(),
    unitLabels,
  );

  const documents = projects.flatMap((p) =>
    p.documents.map((doc) => ({
      id: doc.id,
      project_id: p.id,
      document_type_id: doc.document_type_id,
      validation_event_id: n(doc.validation_event_id),
      verification_event_id: n(doc.verification_event_id),
      issuance_id: n(doc.issuance_id),
      title: doc.title,
      file_name: doc.file_name,
      content_type: doc.content_type,
      size_bytes: n(doc.size_bytes),
      url: null,
      is_public: doc.is_public,
      uploaded_at: doc.uploaded_at,
      uploaded_by_account_id: n(doc.uploaded_by_account_id),
      document_date: d(doc.document_date),
      version_label: n(doc.version_label),
      sha256: null,
      extracted: JSON.stringify(doc.extracted),
    })),
  );
  await insertChunks((rows) => db.insertInto("document").values(rows).execute(), documents);
  for (const p of projects) {
    for (const v of p.validations)
      if (v.report_document_id || v.statement_document_id)
        await db
          .updateTable("validation_event")
          .set({
            report_document_id: n(v.report_document_id),
            statement_document_id: n(v.statement_document_id),
          })
          .where("id", "=", v.id)
          .execute();
    for (const v of p.verifications)
      if (v.report_document_id || v.statement_document_id)
        await db
          .updateTable("verification_event")
          .set({
            report_document_id: n(v.report_document_id),
            statement_document_id: n(v.statement_document_id),
          })
          .where("id", "=", v.id)
          .execute();
    for (const r of p.retirements)
      if (r.certificate_document_id)
        await db
          .updateTable("retirement")
          .set({ certificate_document_id: r.certificate_document_id })
          .where("id", "=", r.id)
          .execute();
  }

  const agreements = projects.flatMap((p) =>
    p.agreements.map((a) => ({
      id: a.id,
      project_id: p.id,
      agreement_type: a.agreement_type,
      notes: n(a.notes),
      currency: n(a.currency),
      commitment_amount: n(a.commitment_amount),
      effective_on: d(a.effective_on),
      expiry_on: d(a.expiry_on),
      governing_law: n(a.governing_law),
      financing_stage: n(a.financing_stage),
      marketplace_or_venue: a.marketplace_or_venue,
      collateral_type: a.collateral_type,
    })),
  );
  await insertChunks((rows) => db.insertInto("agreement").values(rows).execute(), agreements);
  const offtakes = projects.flatMap((p) =>
    p.agreements.flatMap((a) =>
      a.offtakes.map((o) => ({
        id: o.id,
        agreement_id: a.id,
        contracted_volume: n(o.contracted_volume),
        contracted_price: n(o.contracted_price),
        vintage_start_year: n(o.vintage_start_year),
        vintage_end_year: n(o.vintage_end_year),
        requirements: n(o.requirements),
      })),
    ),
  );
  await insertChunks((rows) => db.insertInto("agreement_offtake").values(rows).execute(), offtakes);
  const insurance = projects.flatMap((p) =>
    p.agreements.flatMap((a) =>
      a.insurance.map((i) => ({
        id: i.id,
        agreement_id: a.id,
        policy_exists: i.policy_exists,
        insurer_name: n(i.insurer_name),
        policy_reference: n(i.policy_reference),
        coverage_type: n(i.coverage_type),
      })),
    ),
  );
  await insertChunks(
    (rows) => db.insertInto("agreement_insurance").values(rows).execute(),
    insurance,
  );
  const funding = projects.flatMap((p) =>
    p.agreements.flatMap((a) =>
      a.funding.map((f) => ({
        id: f.id,
        agreement_id: a.id,
        sequence: f.sequence,
        source_category: f.source_category,
        expected_disbursement_on: d(f.expected_disbursement_on),
        disbursement_schedule: n(f.disbursement_schedule),
        conditions_precedent: n(f.conditions_precedent),
        is_fully_committed: n(f.is_fully_committed),
        commitment_status: n(f.commitment_status),
        status_reason: n(f.status_reason),
        is_current: f.is_current,
      })),
    ),
  );
  await insertChunks((rows) => db.insertInto("agreement_funding").values(rows).execute(), funding);
  const counterparties = projects.flatMap((p) =>
    p.agreements.flatMap((a) =>
      a.counterparties.map((c) => ({
        agreement_id: a.id,
        organisation_id: c.organisation_id,
        role: c.role,
        sector: n(c.sector),
      })),
    ),
  );
  await insertChunks(
    (rows) =>
      db
        .insertInto("agreement_counterparty")
        .values(rows)
        .onConflict((oc) => oc.doNothing())
        .execute(),
    counterparties,
  );

  const targets = projects.flatMap((p) =>
    p.cobenefits.map((t) => ({
      id: t.id,
      project_id: p.id,
      cobenefit_type: t.cobenefit_type,
      indicator_id: t.indicator_id,
      impact_overview: n(t.impact_overview),
      approach: n(t.approach),
      unit_description: n(t.unit_description),
      unit_type: n(t.unit_type),
      unit_symbol: n(t.unit_symbol),
      monitoring_frequency: n(t.monitoring_frequency),
      baseline_value: n(t.baseline_value),
      target_value: n(t.target_value),
      supporting_evidence_url: n(t.supporting_evidence_url),
    })),
  );
  await insertChunks((rows) => db.insertInto("cobenefit_target").values(rows).execute(), targets);
  const impacts = projects.flatMap((p) =>
    p.cobenefits.flatMap((t) =>
      t.impacts.map((i) => ({
        id: i.id,
        target_id: t.id,
        project_id: p.id,
        verification_event_id: n(i.verification_event_id),
        achieved_impact: n(i.achieved_impact),
        achieved_value: n(i.achieved_value),
        change_type: n(i.change_type),
        supporting_evidence_url: n(i.supporting_evidence_url),
        reported_on: d(i.reported_on),
      })),
    ),
  );
  await insertChunks((rows) => db.insertInto("cobenefit_impact").values(rows).execute(), impacts);
}

/** Full dataset write inside one transaction with triggers suppressed. */
export async function writeDataset(
  db: Database,
  ds: Dataset,
  opts: { reset: boolean; log?: (m: string) => void },
): Promise<void> {
  const log = opts.log ?? (() => undefined);
  await db.transaction().execute(async (trx) => {
    await sql`select set_config('cdop.suppress_row_events', 'on', true)`.execute(trx);
    await sql`select set_config('cdop.touch_project', 'off', true)`.execute(trx);
    if (opts.reset) {
      log("truncating existing data");
      await resetData(trx);
    }
    log("writing vocabulary");
    await writeVocabulary(trx);
    log(`writing ${ds.organisations.length} organisations, ${ds.accounts.length} accounts`);
    await writeParties(trx, ds);
    log(`writing ${ds.projects.length} projects`);
    await writeProjects(trx, ds.projects);
  });
}
