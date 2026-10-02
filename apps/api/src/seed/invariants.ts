/**
 * Properties every generated dataset must hold before it is written. Returns a list of
 * human-readable violations (empty means the dataset is sound). The seed CLI refuses to
 * write a dataset that violates any; the test suite asserts the same list is empty.
 */
import { enumValues } from "@cdop/schemas";
import type { Dataset, ProjectAggregate } from "./aggregate.js";
import { machineFor, nativeState } from "../domain/lifecycle/index.js";
import { blockQuantity } from "./ledger-core.js";
import { containsDeniedName } from "./names/uk.js";
import { DOCUMENT_TYPES, LABELS, METHODOLOGIES, REGISTRIES, STANDARDS } from "./vocab.js";

/** 08:12–17:48 UTC on a weekday, as time.ts generates. */
function inBusinessHours(d: Date): boolean {
  const day = d.getUTCDay();
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  return day >= 1 && day <= 5 && minutes >= 8 * 60 + 12 && minutes <= 17 * 60 + 48;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const v of values) (seen.has(v) ? out : seen).add(v);
  return [...out];
}

/** `value` must be one of the vendored schema's enum values at `path` (skipped if the path has no enum). */
function checkEnum(out: string[], where: string, path: string, value: string | undefined): void {
  if (value === undefined) return;
  const allowed = enumValues(path);
  if (allowed && !allowed.includes(value))
    out.push(`${where}: "${value}" is not a CDOP value for ${path}`);
}

function checkStatusHistory(out: string[], p: ProjectAggregate, now: Date): void {
  const rows = p.statusHistory;
  const machine = machineFor(p.standard_id);
  if (rows.length === 0) return void out.push(`${p.id}: no status history`);
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    if (r.sequence !== i + 1)
      out.push(`${p.id}: status sequence ${r.sequence} at position ${i + 1}`);
    if (r.is_current !== (i === rows.length - 1))
      out.push(`${p.id}: status row ${r.sequence} is_current=${r.is_current}`);
    if (!inBusinessHours(r.effective_at))
      out.push(
        `${p.id}: status row ${r.sequence} outside weekday business hours (${r.effective_at.toISOString()})`,
      );
    if (r.effective_at.getTime() >= now.getTime())
      out.push(`${p.id}: status row ${r.sequence} is in the future`);
    if (!nativeState(p.standard_id, r.native_state_code))
      out.push(`${p.id}: unknown native state ${r.native_state_code}`);
    if (!prev) return;
    if (r.effective_at.getTime() <= prev.effective_at.getTime())
      out.push(`${p.id}: status row ${r.sequence} does not follow row ${prev.sequence} in time`);
    if (
      !machine.transitions.some(
        (t) =>
          t.from === prev.native_state_code &&
          t.action === r.action &&
          t.to === r.native_state_code,
      )
    )
      out.push(
        `${p.id}: illegal transition ${prev.native_state_code} -${r.action ?? "?"}-> ${r.native_state_code}`,
      );
  });
  const last = rows[rows.length - 1];
  if (
    last &&
    (last.native_state_code !== p.native_state_code ||
      last.lifecycle_state !== p.lifecycle_state ||
      last.cdop_project_status !== p.cdop_project_status)
  )
    out.push(`${p.id}: project status columns disagree with the current status row`);
}

function checkEstimations(out: string[], p: ProjectAggregate): void {
  if (p.estimations.filter((e) => e.is_current).length !== 1)
    out.push(`${p.id}: expected exactly one current estimation`);
  for (const e of p.estimations) {
    const sum = e.vintages.reduce((s, v) => s + v.estimated_mitigation, 0);
    if (e.total_mitigation !== undefined && sum > e.total_mitigation)
      out.push(
        `${p.id}: estimation ${e.sequence} vintages sum to ${sum}, over the total ${e.total_mitigation}`,
      );
    for (const v of e.vintages) {
      if ((v.estimated_claimable ?? 0) + (v.estimated_buffer ?? 0) !== v.estimated_mitigation)
        out.push(`${p.id}: vintage ${v.vintage_year} claimable + buffer != mitigation`);
      if (v.vintage_end_on.getTime() < v.vintage_start_on.getTime())
        out.push(`${p.id}: vintage ${v.vintage_year} ends before it starts`);
    }
  }
}

