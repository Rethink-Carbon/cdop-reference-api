/**
 * Shared scaffolding for the project factories: per-project randomness and ids, site
 * geography, status history from machine walks, headline dates, estimations with
 * vintage curves, documents and milestones. Standard-specific rules live in wcc/pc/expost.
 */
import type {
  Account,
  CreditingPeriod,
  Document,
  Estimation,
  EstimationVintage,
  GeolocationFile,
  Milestone,
  ProjectLocation,
  StatusRecord,
} from "../aggregate.js";
import { deterministicId, type IdPrefix } from "../../domain/ids.js";
import { nativeState } from "../../domain/lifecycle/index.js";
import type { Anchor } from "../geo/anchors.js";
import { osgbGridReference } from "../geo/osgb.js";
import { sitePolygon, type SitePolygon } from "../geo/polygon.js";
import type { WalkStep } from "../lifecycle.js";
import type { Parties, Party, StandardId } from "../parties.js";
import { Rng } from "../prng.js";
import { addDays, addYears, atBusinessHours, isoDate, startOfDayUtc } from "../time.js";
import { prune, round2 } from "../util.js";
import {
  COUNTRY_NAMES,
  DOCUMENT_TYPES,
  REGIONS,
  type DocumentTypeSeed,
  type StandardSeed,
} from "../vocab.js";

export interface GenContext {
  seed: string;
  now: Date;
  parties: Parties;
}

/** Everything a factory needs to know about one project before it starts inventing. */
export interface ProjectSpec {
  /** Stable key for ids and randomness, e.g. "wcc:17". */
  key: string;
  index: number;
  standard: StandardSeed;
  /** Native state the lifecycle walk aims for (it may stop short of it before `now`). */
  target: string;
  anchor: Anchor;
  developer: Party;
  vvb: Party;
  createdAt: Date;
  masterProjectId?: string;
  programType?: "Standalone project" | "Nested project" | "Scaled up program";
}

/** Per-project randomness: independent of every other project and every other field. */
export function projectRng(ctx: GenContext, spec: ProjectSpec): Rng {
  return new Rng(`${ctx.seed}:${spec.key}`);
}

export function makeId(
  ctx: GenContext,
  spec: ProjectSpec,
  prefix: IdPrefix,
  local: string,
  at?: Date,
): string {
  return deterministicId(prefix, `${ctx.seed}:${spec.key}:${local}`, at);
}

export interface Seats {
  developer: Account;
  vvb: Account;
  codeAdmin: Account;
  registry: Account;
}

export function seatsFor(ctx: GenContext, spec: ProjectSpec): Seats {
  const registryId = spec.standard.registry_id;
  const sid = spec.standard.id as StandardId;
  const pick = (p: Party): Account => {
    const a = p.accounts[registryId];
    if (!a) throw new Error(`${p.organisation.legal_name} has no account on ${registryId}`);
    return a;
  };
  const registry = ctx.parties.registryOperator[registryId];
  if (!registry) throw new Error(`no registry operator account for ${registryId}`);
  return {
    developer: pick(spec.developer),
    vvb: pick(spec.vvb),
    codeAdmin: ctx.parties.codeAdmin[sid],
    registry,
  };
}

// ---------------------------------------------------------------------------------- geography

export interface Site {
  polygon: SitePolygon;
  location: ProjectLocation;
  gridReference?: string;
}

export function makeSite(ctx: GenContext, spec: ProjectSpec, rng: Rng, areaHa: number): Site {
  const a = spec.anchor;
  const lat = a.lat + rng.float("site:dlat", -0.15, 0.15);
  const lon = a.lon + rng.float("site:dlon", -0.2, 0.2);
  const polygon = sitePolygon(rng, "site:poly", [lon, lat], areaHa);
  const region = REGIONS[a.country] ?? { code: "001", name: "World" };
  const location: ProjectLocation = prune({
    id: makeId(ctx, spec, "loc", "primary"),
    kind: "project" as const,
    is_primary: true,
    country_code: a.country,
    country_name: COUNTRY_NAMES[a.country] ?? a.country,
    region_code: region.code,
    region_name: region.name,
    subdivision_code: a.subdivision_code,
    subdivision_name: a.subdivision_name,
    city: a.locality,
    sort: 0,
  });
  const gridReference =
    a.country === "GBR" && a.nation !== "Northern Ireland"
      ? osgbGridReference(lat, lon)
      : undefined;
  return prune({ polygon, location, gridReference });
}

