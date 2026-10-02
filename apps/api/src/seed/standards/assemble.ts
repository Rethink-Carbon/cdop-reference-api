/**
 * Assembly shared by every project factory: a lifecycle walker that strings forward
 * segments and named edges together (hold/release and exits are not "forward" moves, so
 * the factories ask for them by name), and the aggregate shell with its derived columns.
 */
import type { ProjectAggregate, ProjectMitigation, StatusRecord } from "../aggregate.js";
import { buildUrn } from "../../domain/ids.js";
import {
  entriesInto,
  forwardPath,
  initialState,
  walkEdge,
  walkPath,
  walkTo,
  type WalkResult,
  type WalkStep,
} from "../lifecycle.js";
import type { Rng } from "../prng.js";
import { addDays } from "../time.js";
import { lastOf, maxDate, prune } from "../util.js";
import { REGISTRIES } from "../vocab.js";
import { headlineDates, makeId, type GenContext, type ProjectSpec, type Site } from "./common.js";

/** Accumulates walked steps so a factory can say "go there, then take this edge". */
export class Walker {
  readonly steps: WalkStep[] = [];
  state: string;
  at: Date;
  private n = 0;

  constructor(
    private readonly ctx: GenContext,
    private readonly spec: ProjectSpec,
    private readonly rng: Rng,
  ) {
    this.state = initialState(spec.standard.id);
    this.at = spec.createdAt;
  }

  private get sid(): string {
    return this.spec.standard.id;
  }

  private absorb(result: WalkResult): boolean {
    this.steps.push(...result.steps);
    this.state = result.endState || this.state;
    this.at = result.endAt;
    return result.reached;
  }

  /** Walk the shortest forward path to `to`. False when `now` cut it short. */
  to(to: string): boolean {
    if (this.state === to) return true;
    this.n += 1;
    return this.absorb(
      walkTo(this.rng, `walk:${this.n}`, this.sid, this.state, to, this.at, this.ctx.now),
    );
  }

  /** Take one named transition out of the current state, optionally pinned to `firstAt`. */
  edge(action: string, firstAt?: Date): boolean {
    this.n += 1;
    // A pinned step may never precede the step before it.
    const pinned =
      firstAt && firstAt.getTime() <= this.at.getTime() ? addDays(this.at, 1) : firstAt;
    return this.absorb(
      walkEdge(
        this.rng,
        `walk:${this.n}`,
        this.sid,
        this.state,
        action,
        this.at,
        this.ctx.now,
        pinned ? { firstAt: pinned } : {},
      ),
    );
  }

  /** Reach an exit state (withdrawn, rejected, …) through one of the transitions into it. */
  exit(to: string, preferFrom?: string): boolean {
    const candidates = entriesInto(this.sid, to).filter(
      (t) => t.from === this.state || forwardPath(this.sid, this.state, t.from) !== undefined,
    );
    if (candidates.length === 0)
      throw new Error(`${this.sid}: ${to} is not reachable from ${this.state}`);
    const preferred = preferFrom ? candidates.filter((t) => t.from === preferFrom) : [];
    const entry = this.rng.pick(`walk:exit:${to}`, preferred.length ? preferred : candidates);
    if (!this.to(entry.from)) return false;
    this.n += 1;
    return this.absorb(
      walkPath(this.rng, `walk:${this.n}`, this.sid, [entry], this.at, this.ctx.now, {
        noLoops: true,
      }),
    );
  }

  firstInto(code: string): WalkStep | undefined {
    return this.steps.find((s) => s.transition.to === code);
  }

  firstAction(action: string): WalkStep | undefined {
    return this.steps.find((s) => s.transition.action === action);
  }
}

export interface ShellInput {
  name: string;
  description: string;
  nativeProjectId: string;
  standardVersion: string;
  methodologyVersionId: string;
  activityType: string;
  site: Site;
  statusHistory: StatusRecord[];
  mitigation: Pick<ProjectMitigation, "mitigation_type" | "project_sector" | "project_type">;
  startOn: Date;
  endOn: Date;
  durationYears: number;
  creditingPeriodType: "Fixed" | "Renewable";
  maxCumulativeCreditingYears?: number;
  maxCreditingPeriods?: number;
  totalMitigation: number;
  bufferRate: number;
  validationDeadlineOn?: Date;
}