function checkLedger(out: string[], p: ProjectAggregate, now: Date): void {
  // Conservation: every issued unit sits in exactly one block (splits and conversions included).
  const issued = p.issuances.reduce((s, i) => s + i.volume, 0);
  const held = p.blocks.reduce((s, b) => s + blockQuantity(b), 0);
  if (issued !== held) out.push(`${p.id}: issued ${issued} units but blocks hold ${held}`);

  let running = 0;
  for (const i of [...p.issuances].sort((a, b) => a.sequence - b.sequence)) {
    running += i.volume;
    if (i.cumulative_volume !== running)
      out.push(
        `${p.id}: issuance ${i.sequence} cumulative_volume ${i.cumulative_volume}, expected ${running}`,
      );
    if (i.volume <= 0) out.push(`${p.id}: issuance ${i.sequence} has volume ${i.volume}`);
  }

  const byType = new Map<string, ProjectAggregate["blocks"]>();
  for (const b of p.blocks) byType.set(b.unit_type, [...(byType.get(b.unit_type) ?? []), b]);
  for (const [unitType, blocks] of byType) {
    const sorted = [...blocks].sort((a, b) => a.block_start - b.block_start);
    sorted.forEach((b, i) => {
      const prev = sorted[i - 1];
      if (prev && b.block_start <= prev.block_end)
        out.push(
          `${p.id}: ${unitType} ranges overlap (${prev.block_start}-${prev.block_end} and ${b.block_start}-${b.block_end})`,
        );
    });
  }

  for (const b of p.blocks) {
    if (b.block_end < b.block_start) out.push(`${p.id}: block ${b.id} has an empty range`);
    if (b.history.length === 0) {
      out.push(`${p.id}: block ${b.id} has no history`);
      continue;
    }
    b.history.forEach((h, i) => {
      const prev = b.history[i - 1];
      if (h.sequence !== i + 1)
        out.push(`${p.id}: block ${b.id} history sequence ${h.sequence} at position ${i + 1}`);
      if (h.is_current !== (i === b.history.length - 1))
        out.push(`${p.id}: block ${b.id} row ${h.sequence} is_current=${h.is_current}`);
      if (!inBusinessHours(h.effective_at))
        out.push(`${p.id}: block ${b.id} row ${h.sequence} outside weekday business hours`);
      if (h.effective_at.getTime() >= now.getTime())
        out.push(`${p.id}: block ${b.id} row ${h.sequence} is in the future`);
      if (prev && h.effective_at.getTime() < prev.effective_at.getTime())
        out.push(`${p.id}: block ${b.id} history goes back in time at row ${h.sequence}`);
    });
    const last = b.history[b.history.length - 1];
    if (last && last.to_state !== b.state)
      out.push(`${p.id}: block ${b.id} state ${b.state} but history ends at ${last.to_state}`);
    if (
      b.state === "retired" &&
      !p.retirements.some((r) => r.id === b.retirement_id && r.quantity === blockQuantity(b))
    )
      out.push(`${p.id}: retired block ${b.id} has no matching retirement`);
    if (
      b.state === "cancelled" &&
      !p.cancellations.some((c) => c.id === b.cancellation_id && c.quantity === blockQuantity(b))
    )
      out.push(`${p.id}: cancelled block ${b.id} has no matching cancellation`);
  }

  // Ex-ante codes split each validated vintage between the developer and the buffer pool.
  const pending = STANDARDS.find((s) => s.id === p.standard_id)?.unit_type_pending;
  if (pending && p.buffer_rate !== undefined) {
    const exAnte = p.issuances.filter((i) => i.unit_type === pending);
    const total = exAnte.reduce((s, i) => s + i.volume, 0);
    const buffer = exAnte
      .filter((i) => i.unit_class === "buffer")
      .reduce((s, i) => s + i.volume, 0);
    // Per-vintage rounding moves the share by at most half a unit per vintage.
    if (total > 0 && Math.abs(buffer - total * p.buffer_rate) > exAnte.length)
      out.push(`${p.id}: ${pending} buffer share ${buffer}/${total} is not ${p.buffer_rate}`);
  }

  let cumulative = -Infinity;
  for (const v of [...p.verifications].sort((a, b) => a.sequence - b.sequence)) {
    if (v.monitoring_period_end_on.getTime() < v.monitoring_period_start_on.getTime())
      out.push(`${p.id}: verification ${v.sequence} monitoring period ends before it starts`);
    if (v.status !== "completed") continue;
    if (!v.verified_on)
      out.push(`${p.id}: completed verification ${v.sequence} has no verified_on`);
    if (v.cumulative_verified_quantity !== undefined) {
      if (v.cumulative_verified_quantity < cumulative)
        out.push(`${p.id}: cumulative verified quantity falls at verification ${v.sequence}`);
      cumulative = v.cumulative_verified_quantity;
    }
  }
}

