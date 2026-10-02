import type { ProjectAggregate } from "../../seed/aggregate.js";
import type { ProjectIndexRow } from "../../services/projects.js";
import { hal, type Linker, type Links, type Template } from "../hal.js";
import { clean, documentLinks, iso, isoTs, schemaLink, PROJECT_PODS } from "./common.js";

export interface ProjectRenderContext {
  linker: Linker;
  developerName?: string | undefined;
  vvbName?: string | undefined;
  registryName?: string | undefined;
  registryUrl?: string | undefined;
  programName?: string | undefined;
  standardName?: string | undefined;
  standardVersion?: string | undefined;
  methodology?: { name: string; version: string } | undefined;
  templates?: Record<string, Template> | undefined;
  embedded?: Record<string, unknown> | undefined;
}

function statusRecord(s: ProjectAggregate["statusHistory"][number]) {
  return clean({
    project_status: s.cdop_project_status,
    project_status_reason: s.reason,
    is_current: s.is_current,
    lifecycle_stage: s.lifecycle_state,
    registry_status: { code: s.native_state_code, name: s.native_state_name },
    action: s.action,
    intent: s.intent,
    actor: s.actor_kind,
    actor_account_id: s.actor_account_id,
    effective_at: isoTs(s.effective_at),
    sequence: s.sequence,
  });
}

export function projectLinks(linker: Linker, id: string, agg?: ProjectAggregate): Links {
  const base = `/v2/projects/${id}`;
  const links: Links = {
    self: linker.link(base),
    curies: linker.curies(),
    collection: linker.link("/v2/projects"),
    describedby: schemaLink(linker, "project-approach-details"),
    [linker.rel("status-history")]: linker.link(`${base}/status-history`),
    [linker.rel("stakeholders")]: linker.link(`${base}/stakeholders`),
    [linker.rel("facilities")]: linker.link(`${base}/facilities`),
    [linker.rel("crediting-program")]: linker.link(`${base}/crediting-program`),
    [linker.rel("methodologies")]: linker.link(`${base}/methodologies`),
    [linker.rel("registry")]: linker.link(`${base}/registry`),
    [linker.rel("validations")]: linker.link(`${base}/validations`),
    [linker.rel("verifications")]: linker.link(`${base}/verifications`),
    [linker.rel("estimations")]: linker.link(`${base}/estimations`),
    [linker.rel("issuances")]: linker.link(`${base}/issuances`),
    [linker.rel("units")]: linker.link(`${base}/units`),
    [linker.rel("cobenefits")]: linker.link(`${base}/cobenefits`),
    [linker.rel("agreements")]: linker.link(`${base}/agreements`),
    [linker.rel("labels")]: linker.link(`${base}/labels`),
    [linker.rel("buffer-pool")]: linker.link(`${base}/buffer-pool`),
    [linker.rel("finance")]: linker.link(`${base}/finance`),
    [linker.rel("documents")]: linker.link(`${base}/documents`),
    [linker.rel("geolocation-files")]: linker.link(`${base}/geolocation-files`),
    [linker.rel("milestones")]: linker.link(`${base}/milestones`),
    [linker.rel("document")]: documentLinks(linker, base, PROJECT_PODS),
    [linker.rel("events")]: linker.link("/v2/changes", undefined, { project_id: id }),
    monitor: linker.link("/v2/events", { type: "text/event-stream" }, { project_id: id }),
    [linker.rel("state-machine")]: linker.link(`/v2/state-machines/project`, undefined, {
      standard: agg?.standard_id,
    }),
  };
  if (agg?.master_project_id)
    links[linker.rel("master-project")] = linker.link(`/v2/projects/${agg.master_project_id}`);
  if (agg?.developer_account_id)
    links[linker.rel("owner-account")] = linker.link(`/v2/accounts/${agg.developer_account_id}`);
  return links;
}