export function makeGeolocationFile(
  ctx: GenContext,
  spec: ProjectSpec,
  site: Site,
  local: string,
  areaType: string,
  at: Date,
  fileName: string,
): GeolocationFile {
  const g = site.polygon;
  return {
    id: makeId(ctx, spec, "gis", local, at),
    file_name: fileName,
    file_format: "GeoJSON",
    area_type: areaType,
    geometry_type: "Polygon",
    file_status: "ACTIVE",
    validity_start_on: startOfDayUtc(at),
    file_created_at: at,
    crs: "EPSG:4326",
    geojson: {
      type: "Feature",
      properties: { name: fileName, area_type: areaType },
      geometry: g.feature.geometry,
    },
    area_ha: g.areaHa,
    bbox: g.bbox,
  };
}

// ----------------------------------------------------------------------------- status history

const REASONS: Record<string, string[]> = {
  more_info: [
    "Further information requested on the carbon calculation inputs.",
    "Map of site does not match the stated net area; please reconcile.",
    "Evidence of land tenure incomplete for one parcel.",
    "Additionality narrative needs the counterfactual costed.",
    "Monitoring plan missing the sample plot layout.",
  ],
  reject: [
    "Project does not meet the eligibility criteria for the code.",
    "Registration withdrawn by the administrator after repeated incomplete submissions.",
    "Validation deadline passed without a submitted validation pack.",
    "Negative validation opinion: baseline not demonstrable.",
  ],
  withdraw: [
    "Landowner withdrew from the scheme.",
    "Planting plans changed; project to be re-registered.",
    "Funding for the works fell through.",
    "Site sold before validation.",
  ],
  hold: [
    "Awaiting payment of the registry fee.",
    "Placed on hold pending resolution of a boundary query.",
  ],
};

export function reasonFor(
  rng: Rng,
  tag: string,
  intent: string | undefined,
  requiresReason: boolean | undefined,
): string | undefined {
  if (!requiresReason || !intent) return undefined;
  const list = REASONS[intent];
  return list ? rng.pick(`${tag}:reason`, list) : undefined;
}

function actorAccount(actor: string, seats: Seats): string | undefined {
  switch (actor) {
    case "developer":
      return seats.developer.id;
    case "vvb":
      return seats.vvb.id;
    case "code_admin":
      return seats.codeAdmin.id;
    case "registry":
      return seats.registry.id;
    default:
      return undefined;
  }
}

/** The status rows for a creation at `createdAt` followed by the walked `steps`. */
export function statusRecords(
  ctx: GenContext,
  spec: ProjectSpec,
  rng: Rng,
  initial: string,
  createdAt: Date,
  steps: readonly WalkStep[],
  seats: Seats,
): StatusRecord[] {
  const sid = spec.standard.id;
  const first = nativeState(sid, initial);
  if (!first) throw new Error(`${sid}: unknown initial state ${initial}`);
  const rows: StatusRecord[] = [
    {
      id: makeId(ctx, spec, "psh", "1", createdAt),
      sequence: 1,
      lifecycle_state: first.lifecycle,
      native_state_code: first.code,
      native_state_name: first.name,
      cdop_project_status: first.cdopStatus,
      action: "CREATE",
      intent: "other",
      actor_kind: "developer",
      actor_account_id: seats.developer.id,
      effective_at: createdAt,
      is_current: false,
    },
  ];
  steps.forEach((step, i) => {
    const t = step.transition;
    const to = nativeState(sid, t.to);
    if (!to) throw new Error(`${sid}: unknown state ${t.to}`);
    rows.push(
      prune({
        id: makeId(ctx, spec, "psh", String(i + 2), step.at),
        sequence: i + 2,
        lifecycle_state: to.lifecycle,
        native_state_code: to.code,
        native_state_name: to.name,
        cdop_project_status: to.cdopStatus,
        action: t.action,
        intent: t.intent,
        reason: reasonFor(rng, `psh:${i + 2}`, t.intent, t.requiresReason),
        actor_kind: t.actor,
        actor_account_id: actorAccount(t.actor, seats),
        effective_at: step.at,
        is_current: false,
      }),
    );
  });
  const last = rows[rows.length - 1];
  if (last) last.is_current = true;
  return rows;
}