function checkEnums(out: string[], p: ProjectAggregate): void {
  checkEnum(out, p.id, "project.program_type", p.program_type);
  for (const m of p.mitigations) {
    checkEnum(out, p.id, "project.mitigation[].mitigation_type", m.mitigation_type);
    checkEnum(out, p.id, "project.mitigation[].project_sector", m.project_sector);
    checkEnum(out, p.id, "project.mitigation[].project_type", m.project_type);
  }
  for (const v of p.validations)
    checkEnum(out, p.id, "validation.event[].validation_type", v.validation_type);
  for (const s of p.stakeholders)
    checkEnum(
      out,
      p.id,
      "project_stakeholder.stakeholders[].project_stakeholder_type",
      s.stakeholder_type,
    );
  for (const g of p.geolocationFiles) {
    checkEnum(out, p.id, "geolocation_file.location[].area_type", g.area_type);
    checkEnum(out, p.id, "geolocation_file.location[].file_status", g.file_status);
  }
  for (const o of p.finance?.financing_options ?? [])
    checkEnum(out, p.id, "project.financing_options", o);
  for (const o of p.finance?.community_benefit_mechanisms ?? [])
    checkEnum(out, p.id, "project.community_benefit_mechanism_type", o);
  for (const a of p.agreements) {
    checkEnum(out, p.id, "agreement.agreement_type", a.agreement_type);
    checkEnum(out, p.id, "agreement.agreement_currency", a.currency);
    checkEnum(out, p.id, "agreement.project_financing_stage", a.financing_stage);
    for (const c of a.collateral_type) checkEnum(out, p.id, "agreement.collateral_type", c);
    for (const f of a.funding) {
      checkEnum(
        out,
        p.id,
        "agreement.funding_details[].funding_source_category",
        f.source_category,
      );
      checkEnum(
        out,
        p.id,
        "agreement.funding_details[].funding_commitment_status",
        f.commitment_status,
      );
    }
    for (const i of a.insurance)
      checkEnum(
        out,
        p.id,
        "agreement.insurance[].agreement_insurance_coverage_type",
        i.coverage_type,
      );
    for (const c of a.counterparties) {
      checkEnum(
        out,
        p.id,
        "project_stakeholder.counterparty[].agreement_counterparty_role",
        c.role,
      );
      checkEnum(
        out,
        p.id,
        "project_stakeholder.counterparty[].agreement_counterparty_sector",
        c.sector,
      );
    }
  }
  for (const t of p.cobenefits) {
    checkEnum(out, p.id, "cobenefits.cobenefit_target[].unit_type", t.unit_type);
    checkEnum(
      out,
      p.id,
      "cobenefits.cobenefit_target[].unit_monitoring_frequency",
      t.monitoring_frequency,
    );
    for (const i of t.impacts)
      checkEnum(out, p.id, "cobenefits.cobenefit_impact[].change_type", i.change_type);
  }
}