/** Full project resource (detail). */
export function renderProject(agg: ProjectAggregate, ctx: ProjectRenderContext) {
  const linker = ctx.linker;
  const current = agg.statusHistory.find((s) => s.is_current);
  const primaryLocation =
    agg.locations.find((l) => l.kind === "project" && l.is_primary) ??
    agg.locations.find((l) => l.kind === "project");
  const links = projectLinks(linker, agg.id, agg);
  const registryPage = agg.native_project_url ?? ctx.registryUrl;
  if (registryPage)
    links.alternate = { href: registryPage, type: "text/html", title: "Registry page" };
  const properties = clean({
    id: agg.id,
    project_identifier: agg.project_identifier,
    project_name: agg.name,
    project_id_type: "current registry project id",
    project_id: agg.native_project_id,
    current_registry_project_id: agg.native_project_id,
    current_registry_project_link: registryPage,
    project_description: agg.description,
    program_type: agg.program_type,
    activity_type: agg.activity_type,
    registry: ctx.registryName
      ? { id: agg.registry_id, name: ctx.registryName }
      : { id: agg.registry_id },
    crediting_program: ctx.programName
      ? { id: agg.crediting_program_id, name: ctx.programName }
      : { id: agg.crediting_program_id },
    standard: clean({ id: agg.standard_id, name: ctx.standardName, version: ctx.standardVersion }),
    methodology: ctx.methodology,
    mitigation: agg.mitigations.map((m) => ({
      mitigation_type: m.mitigation_type,
      project_sector: m.project_sector,
      project_type: m.project_type,
      estimated_annual_emissions_mitigation: m.estimated_annual_mitigation,
      estimated_total_emissions_mitigation: m.estimated_total_mitigation,
    })),
    location: primaryLocation
      ? clean({
          country_code: primaryLocation.country_code,
          country_name: primaryLocation.country_name,
          geographical_region_code: primaryLocation.region_code,
          geographical_region_name: primaryLocation.region_name,
          country_subdivision_code: primaryLocation.subdivision_code,
          country_subdivision_name: primaryLocation.subdivision_name,
          city: primaryLocation.city,
        })
      : undefined,
    centroid: { lon: agg.centroid[0], lat: agg.centroid[1] },
    bbox: agg.bbox,
    grid_reference: agg.grid_reference,
    area_ha: agg.area_ha,
    project_list_date: iso(agg.listed_on),
    project_registration_date: iso(agg.registered_on),
    validated_on: iso(agg.validated_on),
    first_verified_on: iso(agg.first_verified_on),
    closed_on: iso(agg.closed_on),
    validation_deadline: iso(agg.validation_deadline_on),
    project_start_date: iso(agg.start_on),
    project_end_date: iso(agg.end_on),
    duration_years: agg.duration_years,
    crediting_period_type: agg.crediting_period_type,
    estimated_annual_emissions_mitigation: agg.estimated_annual_mitigation,
    estimated_total_emissions_mitigation: agg.estimated_total_mitigation,
    estimated_total_years: agg.estimated_total_years,
    buffer_rate: agg.buffer_rate,
    metric: agg.unit_metric,
    status: current ? statusRecord(current) : undefined,
    lifecycle_stage: agg.lifecycle_state,
    registry_status: clean({
      code: agg.native_state_code,
      name: agg.native_state_name,
      vocabulary: agg.standard_id,
      on_hold: agg.is_on_hold,
    }),
    project_developer_name: ctx.developerName,
    validation_body_name: ctx.vvbName,
    sdgs: agg.sdgs,
    native_attributes: agg.native_attributes,
    counts: {
      status_records: agg.statusHistory.length,
      validations: agg.validations.length,
      verifications: agg.verifications.length,
      issuances: agg.issuances.length,
      unit_blocks: agg.blocks.length,
      documents: agg.documents.length,
      milestones: agg.milestones.length,
      geolocation_files: agg.geolocationFiles.length,
    },
    created_at: isoTs(agg.created_at),
    modified_at: isoTs(agg.modified_at),
  });
  return hal(properties, links, { embedded: ctx.embedded, templates: ctx.templates });
}

/** Compact index row for collections. */
export function renderProjectIndex(row: ProjectIndexRow, linker: Linker) {
  return hal(
    clean({
      id: row.id,
      project_identifier: row.project_identifier,
      project_name: row.name,
      current_registry_project_id: row.native_project_id,
      registry: row.registry_id,
      standard: row.standard_id,
      crediting_program: row.crediting_program_id,
      country_code: row.country_code,
      country_name: row.country_name,
      country_subdivision_name: row.subdivision_name ?? undefined,
      project_status: row.cdop_project_status,
      lifecycle_stage: row.lifecycle_state,
      registry_status: row.native_state_code,
      area_ha: row.area_ha ?? undefined,
      // Lets a map plot every project from one page of the collection, without a request per project.
      centroid:
        row.centroid_lon != null && row.centroid_lat != null
          ? { lon: row.centroid_lon, lat: row.centroid_lat }
          : undefined,
      estimated_total_emissions_mitigation: row.estimated_total_mitigation ?? undefined,
      project_registration_date: iso(row.registered_on),
      validated_on: iso(row.validated_on),
      modified_at: isoTs(row.modified_at),
    }),
    {
      self: linker.link(`/v2/projects/${row.id}`),
      [linker.rel("units")]: linker.link(`/v2/projects/${row.id}/units`),
      [linker.rel("document")]: [
        { name: "full-list", href: linker.url(`/v2/projects/${row.id}/cdop/full-list`) },
      ],
    },
  );
}

export function renderStatusHistory(agg: ProjectAggregate, linker: Linker) {
  const records = [...agg.statusHistory].sort((a, b) => b.sequence - a.sequence).map(statusRecord);
  return hal(
    { total: records.length, project_id: agg.id },
    {
      self: linker.link(`/v2/projects/${agg.id}/status-history`),
      curies: linker.curies(),
      up: linker.link(`/v2/projects/${agg.id}`),
      [linker.rel("state-machine")]: linker.link("/v2/state-machines/project", undefined, {
        standard: agg.standard_id,
      }),
    },
    { embedded: { "status-records": records } },
  );
}