export function projectId(ctx: GenContext, spec: ProjectSpec): string {
  return makeId(ctx, spec, "prj", "project", spec.createdAt);
}

/** The aggregate with its identity, geography and lifecycle columns filled and every list empty. */
export function projectShell(
  ctx: GenContext,
  spec: ProjectSpec,
  input: ShellInput,
): ProjectAggregate {
  const current = lastOf(input.statusHistory);
  const registry = REGISTRIES.find((r) => r.id === spec.standard.registry_id);
  const url = registry?.project_url_template
    ?.replace("{standard}", spec.standard.id)
    .replace("{native_project_id}", input.nativeProjectId);
  const { site } = input;
  const annual = Math.round(input.totalMitigation / input.durationYears);
  return prune({
    id: projectId(ctx, spec),
    project_identifier: buildUrn(spec.standard.registry_id, input.nativeProjectId),
    registry_id: spec.standard.registry_id,
    standard_id: spec.standard.id,
    standard_version_id: `${spec.standard.id}@${input.standardVersion}`,
    crediting_program_id: spec.standard.crediting_program_id,
    methodology_version_id: input.methodologyVersionId,
    native_project_id: input.nativeProjectId,
    native_project_url: url,
    name: input.name,
    description: input.description,
    program_type: spec.programType ?? "Standalone project",
    activity_type: input.activityType,
    master_project_id: spec.masterProjectId,
    developer_account_id: spec.developer.accounts[spec.standard.registry_id]?.id,
    developer_organisation_id: spec.developer.organisation.id,
    vvb_organisation_id: spec.vvb.organisation.id,
    lifecycle_state: current.lifecycle_state,
    native_state_code: current.native_state_code,
    native_state_name: current.native_state_name,
    cdop_project_status: current.cdop_project_status,
    is_on_hold: current.intent === "hold",
    ...headlineDates(spec.standard.id, input.statusHistory),
    validation_deadline_on: input.validationDeadlineOn,
    country_code: site.location.country_code,
    country_name: site.location.country_name,
    region_code: site.location.region_code,
    region_name: site.location.region_name,
    subdivision_code: site.location.subdivision_code,
    subdivision_name: site.location.subdivision_name,
    city: site.location.city,
    centroid: site.polygon.centroid,
    bbox: site.polygon.bbox,
    grid_reference: site.gridReference,
    area_ha: site.polygon.areaHa,
    start_on: input.startOn,
    end_on: input.endOn,
    duration_years: input.durationYears,
    crediting_period_type: input.creditingPeriodType,
    max_cumulative_crediting_years: input.maxCumulativeCreditingYears,
    max_crediting_periods: input.maxCreditingPeriods,
    estimated_annual_mitigation: annual,
    estimated_total_mitigation: input.totalMitigation,
    estimated_total_years: input.durationYears,
    buffer_rate: input.bufferRate,
    unit_metric: "tCO2e" as const,
    attestations: {},
    native_attributes: {},
    created_at: spec.createdAt,
    modified_at: current.effective_at,
    locations: [site.location],
    mitigations: [
      {
        id: makeId(ctx, spec, "mit", "1"),
        ...input.mitigation,
        estimated_annual_mitigation: annual,
        estimated_total_mitigation: input.totalMitigation,
        sort: 0,
      },
    ],
    statusHistory: input.statusHistory,
    creditingPeriods: [],
    geolocationFiles: [],
    sdgs: [],
    cobenefitMethods: [],
    landowners: [],
    stakeholders: [],
    labels: [],
    validations: [],
    verifications: [],
    estimations: [],
    milestones: [],
    issuances: [],
    blocks: [],
    transfers: [],
    retirements: [],
    cancellations: [],
    bufferEntries: [],
    documents: [],
    agreements: [],
    cobenefits: [],
  });
}

/** `modified_at` is the last thing that happened to the project or anything hanging off it. */
export function touch(p: ProjectAggregate): void {
  const latest = maxDate(
    lastOf(p.statusHistory).effective_at,
    ...p.documents.map((d) => d.uploaded_at),
    ...p.blocks.map((b) => b.history[b.history.length - 1]?.effective_at),
    ...p.geolocationFiles.map((g) => g.file_created_at),
  );
  if (latest) p.modified_at = latest;
}