export function checkInvariants(ds: Dataset): string[] {
  const out: string[] = [];
  const now = ds.generatedAt;
  const organisations = new Set(ds.organisations.map((o) => o.id));
  const accounts = new Set(ds.accounts.map((a) => a.id));
  const documentTypes = new Set(DOCUMENT_TYPES.map((d) => d.id));
  const labels = new Set(LABELS.map((l) => l.id));
  const standardVersions = new Set(STANDARDS.flatMap((s) => s.versions.map((v) => `${s.id}@${v}`)));
  const methodologyVersions = new Set(
    METHODOLOGIES.flatMap((m) => m.versions.map((v) => `${m.id}@${v}`)),
  );

  for (const d of duplicates(ds.projects.map((p) => p.id))) out.push(`duplicate project id ${d}`);
  for (const d of duplicates(ds.projects.map((p) => p.project_identifier)))
    out.push(`duplicate project_identifier ${d}`);
  for (const d of duplicates(ds.projects.map((p) => `${p.registry_id}:${p.native_project_id}`)))
    out.push(`duplicate native project id ${d}`);
  for (const d of duplicates(ds.projects.flatMap((p) => p.blocks.map((b) => b.serial_number))))
    out.push(`duplicate serial number ${d}`);
  for (const d of duplicates(
    ds.projects.flatMap((p) => p.issuances.map((i) => i.batch_identifier)),
  ))
    out.push(`duplicate batch identifier ${d}`);
  for (const d of duplicates(ds.accounts.map((a) => a.id))) out.push(`duplicate account id ${d}`);
  // Registry operators are the real ones (they are the id authority); every other name is invented.
  const operators = new Set(REGISTRIES.map((r) => r.operator_name ?? r.cdop_name));
  for (const o of ds.organisations)
    if (!operators.has(o.legal_name) && containsDeniedName(o.legal_name))
      out.push(`organisation name "${o.legal_name}" is on the denylist`);

  const written = new Set<string>();
  for (const p of ds.projects) {
    if (containsDeniedName(p.name))
      out.push(`${p.id}: project name "${p.name}" is on the denylist`);
    if (p.master_project_id && !written.has(p.master_project_id))
      out.push(`${p.id}: master project ${p.master_project_id} does not precede it`);
    written.add(p.id);
    if (p.developer_organisation_id && !organisations.has(p.developer_organisation_id))
      out.push(`${p.id}: unknown developer organisation`);
    if (p.vvb_organisation_id && !organisations.has(p.vvb_organisation_id))
      out.push(`${p.id}: unknown VVB organisation`);
    if (p.developer_account_id && !accounts.has(p.developer_account_id))
      out.push(`${p.id}: unknown developer account`);
    if (p.standard_version_id && !standardVersions.has(p.standard_version_id))
      out.push(`${p.id}: unknown standard version ${p.standard_version_id}`);
    if (p.methodology_version_id && !methodologyVersions.has(p.methodology_version_id))
      out.push(`${p.id}: unknown methodology version ${p.methodology_version_id}`);
    for (const b of p.blocks)
      if (!accounts.has(b.owner_account_id))
        out.push(`${p.id}: block ${b.id} owned by an unknown account`);
    for (const l of p.labels)
      if (!labels.has(l.label_id)) out.push(`${p.id}: unknown label ${l.label_id}`);
    for (const l of p.blocks.flatMap((b) => b.labels))
      if (!labels.has(l)) out.push(`${p.id}: unknown unit label ${l}`);
    for (const d of duplicates(p.milestones.map((m) => m.name)))
      out.push(`${p.id}: duplicate milestone name "${d}"`);
    for (const d of p.documents) {
      if (!documentTypes.has(d.document_type_id))
        out.push(`${p.id}: unknown document type ${d.document_type_id}`);
      if (!inBusinessHours(d.uploaded_at))
        out.push(`${p.id}: document ${d.id} uploaded outside weekday business hours`);
      if (
        d.uploaded_at.getTime() < p.created_at.getTime() ||
        d.uploaded_at.getTime() >= now.getTime()
      )
        out.push(
          `${p.id}: document ${d.id} uploaded outside the project's lifetime (${d.uploaded_at.toISOString()})`,
        );
    }
    checkStatusHistory(out, p, now);
    checkEstimations(out, p);
    checkLedger(out, p, now);
    checkEnums(out, p);
  }
  return out;
}
