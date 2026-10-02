/**
 * Loads ProjectAggregates from the cdop schema: one query per child table for a batch of
 * project ids, assembled in memory. The same shape the seed generator produces, so the
 * projection (CDOP documents) and the HAL renderers work off one type.
 */
import type { Database } from "./kysely.js";
import type {
  ProjectAggregate,
  UnitBlock,
  Estimation,
  Agreement,
  CobenefitTarget,
} from "../seed/aggregate.js";
import type { CdopProjectStatus, LifecycleState } from "../domain/lifecycle/types.js";
import type { UnitState } from "../domain/lifecycle/units.js";

const dt = (v: Date | string | null | undefined): Date | undefined =>
  v === null || v === undefined ? undefined : v instanceof Date ? v : new Date(v);
const dateOnly = (v: Date | string | null | undefined): Date | undefined => {
  if (v === null || v === undefined) return undefined;
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  return new Date(`${s}T00:00:00.000Z`);
};
const num = (v: number | string | null | undefined): number | undefined =>
  v === null || v === undefined ? undefined : Number(v);
const und = <T>(v: T | null): T | undefined => (v === null ? undefined : v);
const json = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T));

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

function defineOptional<T extends object>(target: T, key: keyof T, value: unknown): void {
  if (value !== undefined) (target as Record<string, unknown>)[key as string] = value;
}

