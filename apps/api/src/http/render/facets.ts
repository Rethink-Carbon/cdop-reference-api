import type { ProjectAggregate } from "../../seed/aggregate.js";
import type { ProjectionContext } from "../../domain/projection/context.js";
import { documentUrl, geoFileUrl } from "../../domain/projection/cdop.js";
import { hal, type Linker, type Links } from "../hal.js";
import { clean, iso, isoTs } from "./common.js";

function facetLinks(linker: Linker, agg: ProjectAggregate, name: string, extra: Links = {}): Links {
  return {
    self: linker.link(`/v2/projects/${agg.id}/${name}`),
    curies: linker.curies(),
    up: linker.link(`/v2/projects/${agg.id}`),
    ...extra,
  };
}

export function renderStakeholders(agg: ProjectAggregate, ctx: ProjectionContext, linker: Linker) {
  const developer = ctx.org(agg.developer_organisation_id);
  return hal(
    clean({
      project_developer_name: developer?.legal_name,
      project_developer_website: developer?.website,
      project_developer_email: developer?.email,
      project_developer_phone: developer?.phone,
      organization: developer
        ? [
            clean({
              organization_legal_name: developer.legal_name,
              organization_role: developer.cdop_role,
              organization_mission: developer.mission,
              organization_team_experience: developer.team_experience,
              organization_project_employees: developer.project_employees,
              organization_employees: developer.employees,
              organization_founding_year: iso(developer.founded_on),
              organization_project_experience: developer.project_experience_years,
              organization_url: developer.website,
              country_code: developer.country_code,
            }),
          ]
        : [],
      stakeholders: agg.stakeholders.map((s) => {
        const org = ctx.org(s.organisation_id);
        return clean({
          project_stakeholder_type: s.stakeholder_type,
          project_stakeholder_name: org?.legal_name ?? s.organisation_id,
          project_stakeholder_website: org?.website,
          is_primary_developer: s.is_primary_developer,
          organisation_id: s.organisation_id,
        });
      }),
      list_of_landowners: agg.landowners,
    }),
    facetLinks(
      linker,
      agg,
      "stakeholders",
      agg.developer_account_id
        ? { [linker.rel("owner-account")]: linker.link(`/v2/accounts/${agg.developer_account_id}`) }
        : {},
    ),
  );
}

export function renderCreditingProgram(
  agg: ProjectAggregate,
  ctx: ProjectionContext,
  linker: Linker,
) {
  const standard = ctx.standard(agg.standard_id);
  const program = ctx.program(agg.crediting_program_id);
  const mv = ctx.methodologyVersion(agg.methodology_version_id);
  return hal(
    clean({
      crediting_program: program
        ? [{ crediting_program_name: program.cdop_name, id: program.id, is_current: true }]
        : [],
      standard: standard
        ? [{ standard_name: standard.cdop_name, id: standard.id, is_current: true }]
        : [],
      initial_standard_version: standard?.versions[0],
      current_standard_version:
        ctx.standardVersion(agg.standard_version_id) ??
        standard?.versions[standard.versions.length - 1],
      methodology: mv
        ? clean({
            methodology: mv.cdop_name,
            version: mv.version,
            document: mv.document_url,
            is_current: true,
          })
        : undefined,
      crediting_periods: agg.creditingPeriods.map((c) =>
        clean({
          number: c.number,
          start_date: iso(c.start_on),
          end_date: iso(c.end_on),
          duration_years: c.duration_years,
          period_type: c.period_type,
          is_current: c.is_current,
        }),
      ),
      project_crediting_period_type: agg.crediting_period_type,
      maximum_cumulative_crediting_duration: agg.max_cumulative_crediting_years,
      maximum_number_of_crediting_periods: agg.max_crediting_periods,
    }),
    facetLinks(linker, agg, "crediting-program", {
      [linker.rel("methodologies")]: linker.link(`/v2/projects/${agg.id}/methodologies`),
    }),
  );
}

export function renderMethodologies(agg: ProjectAggregate, ctx: ProjectionContext, linker: Linker) {
  const mv = ctx.methodologyVersion(agg.methodology_version_id);
  const items = mv
    ? [
        clean({
          methodology: mv.cdop_name,
          methodology_id: mv.methodology_id,
          version: mv.version,
          document: mv.document_url,
          is_current: true,
        }),
      ]
    : [];
  return hal({ total: items.length }, facetLinks(linker, agg, "methodologies"), {
    embedded: { methodologies: items },
  });
}