export interface HeadlineDates {
  listed_on?: Date;
  registered_on?: Date;
  validated_on?: Date;
  first_verified_on?: Date;
  closed_on?: Date;
}

/** First time each canonical stage was reached; `registered_on` follows CDOP "Registered". */
export function headlineDates(standardId: string, rows: readonly StatusRecord[]): HeadlineDates {
  const out: HeadlineDates = {};
  for (const r of rows) {
    const day = startOfDayUtc(r.effective_at);
    if (r.lifecycle_state === "listed" && !out.listed_on) out.listed_on = day;
    if (r.cdop_project_status === "Registered" && !out.registered_on) out.registered_on = day;
    if (r.lifecycle_state === "validated" && !out.validated_on) out.validated_on = day;
    if (r.lifecycle_state === "verified" && !out.first_verified_on) out.first_verified_on = day;
    if (nativeState(standardId, r.native_state_code)?.terminal && !out.closed_on)
      out.closed_on = day;
  }
  return out;
}

export function firstReached(rows: readonly StatusRecord[], code: string): Date | undefined {
  return rows.find((r) => r.native_state_code === code)?.effective_at;
}

// ------------------------------------------------------------------------------- estimations

/** Cumulative logistic uptake fraction over [0, duration] years, normalised to end at 1. */
export function logisticFraction(
  t: number,
  duration: number,
  midpoint = 0.35,
  steepness = 8,
): number {
  const f = (x: number): number => 1 / (1 + Math.exp(-steepness * (x / duration - midpoint)));
  return (f(t) - f(0)) / (f(duration) - f(0));
}

export interface VintagePlan {
  startOn: Date;
  durationYears: number;
  periodYears: number;
  totalMitigation: number;
  bufferRate: number;
  /** Cap on rows for long ex-post series. */
  maxVintages?: number;
}

export function makeVintages(
  ctx: GenContext,
  spec: ProjectSpec,
  estimationLocal: string,
  plan: VintagePlan,
): EstimationVintage[] {
  const rows: EstimationVintage[] = [];
  const count = Math.ceil(plan.durationYears / plan.periodYears);
  const limit = Math.min(count, plan.maxVintages ?? count);
  let cumulative = 0;
  for (let k = 0; k < limit; k++) {
    const t0 = k * plan.periodYears;
    const t1 = Math.min(plan.durationYears, t0 + plan.periodYears);
    const end = Math.round(plan.totalMitigation * logisticFraction(t1, plan.durationYears));
    const mitigation = Math.max(0, end - cumulative);
    cumulative = end;
    const vintageStart = addYears(plan.startOn, t0);
    const vintageEnd = addDays(addYears(plan.startOn, t1), -1);
    const buffer = Math.round(mitigation * plan.bufferRate);
    rows.push({
      id: makeId(ctx, spec, "esv", `${estimationLocal}:${k}`),
      vintage_start_on: vintageStart,
      vintage_end_on: vintageEnd,
      vintage_year: vintageStart.getUTCFullYear(),
      estimated_mitigation: mitigation,
      estimated_claimable: mitigation - buffer,
      estimated_buffer: buffer,
      monitoring_start_on: vintageStart,
      monitoring_end_on: vintageEnd,
      estimated_issuance_on: addDays(vintageEnd, 180),
    });
  }
  return rows;
}

/**
 * The estimation ladder: an Unvalidated estimate at creation, superseded by a Validated
 * one once the VVB signs it off. Both carry the same vintage numbers so the ledger and the
 * projection never disagree.
 */
export function makeEstimations(
  ctx: GenContext,
  spec: ProjectSpec,
  plan: VintagePlan,
  createdAt: Date,
  validatedOn: Date | undefined,
  validationEventId: string | undefined,
): Estimation[] {
  const first: Estimation = {
    id: makeId(ctx, spec, "est", "1", createdAt),
    sequence: 1,
    event_on: startOfDayUtc(createdAt),
    status: "Unvalidated",
    total_mitigation: plan.totalMitigation,
    annual_mitigation: round2(plan.totalMitigation / plan.durationYears),
    total_years: plan.durationYears,
    is_current: true,
    vintages: makeVintages(ctx, spec, "1", plan),
  };
  if (!validatedOn || !validationEventId) return [first];
  const second: Estimation = {
    id: makeId(ctx, spec, "est", "2", validatedOn),
    sequence: 2,
    event_on: startOfDayUtc(validatedOn),
    status: "Validated",
    validated_by_validation_event_id: validationEventId,
    total_mitigation: plan.totalMitigation,
    annual_mitigation: round2(plan.totalMitigation / plan.durationYears),
    total_years: plan.durationYears,
    is_current: true,
    vintages: makeVintages(ctx, spec, "2", plan),
  };
  first.status = "Superseded";
  first.status_reason = "Superseded by the validated estimate.";
  first.superseded_by_estimation_id = second.id;
  first.is_current = false;
  return [first, second];
}