export async function loadAggregates(db: Database, ids: string[]): Promise<ProjectAggregate[]> {
  if (ids.length === 0) return [];
  const [
    projects,
    locations,
    mitigations,
    status,
    periods,
    geo,
    finance,
    sdgs,
    methods,
    landowners,
    stakeholders,
    labels,
    validations,
    verifications,
    estimations,
    vintages,
    milestones,
    issuances,
    blocks,
    history,
    transfers,
    retirements,
    cancellations,
    buffer,
    unitLabels,
    documents,
    agreements,
    offtakes,
    insurance,
    funding,
    counterparties,
    targets,
    impacts,
  ] = await Promise.all([
    db.selectFrom("project").selectAll().where("id", "in", ids).execute(),
    db
      .selectFrom("project_location")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("sort")
      .execute(),
    db
      .selectFrom("project_mitigation")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("sort")
      .execute(),
    db
      .selectFrom("project_status_history")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("sequence")
      .execute(),
    db
      .selectFrom("crediting_period")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("number")
      .execute(),
    db
      .selectFrom("geolocation_file")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("file_created_at")
      .execute(),
    db.selectFrom("project_finance").selectAll().where("project_id", "in", ids).execute(),
    db
      .selectFrom("project_sdg")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("sdg_number")
      .execute(),
    db
      .selectFrom("cobenefit_method")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("sort")
      .execute(),
    db
      .selectFrom("project_landowner")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("sort")
      .execute(),
    db.selectFrom("project_stakeholder").selectAll().where("project_id", "in", ids).execute(),
    db.selectFrom("project_label").selectAll().where("project_id", "in", ids).execute(),
    db
      .selectFrom("validation_event")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("sequence")
      .execute(),
    db
      .selectFrom("verification_event")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("sequence")
      .execute(),
    db
      .selectFrom("estimation")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("sequence")
      .execute(),
    db
      .selectFrom("estimation_vintage")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("vintage_start_on")
      .execute(),
    db
      .selectFrom("milestone")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("due_on")
      .execute(),
    db
      .selectFrom("issuance")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("sequence")
      .execute(),
    db
      .selectFrom("unit_block")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("serial_number")
      .execute(),
    db
      .selectFrom("unit_status_history")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("sequence")
      .execute(),
    db
      .selectFrom("transfer")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("requested_at")
      .execute(),
    db
      .selectFrom("retirement")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("retired_at")
      .execute(),
    db
      .selectFrom("cancellation")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("cancelled_at")
      .execute(),
    db
      .selectFrom("buffer_pool_entry")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("occurred_on")
      .execute(),
    db
      .selectFrom("unit_label")
      .innerJoin("unit_block", "unit_block.id", "unit_label.block_id")
      .select(["unit_label.block_id", "unit_label.label_id"])
      .where("unit_block.project_id", "in", ids)
      .execute(),
    db
      .selectFrom("document")
      .selectAll()
      .where("project_id", "in", ids)
      .orderBy("uploaded_at")
      .execute(),
    db.selectFrom("agreement").selectAll().where("project_id", "in", ids).execute(),
    db
      .selectFrom("agreement_offtake")
      .innerJoin("agreement", "agreement.id", "agreement_offtake.agreement_id")
      .selectAll("agreement_offtake")
      .where("agreement.project_id", "in", ids)
      .execute(),
    db
      .selectFrom("agreement_insurance")
      .innerJoin("agreement", "agreement.id", "agreement_insurance.agreement_id")
      .selectAll("agreement_insurance")
      .where("agreement.project_id", "in", ids)
      .execute(),
    db
      .selectFrom("agreement_funding")
      .innerJoin("agreement", "agreement.id", "agreement_funding.agreement_id")
      .selectAll("agreement_funding")
      .where("agreement.project_id", "in", ids)
      .orderBy("agreement_funding.sequence")
      .execute(),
    db
      .selectFrom("agreement_counterparty")
      .innerJoin("agreement", "agreement.id", "agreement_counterparty.agreement_id")
      .selectAll("agreement_counterparty")
      .where("agreement.project_id", "in", ids)
      .execute(),
    db.selectFrom("cobenefit_target").selectAll().where("project_id", "in", ids).execute(),
    db.selectFrom("cobenefit_impact").selectAll().where("project_id", "in", ids).execute(),
  ]);

  const byProject = {
    locations: groupBy(locations, (r) => r.project_id),
    mitigations: groupBy(mitigations, (r) => r.project_id),
    status: groupBy(status, (r) => r.project_id),
    periods: groupBy(periods, (r) => r.project_id),
    geo: groupBy(geo, (r) => r.project_id),
    finance: new Map(finance.map((f) => [f.project_id, f])),
    sdgs: groupBy(sdgs, (r) => r.project_id),
    methods: groupBy(methods, (r) => r.project_id),
    landowners: groupBy(landowners, (r) => r.project_id),
    stakeholders: groupBy(stakeholders, (r) => r.project_id),
    labels: groupBy(labels, (r) => r.project_id),
    validations: groupBy(validations, (r) => r.project_id),
    verifications: groupBy(verifications, (r) => r.project_id),
    estimations: groupBy(estimations, (r) => r.project_id),
    milestones: groupBy(milestones, (r) => r.project_id),
    issuances: groupBy(issuances, (r) => r.project_id),
    blocks: groupBy(blocks, (r) => r.project_id),
    transfers: groupBy(transfers, (r) => r.project_id),
    retirements: groupBy(retirements, (r) => r.project_id),
    cancellations: groupBy(cancellations, (r) => r.project_id),
    buffer: groupBy(buffer, (r) => r.project_id),
    documents: groupBy(documents, (r) => r.project_id),
    agreements: groupBy(agreements, (r) => r.project_id),
    targets: groupBy(targets, (r) => r.project_id),
  };
  const vintagesByEstimation = groupBy(vintages, (r) => r.estimation_id);
  const historyByBlock = groupBy(history, (r) => r.block_id);
  const labelsByBlock = groupBy(unitLabels, (r) => r.block_id);
  const offtakesByAgreement = groupBy(offtakes, (r) => r.agreement_id);
  const insuranceByAgreement = groupBy(insurance, (r) => r.agreement_id);
  const fundingByAgreement = groupBy(funding, (r) => r.agreement_id);
  const counterpartiesByAgreement = groupBy(counterparties, (r) => r.agreement_id);
  const impactsByTarget = groupBy(impacts, (r) => r.target_id);

  const order = new Map(ids.map((id, i) => [id, i]));
  return projects
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((p) => {
      const fin = byProject.finance.get(p.id);
      const agg: ProjectAggregate = {
        id: p.id,
        project_identifier: p.project_identifier,
        registry_id: p.registry_id,
        standard_id: p.standard_id,
        crediting_program_id: p.crediting_program_id,
        native_project_id: p.native_project_id,
        name: p.name,
        lifecycle_state: p.lifecycle_state as LifecycleState,
        native_state_code: p.native_state_code,
        cdop_project_status: p.cdop_project_status as CdopProjectStatus,
        is_on_hold: p.is_on_hold,
        country_code: p.country_code,
        country_name: p.country_name,
        region_code: p.region_code,
        region_name: p.region_name,
        centroid: [Number(p.centroid_lon ?? 0), Number(p.centroid_lat ?? 0)],
        bbox: [
          Number(p.min_lon ?? 0),
          Number(p.min_lat ?? 0),
          Number(p.max_lon ?? 0),
          Number(p.max_lat ?? 0),
        ],
        unit_metric: p.unit_metric as "tCO2e" | "tCO2",
        attestations: json<Record<string, unknown>>(p.attestations),
        native_attributes: json<Record<string, unknown>>(p.native_attributes),
        created_at: dt(p.created_at) as Date,
        modified_at: dt(p.modified_at) as Date,
        locations: (byProject.locations.get(p.id) ?? []).map((l) => {
          const out: ProjectAggregate["locations"][number] = {
            id: l.id,
            kind: l.kind as "project" | "facility",
            is_primary: l.is_primary,
            country_code: l.country_code,
            country_name: l.country_name,
            region_code: l.region_code,
            region_name: l.region_name,
            sort: l.sort,
          };
          defineOptional(out, "subdivision_code", und(l.subdivision_code));
          defineOptional(out, "subdivision_name", und(l.subdivision_name));
          defineOptional(out, "address_line_1", und(l.address_line_1));
          defineOptional(out, "address_line_2", und(l.address_line_2));
          defineOptional(out, "alternative_address", und(l.alternative_address));
          defineOptional(out, "city", und(l.city));
          defineOptional(out, "postal_code", und(l.postal_code));
          return out;
        }),
        mitigations: (byProject.mitigations.get(p.id) ?? []).map((m) => ({
          id: m.id,
          mitigation_type: m.mitigation_type,
          project_sector: m.project_sector,
          project_type: m.project_type,
          estimated_annual_mitigation: Number(m.estimated_annual_mitigation),
          estimated_total_mitigation: Number(m.estimated_total_mitigation),
          sort: m.sort,
        })),
        statusHistory: (byProject.status.get(p.id) ?? []).map((s) => {
          const out: ProjectAggregate["statusHistory"][number] = {
            id: s.id,
            sequence: s.sequence,
            lifecycle_state: s.lifecycle_state as LifecycleState,
            native_state_code: s.native_state_code,
            cdop_project_status: s.cdop_project_status as CdopProjectStatus,
            actor_kind: s.actor_kind as ProjectAggregate["statusHistory"][number]["actor_kind"],
            effective_at: dt(s.effective_at) as Date,
            is_current: s.is_current,
          };
          defineOptional(out, "native_state_name", und(s.native_state_name));
          defineOptional(out, "action", und(s.action));
          defineOptional(out, "intent", und(s.intent));
          defineOptional(out, "reason", und(s.reason));
          defineOptional(out, "actor_account_id", und(s.actor_account_id));
          return out;
        }),
        creditingPeriods: (byProject.periods.get(p.id) ?? []).map((c) => {
          const out: ProjectAggregate["creditingPeriods"][number] = {
            id: c.id,
            number: c.number,
            start_on: dateOnly(c.start_on) as Date,
            end_on: dateOnly(c.end_on) as Date,
            duration_years: c.duration_years,
            period_type: c.period_type as "Fixed" | "Renewable",
            is_current: c.is_current,
          };
          defineOptional(out, "validation_event_id", und(c.validation_event_id));
          return out;
        }),
        geolocationFiles: (byProject.geo.get(p.id) ?? []).map((g) => {
          const out: ProjectAggregate["geolocationFiles"][number] = {
            id: g.id,
            file_name: g.file_name,
            file_format: g.file_format as "GeoJSON" | "KML" | "Shapefile",
            area_type: g.area_type,
            geometry_type: g.geometry_type as "Polygon" | "MultiPolygon",
            file_status:
              g.file_status as ProjectAggregate["geolocationFiles"][number]["file_status"],
            validity_start_on: dateOnly(g.validity_start_on) as Date,
            file_created_at: dt(g.file_created_at) as Date,
            crs: "EPSG:4326",
            geojson: json(g.geojson),
            bbox: [Number(g.min_lon), Number(g.min_lat), Number(g.max_lon), Number(g.max_lat)],
          };
          defineOptional(out, "validity_end_on", dateOnly(g.validity_end_on));
          defineOptional(out, "file_edited_at", dt(g.file_edited_at));
          defineOptional(out, "file_deleted_at", dt(g.file_deleted_at));
          defineOptional(out, "area_ha", num(g.area_ha));
          return out;
        }),
        sdgs: (byProject.sdgs.get(p.id) ?? []).map((s) => s.sdg_number),
        cobenefitMethods: (byProject.methods.get(p.id) ?? []).map((m) => m.method),
        landowners: (byProject.landowners.get(p.id) ?? []).map((l) => l.name),
        stakeholders: (byProject.stakeholders.get(p.id) ?? []).map((s) => {
          const out: ProjectAggregate["stakeholders"][number] = {
            id: s.id,
            organisation_id: s.organisation_id,
            stakeholder_type: s.stakeholder_type,
            is_primary_developer: s.is_primary_developer,
          };
          defineOptional(out, "role_started_on", dateOnly(s.role_started_on));
          defineOptional(out, "role_ended_on", dateOnly(s.role_ended_on));
          return out;
        }),
        labels: (byProject.labels.get(p.id) ?? []).map((l) => {
          const out: ProjectAggregate["labels"][number] = {
            id: l.id,
            label_id: l.label_id,
            kind: l.kind as ProjectAggregate["labels"][number]["kind"],
          };
          defineOptional(out, "start_on", dateOnly(l.start_on));
          defineOptional(out, "expiry_on", dateOnly(l.expiry_on));
          defineOptional(out, "approved_on", dateOnly(l.approved_on));
          defineOptional(out, "url", und(l.url));
          defineOptional(out, "accreditation_id", und(l.accreditation_id));
          return out;
        }),
        validations: (byProject.validations.get(p.id) ?? []).map((v) => {
          const out: ProjectAggregate["validations"][number] = {
            id: v.id,
            sequence: v.sequence,
            validation_type: v.validation_type,
            status: v.status as ProjectAggregate["validations"][number]["status"],
          };
          defineOptional(out, "vvb_organisation_id", und(v.vvb_organisation_id));
          defineOptional(out, "vvb_account_id", und(v.vvb_account_id));
          defineOptional(out, "submitted_on", dateOnly(v.submitted_on));
          defineOptional(out, "site_visit_start_on", dateOnly(v.site_visit_start_on));
          defineOptional(out, "site_visit_end_on", dateOnly(v.site_visit_end_on));
          defineOptional(out, "decided_on", dateOnly(v.decided_on));
          defineOptional(out, "opinion", und(v.opinion));
          defineOptional(out, "crediting_period_id", und(v.crediting_period_id));
          defineOptional(out, "report_document_id", und(v.report_document_id));
          defineOptional(out, "statement_document_id", und(v.statement_document_id));
          defineOptional(out, "report_url", und(v.report_url));
          defineOptional(out, "expires_on", dateOnly(v.expires_on));
          defineOptional(out, "notes", und(v.notes));
          return out;
        }),
        verifications: (byProject.verifications.get(p.id) ?? []).map((v) => {
          const out: ProjectAggregate["verifications"][number] = {
            id: v.id,
            sequence: v.sequence,
            monitoring_period_start_on: dateOnly(v.monitoring_period_start_on) as Date,
            monitoring_period_end_on: dateOnly(v.monitoring_period_end_on) as Date,
            status: v.status as ProjectAggregate["verifications"][number]["status"],
            claim_type: v.claim_type,
            uom: v.uom,
            leakage_deduction: Number(v.leakage_deduction),
            buffer_deduction: Number(v.buffer_deduction),
            uncertainty_deduction: Number(v.uncertainty_deduction),
          };
          defineOptional(out, "vvb_organisation_id", und(v.vvb_organisation_id));
          defineOptional(out, "site_visit_start_on", dateOnly(v.site_visit_start_on));
          defineOptional(out, "site_visit_end_on", dateOnly(v.site_visit_end_on));
          defineOptional(out, "submitted_on", dateOnly(v.submitted_on));
          defineOptional(out, "verified_on", dateOnly(v.verified_on));
          defineOptional(out, "opinion", und(v.opinion));
          defineOptional(out, "predicted_quantity", num(v.predicted_quantity));
          defineOptional(out, "claimed_quantity", num(v.claimed_quantity));
          defineOptional(out, "gross_verified_quantity", num(v.gross_verified_quantity));
          defineOptional(out, "uncertainty_basis", und(v.uncertainty_basis));
          defineOptional(out, "uncertainty_margin", num(v.uncertainty_margin));
          defineOptional(out, "cumulative_verified_quantity", num(v.cumulative_verified_quantity));
          defineOptional(out, "issuance_id", und(v.issuance_id));
          defineOptional(out, "report_document_id", und(v.report_document_id));
          defineOptional(out, "statement_document_id", und(v.statement_document_id));
          defineOptional(out, "report_url", und(v.report_url));
          return out;
        }),
        estimations: (byProject.estimations.get(p.id) ?? []).map((e) => {
          const out: Estimation = {
            id: e.id,
            sequence: e.sequence,
            event_on: dateOnly(e.event_on) as Date,
            status: e.status as Estimation["status"],
            is_current: e.is_current,
            vintages: (vintagesByEstimation.get(e.id) ?? []).map((v) => {
              const vo: Estimation["vintages"][number] = {
                id: v.id,
                vintage_start_on: dateOnly(v.vintage_start_on) as Date,
                vintage_end_on: dateOnly(v.vintage_end_on) as Date,
                vintage_year: v.vintage_year,
                estimated_mitigation: Number(v.estimated_mitigation),
              };
              defineOptional(vo, "estimated_claimable", num(v.estimated_claimable));
              defineOptional(vo, "estimated_buffer", num(v.estimated_buffer));
              defineOptional(vo, "monitoring_start_on", dateOnly(v.monitoring_start_on));
              defineOptional(vo, "monitoring_end_on", dateOnly(v.monitoring_end_on));
              defineOptional(vo, "estimated_issuance_on", dateOnly(v.estimated_issuance_on));
              return vo;
            }),
          };
          defineOptional(out, "status_reason", und(e.status_reason));
          defineOptional(
            out,
            "validated_by_validation_event_id",
            und(e.validated_by_validation_event_id),
          );
          defineOptional(out, "superseded_by_estimation_id", und(e.superseded_by_estimation_id));
          defineOptional(out, "total_mitigation", num(e.total_mitigation));
          defineOptional(out, "annual_mitigation", num(e.annual_mitigation));
          defineOptional(out, "total_years", und(e.total_years));
          return out;
        }),
        milestones: (byProject.milestones.get(p.id) ?? []).map((m) => {
          const out: ProjectAggregate["milestones"][number] = {
            id: m.id,
            kind: m.kind as ProjectAggregate["milestones"][number]["kind"],
            name: m.name,
            sequence: m.sequence,
            due_on: dateOnly(m.due_on) as Date,
          };
          defineOptional(out, "completed_at", dt(m.completed_at));
          defineOptional(
            out,
            "completed_by_validation_event_id",
            und(m.completed_by_validation_event_id),
          );
          defineOptional(
            out,
            "completed_by_verification_event_id",
            und(m.completed_by_verification_event_id),
          );
          return out;
        }),
        issuances: (byProject.issuances.get(p.id) ?? []).map((i) => {
          const out: ProjectAggregate["issuances"][number] = {
            id: i.id,
            batch_identifier: i.batch_identifier,
            sequence: i.sequence,
            kind: i.kind as ProjectAggregate["issuances"][number]["kind"],
            status: i.status as ProjectAggregate["issuances"][number]["status"],
            unit_type: i.unit_type,
            unit_class: i.unit_class as "credit" | "pending" | "buffer",
            metric: i.metric,
            vintage_start_on: dateOnly(i.vintage_start_on) as Date,
            vintage_end_on: dateOnly(i.vintage_end_on) as Date,
            vintage_label: i.vintage_label,
            volume: Number(i.volume),
            cumulative_volume: Number(i.cumulative_volume),
          };
          defineOptional(out, "verification_event_id", und(i.verification_event_id));
          defineOptional(out, "validation_event_id", und(i.validation_event_id));
          defineOptional(out, "issued_on", dateOnly(i.issued_on));
          defineOptional(out, "requested_on", dateOnly(i.requested_on));
          defineOptional(out, "recipient_account_id", und(i.recipient_account_id));
          defineOptional(out, "url", und(i.url));
          return out;
        }),
        blocks: (byProject.blocks.get(p.id) ?? []).map((b) => {
          const out: UnitBlock = {
            id: b.id,
            issuance_id: b.issuance_id,
            serial_number: b.serial_number,
            block_start: Number(b.block_start),
            block_end: Number(b.block_end),
            unit_type: b.unit_type,
            unit_class: b.unit_class as "credit" | "pending" | "buffer",
            metric: b.metric,
            vintage_start_on: dateOnly(b.vintage_start_on) as Date,
            vintage_end_on: dateOnly(b.vintage_end_on) as Date,
            vintage_label: b.vintage_label,
            owner_account_id: b.owner_account_id,
            state: b.state as UnitState,
            cdop_status: b.cdop_status,
            labels: (labelsByBlock.get(b.id) ?? []).map((l) => l.label_id),
            history: (historyByBlock.get(b.id) ?? []).map((h) => {
              const ho: UnitBlock["history"][number] = {
                id: h.id,
                sequence: h.sequence,
                to_state: h.to_state as UnitState,
                cdop_status: h.cdop_status,
                action: h.action,
                actor_kind: h.actor_kind as UnitBlock["history"][number]["actor_kind"],
                effective_at: dt(h.effective_at) as Date,
                is_current: h.is_current,
              };
              defineOptional(ho, "from_state", und(h.from_state) as UnitState | undefined);
              defineOptional(ho, "reason", und(h.reason));
              defineOptional(ho, "actor_account_id", und(h.actor_account_id));
              defineOptional(ho, "from_owner_account_id", und(h.from_owner_account_id));
              defineOptional(ho, "to_owner_account_id", und(h.to_owner_account_id));
              defineOptional(ho, "quantity", num(h.quantity));
              return ho;
            }),
          };
          defineOptional(out, "source_block_id", und(b.source_block_id));
          defineOptional(out, "state_reason", und(b.state_reason));
          defineOptional(out, "native_status_code", und(b.native_status_code));
          defineOptional(out, "native_status_name", und(b.native_status_name));
          defineOptional(out, "retirement_id", und(b.retirement_id));
          defineOptional(out, "cancellation_id", und(b.cancellation_id));
          return out;
        }),
        transfers: (byProject.transfers.get(p.id) ?? []).map((t) => {
          const out: ProjectAggregate["transfers"][number] = {
            id: t.id,
            block_id: t.block_id,
            kind: t.kind as ProjectAggregate["transfers"][number]["kind"],
            from_account_id: t.from_account_id,
            to_account_id: t.to_account_id,
            quantity: Number(t.quantity),
            status: t.status as ProjectAggregate["transfers"][number]["status"],
            requested_at: dt(t.requested_at) as Date,
          };
          defineOptional(out, "price", num(t.price));
          defineOptional(out, "currency", und(t.currency));
          defineOptional(out, "settled_at", dt(t.settled_at));
          defineOptional(out, "remarks", und(t.remarks));
          return out;
        }),
        retirements: (byProject.retirements.get(p.id) ?? []).map((r) => {
          const out: ProjectAggregate["retirements"][number] = {
            id: r.id,
            block_id: r.block_id,
            account_id: r.account_id,
            quantity: Number(r.quantity),
            retired_at: dt(r.retired_at) as Date,
            vintage_label: r.vintage_label,
          };
          defineOptional(out, "beneficiary_name", und(r.beneficiary_name));
          defineOptional(out, "beneficiary_organisation_id", und(r.beneficiary_organisation_id));
          defineOptional(
            out,
            "purpose",
            und(r.purpose) as ProjectAggregate["retirements"][number]["purpose"],
          );
          defineOptional(out, "detail", und(r.detail));
          defineOptional(out, "certificate_document_id", und(r.certificate_document_id));
          return out;
        }),
        cancellations: (byProject.cancellations.get(p.id) ?? []).map((c) => {
          const out: ProjectAggregate["cancellations"][number] = {
            id: c.id,
            block_id: c.block_id,
            quantity: Number(c.quantity),
            cancelled_at: dt(c.cancelled_at) as Date,
            reason: c.reason as ProjectAggregate["cancellations"][number]["reason"],
          };
          defineOptional(out, "account_id", und(c.account_id));
          defineOptional(out, "detail", und(c.detail));
          defineOptional(out, "replacement_block_id", und(c.replacement_block_id));
          return out;
        }),
        bufferEntries: (byProject.buffer.get(p.id) ?? []).map((e) => {
          const out: ProjectAggregate["bufferEntries"][number] = {
            id: e.id,
            standard_id: e.standard_id,
            kind: e.kind as ProjectAggregate["bufferEntries"][number]["kind"],
            quantity: Number(e.quantity),
            occurred_on: dateOnly(e.occurred_on) as Date,
          };
          defineOptional(out, "block_id", und(e.block_id));
          defineOptional(out, "verification_event_id", und(e.verification_event_id));
          defineOptional(out, "notes", und(e.notes));
          return out;
        }),
        documents: (byProject.documents.get(p.id) ?? []).map((doc) => {
          const out: ProjectAggregate["documents"][number] = {
            id: doc.id,
            document_type_id: doc.document_type_id,
            title: doc.title,
            file_name: doc.file_name,
            content_type: doc.content_type,
            is_public: doc.is_public,
            uploaded_at: dt(doc.uploaded_at) as Date,
            extracted: json<Record<string, unknown>>(doc.extracted),
          };
          defineOptional(out, "validation_event_id", und(doc.validation_event_id));
          defineOptional(out, "verification_event_id", und(doc.verification_event_id));
          defineOptional(out, "issuance_id", und(doc.issuance_id));
          defineOptional(out, "size_bytes", und(doc.size_bytes));
          defineOptional(out, "uploaded_by_account_id", und(doc.uploaded_by_account_id));
          defineOptional(out, "document_date", dateOnly(doc.document_date));
          defineOptional(out, "version_label", und(doc.version_label));
          return out;
        }),
        agreements: (byProject.agreements.get(p.id) ?? []).map((a) => {
          const out: Agreement = {
            id: a.id,
            agreement_type: a.agreement_type,
            marketplace_or_venue: a.marketplace_or_venue,
            collateral_type: a.collateral_type,
            offtakes: (offtakesByAgreement.get(a.id) ?? []).map((o) => {
              const oo: Agreement["offtakes"][number] = { id: o.id };
              defineOptional(oo, "contracted_volume", num(o.contracted_volume));
              defineOptional(oo, "contracted_price", num(o.contracted_price));
              defineOptional(oo, "vintage_start_year", und(o.vintage_start_year));
              defineOptional(oo, "vintage_end_year", und(o.vintage_end_year));
              defineOptional(oo, "requirements", und(o.requirements));
              return oo;
            }),
            insurance: (insuranceByAgreement.get(a.id) ?? []).map((i) => {
              const io: Agreement["insurance"][number] = {
                id: i.id,
                policy_exists: i.policy_exists,
              };
              defineOptional(io, "insurer_name", und(i.insurer_name));
              defineOptional(io, "policy_reference", und(i.policy_reference));
              defineOptional(io, "coverage_type", und(i.coverage_type));
              return io;
            }),
            funding: (fundingByAgreement.get(a.id) ?? []).map((f) => {
              const fo: Agreement["funding"][number] = {
                id: f.id,
                sequence: f.sequence,
                source_category: f.source_category,
                is_current: f.is_current,
              };
              defineOptional(fo, "expected_disbursement_on", dateOnly(f.expected_disbursement_on));
              defineOptional(fo, "disbursement_schedule", und(f.disbursement_schedule));
              defineOptional(fo, "conditions_precedent", und(f.conditions_precedent));
              defineOptional(fo, "is_fully_committed", und(f.is_fully_committed));
              defineOptional(fo, "commitment_status", und(f.commitment_status));
              defineOptional(fo, "status_reason", und(f.status_reason));
              return fo;
            }),
            counterparties: (counterpartiesByAgreement.get(a.id) ?? []).map((c) => {
              const co: Agreement["counterparties"][number] = {
                organisation_id: c.organisation_id,
                role: c.role,
              };
              defineOptional(co, "sector", und(c.sector));
              return co;
            }),
          };
          defineOptional(out, "notes", und(a.notes));
          defineOptional(out, "currency", und(a.currency));
          defineOptional(out, "commitment_amount", num(a.commitment_amount));
          defineOptional(out, "effective_on", dateOnly(a.effective_on));
          defineOptional(out, "expiry_on", dateOnly(a.expiry_on));
          defineOptional(out, "governing_law", und(a.governing_law));
          defineOptional(out, "financing_stage", und(a.financing_stage));
          return out;
        }),
        cobenefits: (byProject.targets.get(p.id) ?? []).map((t) => {
          const out: CobenefitTarget = {
            id: t.id,
            cobenefit_type: t.cobenefit_type,
            indicator_id: t.indicator_id,
            impacts: (impactsByTarget.get(t.id) ?? []).map((i) => {
              const io: CobenefitTarget["impacts"][number] = { id: i.id };
              defineOptional(io, "verification_event_id", und(i.verification_event_id));
              defineOptional(io, "achieved_impact", und(i.achieved_impact));
              defineOptional(io, "achieved_value", und(i.achieved_value));
              defineOptional(io, "change_type", und(i.change_type));
              defineOptional(io, "supporting_evidence_url", und(i.supporting_evidence_url));
              defineOptional(io, "reported_on", dateOnly(i.reported_on));
              return io;
            }),
          };
          defineOptional(out, "impact_overview", und(t.impact_overview));
          defineOptional(out, "approach", und(t.approach));
          defineOptional(out, "unit_description", und(t.unit_description));
          defineOptional(out, "unit_type", und(t.unit_type));
          defineOptional(out, "unit_symbol", und(t.unit_symbol));
          defineOptional(out, "monitoring_frequency", und(t.monitoring_frequency));
          defineOptional(out, "baseline_value", und(t.baseline_value));
          defineOptional(out, "target_value", und(t.target_value));
          defineOptional(out, "supporting_evidence_url", und(t.supporting_evidence_url));
          return out;
        }),
      };
      defineOptional(agg, "standard_version_id", und(p.standard_version_id));
      defineOptional(agg, "methodology_version_id", und(p.methodology_version_id));
      defineOptional(agg, "native_project_url", und(p.native_project_url));
      defineOptional(agg, "description", und(p.description));
      defineOptional(agg, "program_type", und(p.program_type) as ProjectAggregate["program_type"]);
      defineOptional(agg, "activity_type", und(p.activity_type));
      defineOptional(agg, "master_project_id", und(p.master_project_id));
      defineOptional(agg, "developer_account_id", und(p.developer_account_id));
      defineOptional(agg, "developer_organisation_id", und(p.developer_organisation_id));
      defineOptional(agg, "vvb_organisation_id", und(p.vvb_organisation_id));
      defineOptional(agg, "native_state_name", und(p.native_state_name));
      defineOptional(agg, "listed_on", dateOnly(p.listed_on));
      defineOptional(agg, "registered_on", dateOnly(p.registered_on));
      defineOptional(agg, "validated_on", dateOnly(p.validated_on));
      defineOptional(agg, "first_verified_on", dateOnly(p.first_verified_on));
      defineOptional(agg, "closed_on", dateOnly(p.closed_on));
      defineOptional(agg, "validation_deadline_on", dateOnly(p.validation_deadline_on));
      defineOptional(agg, "subdivision_code", und(p.subdivision_code));
      defineOptional(agg, "subdivision_name", und(p.subdivision_name));
      defineOptional(agg, "city", und(p.city));
      defineOptional(agg, "grid_reference", und(p.grid_reference));
      defineOptional(agg, "area_ha", num(p.area_ha));
      defineOptional(agg, "start_on", dateOnly(p.start_on));
      defineOptional(agg, "end_on", dateOnly(p.end_on));
      defineOptional(agg, "duration_years", und(p.duration_years));
      defineOptional(
        agg,
        "crediting_period_type",
        und(p.crediting_period_type) as ProjectAggregate["crediting_period_type"],
      );
      defineOptional(agg, "max_cumulative_crediting_years", und(p.max_cumulative_crediting_years));
      defineOptional(agg, "max_crediting_periods", und(p.max_crediting_periods));
      defineOptional(agg, "estimated_annual_mitigation", num(p.estimated_annual_mitigation));
      defineOptional(agg, "estimated_total_mitigation", num(p.estimated_total_mitigation));
      defineOptional(agg, "estimated_total_years", und(p.estimated_total_years));
      defineOptional(agg, "buffer_rate", num(p.buffer_rate));
      defineOptional(agg, "governance_structure", und(p.governance_structure));
      defineOptional(agg, "community_frameworks", und(p.community_frameworks));
      defineOptional(agg, "public_comment", und(p.public_comment));
      defineOptional(agg, "public_comment_summary", und(p.public_comment_summary));
      defineOptional(agg, "previous_program", und(p.previous_program));
      defineOptional(
        agg,
        "project_risk",
        p.project_risk === null ? undefined : json<Record<string, unknown>>(p.project_risk),
      );
      if (fin) {
        const f: NonNullable<ProjectAggregate["finance"]> = {
          financing_options: fin.financing_options,
          community_benefit_mechanisms: fin.community_benefit_mechanisms,
        };
        defineOptional(f, "expected_initial_costs", num(fin.expected_initial_costs));
        defineOptional(f, "expected_annual_costs", num(fin.expected_annual_costs));
        defineOptional(f, "expected_annual_revenue", num(fin.expected_annual_revenue));
        defineOptional(f, "total_funding_required", num(fin.total_funding_required));
        defineOptional(f, "total_funding_secured", num(fin.total_funding_secured));
        defineOptional(f, "expected_community_proceeds", num(fin.expected_community_proceeds));
        defineOptional(
          f,
          "declaring_entity_organisation_id",
          und(fin.declaring_entity_organisation_id),
        );
        defineOptional(f, "expected_credit_price", num(fin.expected_credit_price));
        defineOptional(f, "realized_transaction_price", num(fin.realized_transaction_price));
        defineOptional(f, "currency", und(fin.currency));
        agg.finance = f;
      }
      return agg;
    });
}

export async function loadAggregate(
  db: Database,
  id: string,
): Promise<ProjectAggregate | undefined> {
  const [agg] = await loadAggregates(db, [id]);
  return agg;
}