export function renderRegistry(agg: ProjectAggregate, ctx: ProjectionContext, linker: Linker) {
  const registry = ctx.registry(agg.registry_id);
  const links = facetLinks(linker, agg, "registry");
  const page =
    agg.native_project_url ??
    registry?.project_url_template
      ?.replace("{native_project_id}", agg.native_project_id)
      .replace("{standard}", agg.standard_id);
  if (page) links.alternate = { href: page, type: "text/html", title: "Registry page" };
  return hal(
    clean({
      origin_registry: registry?.cdop_name,
      current_registry: registry?.cdop_name,
      current_project_issuance_registry: registry?.cdop_name,
      registry_id: agg.registry_id,
      registry_url: registry?.url,
      current_registry_project_id: agg.native_project_id,
      current_registry_project_link: page,
      registry_status: clean({
        code: agg.native_state_code,
        name: agg.native_state_name,
        on_hold: agg.is_on_hold,
      }),
      previous: [],
    }),
    links,
  );
}

export function renderValidations(agg: ProjectAggregate, ctx: ProjectionContext, linker: Linker) {
  const items = agg.validations.map((v) =>
    hal(
      clean({
        id: v.id,
        validation_id: v.sequence,
        validation_type: v.validation_type,
        status: v.status,
        validation_body_name: ctx.org(v.vvb_organisation_id)?.legal_name,
        submitted_date: iso(v.submitted_on),
        site_visit_start_date: iso(v.site_visit_start_on),
        site_visit_end_date: iso(v.site_visit_end_on),
        validation_date: iso(v.decided_on),
        opinion: v.opinion,
        date_validation_expiration: iso(v.expires_on),
        validation_report: v.report_document_id
          ? documentUrl(ctx, agg.id, v.report_document_id)
          : v.report_url,
        crediting_period_id: v.crediting_period_id,
        notes: v.notes,
      }),
      {
        self: linker.link(`/v2/projects/${agg.id}/validations/${v.id}`),
        [linker.rel("project")]: linker.link(`/v2/projects/${agg.id}`),
      },
    ),
  );
  return hal({ total: items.length }, facetLinks(linker, agg, "validations"), {
    embedded: { validations: items },
  });
}

export function renderVerifications(agg: ProjectAggregate, ctx: ProjectionContext, linker: Linker) {
  const items = agg.verifications.map((v) =>
    hal(
      clean({
        id: v.id,
        verification_id: v.sequence,
        status: v.status,
        reporting_period_start: iso(v.monitoring_period_start_on),
        reporting_period_end: iso(v.monitoring_period_end_on),
        verification_body_name: ctx.org(v.vvb_organisation_id)?.legal_name,
        site_visit_start_date: iso(v.site_visit_start_on),
        site_visit_end_date: iso(v.site_visit_end_on),
        submitted_date: iso(v.submitted_on),
        verification_date: iso(v.verified_on),
        opinion: v.opinion,
        claim_type: v.claim_type,
        unit_of_measure: v.uom,
        predicted_quantity: v.predicted_quantity,
        claimed_quantity: v.claimed_quantity,
        gross_verified_quantity: v.gross_verified_quantity,
        deductions: {
          leakage: v.leakage_deduction,
          buffer: v.buffer_deduction,
          uncertainty: v.uncertainty_deduction,
          uncertainty_basis: v.uncertainty_basis,
          uncertainty_margin: v.uncertainty_margin,
        },
        verified_quantity:
          v.gross_verified_quantity !== undefined
            ? Math.round(
                (v.gross_verified_quantity -
                  v.leakage_deduction -
                  v.buffer_deduction -
                  v.uncertainty_deduction) *
                  100,
              ) / 100
            : undefined,
        cumulative_verified_quantity: v.cumulative_verified_quantity,
        verification_report_url: v.report_document_id
          ? documentUrl(ctx, agg.id, v.report_document_id)
          : v.report_url,
        issuance_id: v.issuance_id,
        provisional_shape: true,
      }),
      {
        self: linker.link(`/v2/projects/${agg.id}/verifications/${v.id}`),
        [linker.rel("project")]: linker.link(`/v2/projects/${agg.id}`),
        ...(v.issuance_id
          ? { [linker.rel("issuance")]: linker.link(`/v2/issuances/${v.issuance_id}`) }
          : {}),
      },
    ),
  );
  return hal(
    {
      total: items.length,
      note: "Verification pod is provisional: shape follows Rethink's Round 2 feedback until CDOP publishes Verification Metadata (fields 307-329).",
    },
    facetLinks(linker, agg, "verifications"),
    { embedded: { verifications: items } },
  );
}