export function makeCreditingPeriod(
  ctx: GenContext,
  spec: ProjectSpec,
  number: number,
  startOn: Date,
  durationYears: number,
  periodType: "Fixed" | "Renewable",
  validationEventId?: string,
): CreditingPeriod {
  return prune({
    id: makeId(ctx, spec, "crp", String(number)),
    number,
    start_on: startOn,
    end_on: addDays(addYears(startOn, durationYears), -1),
    duration_years: durationYears,
    period_type: periodType,
    validation_event_id: validationEventId,
    is_current: true,
  });
}

// --------------------------------------------------------------------------------- documents

export function documentType(id: string): DocumentTypeSeed {
  const d = DOCUMENT_TYPES.find((x) => x.id === id);
  if (!d) throw new Error(`unknown document type ${id}`);
  return d;
}

export interface DocumentOptions {
  validationEventId?: string;
  verificationEventId?: string;
  issuanceId?: string;
  uploadedBy?: string;
  versionLabel?: string;
  isPublic?: boolean;
}

/** A document uploaded 1–5 business days before the state move it supports (`before`). */
export function makeDocument(
  ctx: GenContext,
  spec: ProjectSpec,
  rng: Rng,
  local: string,
  typeId: string,
  projectName: string,
  before: Date,
  opts: DocumentOptions = {},
): Document {
  const type = documentType(typeId);
  // Step back from the move, then off any weekend (backwards, so the upload stays before it).
  let day = addDays(startOfDayUtc(before), -rng.int(`doc:${local}:lead`, 1, 5));
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day = addDays(day, -1);
  const uploadedAt = atBusinessHours(rng, `doc:${local}`, day);
  const slug = projectName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const ext =
    type.kind === "shapefile"
      ? "zip"
      : type.kind === "map" && rng.bool(`doc:${local}:pdfmap`, 0.5)
        ? "pdf"
        : type.kind === "carbon_calc"
          ? "xlsx"
          : "pdf";
  const contentType =
    ext === "zip"
      ? "application/zip"
      : ext === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";
  return prune({
    id: makeId(ctx, spec, "doc", local, uploadedAt),
    document_type_id: typeId,
    validation_event_id: opts.validationEventId,
    verification_event_id: opts.verificationEventId,
    issuance_id: opts.issuanceId,
    title: `${type.name}: ${projectName}`,
    file_name: `${slug}_${type.name.replace(/[^A-Za-z0-9]+/g, "-")}_${opts.versionLabel ?? "v1"}_${isoDate(uploadedAt)}.${ext}`,
    content_type: contentType,
    size_bytes: rng.int(`doc:${local}:size`, 120_000, 18_000_000),
    is_public: opts.isPublic ?? type.kind !== "legal",
    uploaded_at: uploadedAt,
    uploaded_by_account_id: opts.uploadedBy,
    document_date: startOfDayUtc(uploadedAt),
    version_label: opts.versionLabel ?? "v1",
    extracted: {},
  });
}

// -------------------------------------------------------------------------------- milestones

export function makeMilestone(
  ctx: GenContext,
  spec: ProjectSpec,
  kind: Milestone["kind"],
  name: string,
  sequence: number,
  dueOn: Date,
  completion?: { at: Date; validationEventId?: string; verificationEventId?: string },
): Milestone {
  return prune({
    id: makeId(ctx, spec, "mst", `${kind}:${sequence}`),
    kind,
    name,
    sequence,
    due_on: startOfDayUtc(dueOn),
    completed_at: completion?.at,
    completed_by_validation_event_id: completion?.validationEventId,
    completed_by_verification_event_id: completion?.verificationEventId,
  });
}

/** A business-hours instant on the day of `d` (for creation timestamps and similar). */
export function businessInstant(rng: Rng, tag: string, d: Date): Date {
  return atBusinessHours(rng, tag, d);
}