export function renderEstimations(agg: ProjectAggregate, linker: Linker) {
  const items = agg.estimations.map((e) =>
    hal(
      clean({
        id: e.id,
        estimation_id: e.sequence,
        estimation_event_date: iso(e.event_on),
        estimation_status: e.status,
        estimated_status_reason: e.status_reason,
        is_current: e.is_current,
        estimated_total_emissions_mitigation: e.total_mitigation,
        estimated_annual_emissions_mitigation: e.annual_mitigation,
        estimated_total_years: e.total_years,
        vintages: e.vintages.map((v) =>
          clean({
            vintage_year: v.vintage_year,
            vintage_start: iso(v.vintage_start_on),
            vintage_end: iso(v.vintage_end_on),
            estimated_vintage_emissions_mitigation: v.estimated_mitigation,
            estimated_claimable: v.estimated_claimable,
            estimated_buffer: v.estimated_buffer,
            estimated_monitoring_period_start_date: iso(v.monitoring_start_on),
            estimated_monitoring_period_end_date: iso(v.monitoring_end_on),
            estimated_issuance_date: iso(v.estimated_issuance_on),
          }),
        ),
      }),
      {
        self: linker.link(`/v2/projects/${agg.id}/estimations/${e.id}`),
        [linker.rel("project")]: linker.link(`/v2/projects/${agg.id}`),
      },
    ),
  );
  return hal({ total: items.length }, facetLinks(linker, agg, "estimations"), {
    embedded: { estimations: items },
  });
}

export function renderIssuancesFacet(agg: ProjectAggregate, linker: Linker) {
  const items = agg.issuances.map((i) => renderIssuance(i, agg, linker));
  return hal({ total: items.length }, facetLinks(linker, agg, "issuances"), {
    embedded: { issuances: items },
  });
}

export function renderIssuance(
  i: ProjectAggregate["issuances"][number],
  agg: ProjectAggregate,
  linker: Linker,
) {
  const ver = agg.verifications.find((v) => v.id === i.verification_event_id);
  const blocks = agg.blocks.filter((b) => b.issuance_id === i.id);
  const links: Links = {
    self: linker.link(`/v2/issuances/${i.id}`),
    curies: linker.curies(),
    [linker.rel("project")]: linker.link(`/v2/projects/${agg.id}`),
    [linker.rel("units")]: linker.link("/v2/units", undefined, { issuance_id: i.id }),
  };
  if (ver)
    links[linker.rel("verification")] = linker.link(
      `/v2/projects/${agg.id}/verifications/${ver.id}`,
    );
  if (i.validation_event_id)
    links[linker.rel("validation")] = linker.link(
      `/v2/projects/${agg.id}/validations/${i.validation_event_id}`,
    );
  return hal(
    clean({
      id: i.id,
      batch_identifier: i.batch_identifier,
      project_id: agg.id,
      project_identifier: agg.project_identifier,
      kind: i.kind,
      issuance_status: i.status,
      unit_type: i.unit_type,
      unit_class: i.unit_class,
      metric: i.metric,
      vintage: {
        start: iso(i.vintage_start_on),
        end: iso(i.vintage_end_on),
        label: i.vintage_label,
      },
      date_of_issuance: iso(i.issued_on),
      date_requested: iso(i.requested_on),
      date_of_verification: iso(ver?.verified_on),
      verification_period_start: iso(ver?.monitoring_period_start_on),
      verification_period_end: iso(ver?.monitoring_period_end_on),
      batch_issued_volume: i.volume,
      cumulative_issued_volume: i.cumulative_volume,
      recipient_account_id: i.recipient_account_id,
      unit_blocks: blocks.length,
      issuance_url: i.url,
    }),
    links,
  );
}

export function renderCobenefits(agg: ProjectAggregate, linker: Linker) {
  return hal(
    clean({
      sdgs_the_project_plans_to_contribute_to: agg.sdgs,
      methods_used_to_assess_sdgs_and_other_cobenefits: agg.cobenefitMethods,
      cobenefit_target: agg.cobenefits.map((t) =>
        clean({
          id: t.id,
          cobenefits_type: t.cobenefit_type,
          indicator_id: t.indicator_id,
          overview_of_the_projects_impact: t.impact_overview,
          overview_of_the_projects_approach_to_track_and_quantify: t.approach,
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
          clean({
            cobenefits_type: t.cobenefit_type,
            indicator_id: t.indicator_id,
            achieved_project_impact: i.achieved_impact,
            achieved_value: i.achieved_value,
            change_type: i.change_type,
            supporting_evidence: i.supporting_evidence_url,
            reported_on: iso(i.reported_on),
            verification_event_id: i.verification_event_id,
          }),
        ),
      ),
    }),
    facetLinks(linker, agg, "cobenefits"),
  );
}

export function renderAgreements(agg: ProjectAggregate, ctx: ProjectionContext, linker: Linker) {
  const items = agg.agreements.map((a) =>
    hal(
      clean({
        id: a.id,
        agreement_type: a.agreement_type,
        agreement_notes: a.notes,
        agreement_currency: a.currency,
        agreement_commitment_amount: a.commitment_amount,
        agreement_effective_date: iso(a.effective_on),
        agreement_expiry_date: iso(a.expiry_on),
        agreement_governing_law: a.governing_law,
        project_financing_stage: a.financing_stage,
        agreement_marketplace_or_venue: a.marketplace_or_venue,
        collateral_type: a.collateral_type,
        offtake: a.offtakes,
        insurance: a.insurance,
        funding_details: a.funding.map((f) =>
          clean({ ...f, expected_disbursement_on: iso(f.expected_disbursement_on) }),
        ),
        counterparties: a.counterparties.map((c) =>
          clean({
            role: c.role,
            sector: c.sector,
            name: ctx.org(c.organisation_id)?.legal_name,
            organisation_id: c.organisation_id,
          }),
        ),
      }),
      {
        self: linker.link(`/v2/projects/${agg.id}/agreements/${a.id}`),
        [linker.rel("project")]: linker.link(`/v2/projects/${agg.id}`),
      },
    ),
  );
  return hal({ total: items.length }, facetLinks(linker, agg, "agreements"), {
    embedded: { agreements: items },
  });
}

export function renderLabels(agg: ProjectAggregate, ctx: ProjectionContext, linker: Linker) {
  const items = agg.labels.map((l) => {
    const label = ctx.label(l.label_id);
    return clean({
      id: l.id,
      label_id: l.label_id,
      name: label?.name,
      cdop_value: label?.cdop_enum_value,
      kind: l.kind,
      start_date: iso(l.start_on),
      expiry_date: iso(l.expiry_on),
      approval_date: iso(l.approved_on),
      website: l.url ?? label?.url,
      accreditation_id: l.accreditation_id,
    });
  });
  return hal(
    { total: items.length },
    facetLinks(linker, agg, "labels", {
      [linker.rel("reference")]: linker.link("/v2/reference/labels"),
    }),
    { embedded: { labels: items } },
  );
}

export function renderBufferPool(agg: ProjectAggregate, linker: Linker) {
  const balance = agg.bufferEntries.reduce(
    (acc, e) => {
      acc[e.kind] = (acc[e.kind] ?? 0) + e.quantity;
      return acc;
    },
    {} as Record<string, number>,
  );
  const bufferBlocks = agg.blocks.filter((b) => b.state === "buffer");
  return hal(
    clean({
      buffer_pool_deposits: balance.deposit ?? 0,
      buffer_pool_release: balance.release ?? 0,
      buffer_pool_reversal_coverage: balance.reversal_coverage ?? 0,
      buffer_pool_reversal_non_coverage: balance.reversal_non_coverage ?? 0,
      buffer_rate: agg.buffer_rate,
      buffer_units_held: bufferBlocks.reduce((s, b) => s + (b.block_end - b.block_start + 1), 0),
      project_risk: agg.project_risk,
      entries: agg.bufferEntries.map((e) =>
        clean({
          id: e.id,
          kind: e.kind,
          quantity: e.quantity,
          date: iso(e.occurred_on),
          block_id: e.block_id,
          verification_event_id: e.verification_event_id,
          notes: e.notes,
        }),
      ),
    }),
    facetLinks(linker, agg, "buffer-pool", {
      [linker.rel("units")]: linker.link("/v2/units", undefined, {
        project_id: agg.id,
        lifecycle_state: "buffer",
      }),
    }),
  );
}

export function renderFinance(agg: ProjectAggregate, ctx: ProjectionContext, linker: Linker) {
  const f = agg.finance;
  return hal(
    clean({
      declaring_entity_name:
        ctx.org(f?.declaring_entity_organisation_id)?.legal_name ??
        ctx.org(agg.developer_organisation_id)?.legal_name,
      financing_options: f?.financing_options ?? [],
      costs_and_revenue: f
        ? clean({
            expected_initial_costs: f.expected_initial_costs,
            expected_annual_costs: f.expected_annual_costs,
            expected_annual_revenue: f.expected_annual_revenue,
          })
        : undefined,
      funding: f
        ? clean({
            project_total_funding_required: f.total_funding_required,
            project_total_funding_secured: f.total_funding_secured,
          })
        : undefined,
      community_benefit_mechanism_type: f?.community_benefit_mechanisms ?? [],
      expected_community_proceeds: f?.expected_community_proceeds,
      expected_carbon_credit_price: f?.expected_credit_price,
      realized_transaction_price: f?.realized_transaction_price,
      currency: f?.currency,
      visibility_note: "Prices are Private in CDOP; the demo dataset is synthetic.",
    }),
    facetLinks(linker, agg, "finance", {
      [linker.rel("agreements")]: linker.link(`/v2/projects/${agg.id}/agreements`),
    }),
  );
}

export function renderDocuments(
  agg: ProjectAggregate,
  ctx: ProjectionContext,
  linker: Linker,
  typeNames: Map<string, { name: string; kind: string; cdop_type: string | null }>,
) {
  const items = agg.documents.map((d) => {
    const t = typeNames.get(d.document_type_id);
    return hal(
      clean({
        id: d.id,
        document_type_id: d.document_type_id,
        document_type: t?.name,
        kind: t?.kind,
        other_project_documentation_type: t?.cdop_type ?? undefined,
        title: d.title,
        file_name: d.file_name,
        content_type: d.content_type,
        size_bytes: d.size_bytes,
        is_public: d.is_public,
        uploaded_at: isoTs(d.uploaded_at),
        document_date: iso(d.document_date),
        version_label: d.version_label,
        validation_event_id: d.validation_event_id,
        verification_event_id: d.verification_event_id,
        issuance_id: d.issuance_id,
        url: documentUrl(ctx, agg.id, d.id),
      }),
      {
        self: linker.link(`/v2/projects/${agg.id}/documents/${d.id}`),
        enclosure: { href: documentUrl(ctx, agg.id, d.id), type: d.content_type },
        [linker.rel("project")]: linker.link(`/v2/projects/${agg.id}`),
      },
    );
  });
  return hal({ total: items.length }, facetLinks(linker, agg, "documents"), {
    embedded: { documents: items },
  });
}

export function renderGeolocationFiles(
  agg: ProjectAggregate,
  ctx: ProjectionContext,
  linker: Linker,
) {
  const items = agg.geolocationFiles.map((g) =>
    hal(
      clean({
        id: g.id,
        file_name: g.file_name,
        file_format: g.file_format,
        area_type: g.area_type,
        geometry_type: g.geometry_type,
        file_status: g.file_status,
        validity_start_date: iso(g.validity_start_on),
        validity_end_date: iso(g.validity_end_on),
        file_created_on: isoTs(g.file_created_at),
        file_edited_on: isoTs(g.file_edited_at),
        crs: g.crs,
        area_ha: g.area_ha,
        bbox: g.bbox,
        url: geoFileUrl(ctx, agg.id, g.id),
      }),
      {
        self: linker.link(`/v2/projects/${agg.id}/geolocation-files/${g.id}`),
        enclosure: { href: geoFileUrl(ctx, agg.id, g.id), type: "application/geo+json" },
        [linker.rel("project")]: linker.link(`/v2/projects/${agg.id}`),
      },
    ),
  );
  return hal({ total: items.length }, facetLinks(linker, agg, "geolocation-files"), {
    embedded: { "geolocation-files": items },
  });
}

export function renderMilestones(agg: ProjectAggregate, linker: Linker) {
  const now = Date.now();
  const items = agg.milestones.map((m) =>
    clean({
      id: m.id,
      kind: m.kind,
      name: m.name,
      sequence: m.sequence,
      due_date: iso(m.due_on),
      status: m.completed_at ? "completed" : m.due_on.getTime() < now ? "overdue" : "upcoming",
      completed_at: isoTs(m.completed_at),
      completed_by_validation_event_id: m.completed_by_validation_event_id,
      completed_by_verification_event_id: m.completed_by_verification_event_id,
    }),
  );
  return hal({ total: items.length }, facetLinks(linker, agg, "milestones"), {
    embedded: { milestones: items },
  });
}

export function renderFacilities(agg: ProjectAggregate, linker: Linker) {
  const items = agg.locations
    .filter((l) => l.kind === "facility")
    .map((l) =>
      clean({
        country_code: l.country_code,
        country_name: l.country_name,
        geographical_region_code: l.region_code,
        geographical_region_name: l.region_name,
        country_subdivision_code: l.subdivision_code,
        country_subdivision_name: l.subdivision_name,
        city: l.city,
        address_line_1: l.address_line_1,
      }),
    );
  return hal({ total: items.length }, facetLinks(linker, agg, "facilities"), {
    embedded: { facilities: items },
  });
}
