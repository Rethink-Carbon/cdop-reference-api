/**
 * Ex-post standards: VCS in full (annual vintages, units per verification, AFOLU buffer
 * 10–25%, leakage, CCB/CCP/CORSIA labels) and thin variants for Gold Standard, ACR, Plan
 * Vivo and Puro on the same machine. Each verification cycle is a submit/approve pair in
 * the status history, pinned after the monitoring period it covers.
 */
import type {
  ProjectAggregate,
  ProjectMitigation,
  ValidationEvent,
  VerificationEvent,
} from "../aggregate.js";
import { nativeState } from "../../domain/lifecycle/index.js";
import { buildExPostLedger, INITIAL_VALIDATION } from "../ledger.js";
import { intlProjectName } from "../names/intl.js";
import { pickSkewed, type StandardId } from "../parties.js";
import type { Rng } from "../prng.js";
import { addDays, addYears, startOfDayUtc } from "../time.js";
import { lastOf, prune, round2 } from "../util.js";
import { projectShell, touch, Walker } from "./assemble.js";
import {
  makeCreditingPeriod,
  makeDocument,
  makeEstimations,
  makeGeolocationFile,
  makeId,
  makeMilestone,
  makeSite,
  projectRng,
  seatsFor,
  statusRecords,
  type GenContext,
  type ProjectSpec,
  type VintagePlan,
} from "./common.js";
import {
  makeAgreement,
  makeCobenefits,
  makeFinance,
  makeLabel,
  makeLandowners,
  makeSdgs,
  makeStakeholders,
} from "./extras.js";

interface Kind {
  id: "ARR" | "REDD" | "WRC" | "ALM" | "IFM" | "BIOCHAR";
  methodologyId: string;
  activityType: string;
  mitigation: Pick<ProjectMitigation, "mitigation_type" | "project_sector" | "project_type">;
  claimType: string;
  /** Log-normal site area: median and clamp, in hectares. */
  area: [median: number, min: number, max: number];
  /** tCO2e per hectare per year. */
  rate: [number, number];
  buffer: [number, number];
  leakage: [number, number];
  areaType: string;
  afolu: boolean;
}

const FORESTRY = "A02 - Forestry and logging";
const KINDS: Record<Kind["id"], Omit<Kind, "id" | "methodologyId">> = {
  ARR: {
    activityType: "Afforestation, reforestation and revegetation",
    mitigation: {
      mitigation_type: "Removal - nature",
      project_sector: FORESTRY,
      project_type: "Afforestation/Reforestation",
    },
    claimType: "CARBON_REMOVAL",
    area: [4200, 300, 60_000],
    rate: [6, 16],
    buffer: [0.1, 0.25],
    leakage: [0, 0.05],
    areaType: "Planting Area",
    afolu: true,
  },
  REDD: {
    activityType: "Avoided unplanned deforestation",
    mitigation: {
      mitigation_type: "Avoidance",
      project_sector: FORESTRY,
      project_type: "REDD+ (Reducing Emissions from Deforestation and Forest Degradation)",
    },
    claimType: "EMISSION_REDUCTION",
    area: [85_000, 8000, 600_000],
    rate: [2.5, 9],
    buffer: [0.12, 0.25],
    leakage: [0.05, 0.2],
    areaType: "Project Accounting Area",
    afolu: true,
  },
  WRC: {
    activityType: "Tidal wetland restoration",
    mitigation: {
      mitigation_type: "Removal - nature",
      project_sector: FORESTRY,
      project_type: "Wetland Restoration",
    },
    claimType: "CARBON_REMOVAL",
    area: [3500, 200, 40_000],
    rate: [8, 22],
    buffer: [0.1, 0.2],
    leakage: [0, 0.05],
    areaType: "Project Area",
    afolu: true,
  },
  ALM: {
    activityType: "Improved agricultural land management",
    mitigation: {
      mitigation_type: "Reduction - nature",
      project_sector: "A01 - Crop and animal production, hunting and related service activities",
      project_type: "Sustainable Agriculture",
    },
    claimType: "EMISSION_REDUCTION",
    area: [28_000, 2000, 250_000],
    rate: [0.6, 2.4],
    buffer: [0.1, 0.18],
    leakage: [0, 0.08],
    areaType: "Project Area",
    afolu: true,
  },
  IFM: {
    activityType: "Improved forest management",
    mitigation: {
      mitigation_type: "Removal - nature",
      project_sector: FORESTRY,
      project_type: "Improved Forest Management",
    },
    claimType: "CARBON_REMOVAL",
    area: [9000, 800, 120_000],
    rate: [1.5, 5],
    buffer: [0.14, 0.22],
    leakage: [0.1, 0.2],
    areaType: "Project Area",
    afolu: true,
  },
  BIOCHAR: {
    activityType: "Biochar carbon removal",
    mitigation: {
      mitigation_type: "Removal - technical",
      project_sector: "C20 - Manufacture of chemicals and chemical products",
      project_type: "Biochar",
    },
    claimType: "CARBON_REMOVAL",
    area: [6, 1, 40],
    rate: [600, 2600],
    buffer: [0, 0],
    leakage: [0, 0],
    areaType: "Project Area",
    afolu: false,
  },
};

interface Profile {
  kinds: ReadonlyArray<readonly [id: Kind["id"], methodologyId: string, weight: number]>;
  creditingYears: ReadonlyArray<readonly [number, number]>;
  periodType: "Fixed" | "Renewable";
  maxPeriods: number;
  price: [number, number];
  nativeId: (index: number) => string;
  /** Standard versions with the year each took effect, oldest first. */
  versions: ReadonlyArray<readonly [version: string, fromYear: number]>;
}

const PROFILES: Partial<Record<StandardId, Profile>> = {
  vcs: {
    kinds: [
      ["ARR", "vcs-vm0047", 30],
      ["REDD", "vcs-vm0048", 35],
      ["WRC", "vcs-vm0033", 15],
      ["ALM", "vcs-vm0042", 20],
    ],
    creditingYears: [
      [30, 50],
      [40, 25],
      [20, 25],
    ],
    periodType: "Renewable",
    maxPeriods: 4,
    price: [4, 22],
    nativeId: (i) => String(1900 + i * 3),
    versions: [
      ["4.0", 2006],
      ["4.4", 2023],
      ["4.5", 2024],
      ["4.7", 2025],
    ],
  },
  gs4gg: {
    kinds: [["ARR", "gs-ar-am0001", 1]],
    creditingYears: [
      [30, 60],
      [50, 40],
    ],
    periodType: "Fixed",
    maxPeriods: 1,
    price: [9, 28],
    nativeId: (i) => `GS${7100 + i * 7}`,
    versions: [
      ["1.2", 2008],
      ["1.3", 2022],
    ],
  },
  acr: {
    kinds: [["IFM", "acr-ifm", 1]],
    creditingYears: [[20, 100]],
    periodType: "Renewable",
    maxPeriods: 5,
    price: [8, 20],
    nativeId: (i) => `ACR${410 + i * 2}`,
    versions: [
      ["7.0", 2008],
      ["8.0", 2023],
    ],
  },
  "plan-vivo": {
    kinds: [["ARR", "plan-vivo-agroforestry", 1]],
    creditingYears: [
      [20, 40],
      [30, 40],
      [50, 20],
    ],
    periodType: "Fixed",
    maxPeriods: 1,
    price: [8, 18],
    nativeId: (i) => `PV-${String(1001 + i)}`,
    versions: [
      ["2013", 2008],
      ["5.0", 2022],
    ],
  },
  puro: {
    kinds: [["BIOCHAR", "puro-biochar", 1]],
    creditingYears: [
      [5, 60],
      [10, 40],
    ],
    periodType: "Renewable",
    maxPeriods: 6,
    price: [110, 190],
    nativeId: (i) => String(640_000 + i * 13),
    versions: [
      ["3.0", 2019],
      ["4.0", 2024],
    ],
  },
};

/** Methodology versions are listed oldest first; older projects sit on the older one. */
const METHODOLOGY_VERSIONS: Record<string, [older: string, newer: string]> = {
  "vcs-vm0033": ["2.0", "2.1"],
  "vcs-vm0047": ["1.0", "1.1"],
  "vcs-vm0048": ["1.0", "1.1"],
  "vcs-vm0042": ["2.0", "2.1"],
  "gs-ar-am0001": ["1.0", "2.0"],
  "acr-ifm": ["1.3", "2.0"],
  "plan-vivo-agroforestry": ["1.0", "1.0"],
  "puro-biochar": ["2.0", "3.0"],
};

const MAX_CYCLES = 9;

interface Cycle {
  start: Date;
  end: Date;
}

/** Monitoring periods of one to three vintage years, back to back from the crediting start. */
function monitoringCycles(rng: Rng, startOn: Date, creditingYears: number): Cycle[] {
  const cycles: Cycle[] = [];
  let year = 0;
  for (let k = 0; k < MAX_CYCLES && year < creditingYears; k++) {
    const span = Math.min(
      creditingYears - year,
      rng.weighted(`cycle:${k}:span`, [
        [1, 50],
        [2, 35],
        [3, 15],
      ] as const),
    );
    cycles.push({
      start: addYears(startOn, year),
      end: addDays(addYears(startOn, year + span), -1),
    });
    year += span;
  }
  return cycles;
}

function walkExPost(w: Walker, rng: Rng, spec: ProjectSpec, cycles: readonly Cycle[]): void {
  const target = spec.target;
  /** Submit a verification once its monitoring period has closed and the report is written. */
  const submit = (k: number): boolean => {
    const cycle = cycles[k];
    return cycle
      ? w.edge(
          "REQUEST_VERIFICATION_APPROVAL",
          addDays(cycle.end, rng.int(`walk:cycle:${k}:lag`, 150, 420)),
        )
      : false;
  };
  const issue = (count: number): boolean => {
    for (let k = 0; k < count; k++) if (!submit(k) || !w.to("UNITS_ISSUED")) return false;
    return true;
  };
  const registered = (): boolean => w.to("REGISTERED");

  switch (target) {
    case "UNITS_ISSUED":
      if (registered()) issue(cycles.length);
      return;
    case "VERIFICATION_APPROVAL_REQUESTED": {
      const done = rng.int("walk:cycles:done", 0, 3);
      if (registered() && issue(done)) submit(done);
      return;
    }
    case "CREDITING_PERIOD_ENDED":
      if (registered() && issue(cycles.length))
        w.edge(
          "END_CREDITING_PERIOD",
          addDays(lastOf(cycles).end, rng.int("walk:end:lag", 200, 500)),
        );
      return;
    case "ON_HOLD":
    case "INACTIVE":
      if (!registered() || !issue(rng.int("walk:cycles:beforehold", 0, 2))) return;
      if (w.edge("HOLD", addDays(w.at, rng.int("walk:hold:lag", 60, 400))) && target === "INACTIVE")
        w.edge("DEACTIVATE");
      return;
    case "WITHDRAWN":
    case "REJECTED":
      w.exit(target);
      return;
    default:
      w.to(target);
  }
}

export function buildExPostProject(ctx: GenContext, spec: ProjectSpec): ProjectAggregate {
  const sid = spec.standard.id as StandardId;
  const profile = PROFILES[sid];
  if (!profile) throw new Error(`no ex-post profile for ${sid}`);
  const rng = projectRng(ctx, spec);
  const seats = seatsFor(ctx, spec);

  const [kindId, methodologyId] = rng.weighted(
    "kind",
    profile.kinds.map((k) => [[k[0], k[1]] as const, k[2]] as const),
  );
  const kind = KINDS[kindId];
  const name = intlProjectName(rng, "name", spec.anchor.country, kindId);
  const areaHa = round2(rng.logNormal("area", kind.area[0], 0.8, kind.area[1], kind.area[2]));
  // A crediting period that has to have ended by now is a short, early one.
  const creditingYears =
    spec.target === "CREDITING_PERIOD_ENDED"
      ? rng.pick("crediting:short", [7, 10])
      : rng.weighted("crediting", profile.creditingYears);
  const totalMitigation = Math.max(
    500,
    Math.round(areaHa * rng.float("rate", kind.rate[0], kind.rate[1]) * creditingYears),
  );
  const bufferRate = round2(rng.float("buffer", kind.buffer[0], kind.buffer[1]));
  const leakageRate = round2(rng.float("leakage", kind.leakage[0], kind.leakage[1]));
  // Ex-post standards allow a retroactive start: activity often predates listing.
  const startOn = startOfDayUtc(addDays(spec.createdAt, rng.int("start", -400, 200)));
  const site = makeSite(ctx, spec, rng, areaHa);
  const cycles = monitoringCycles(rng, startOn, creditingYears);

  const w = new Walker(ctx, spec, rng);
  const initial = w.state;
  walkExPost(w, rng, spec, cycles);
  const statusHistory = statusRecords(ctx, spec, rng, initial, spec.createdAt, w.steps, seats);

  const year = spec.createdAt.getUTCFullYear();
  // The newest version already in force when the project was created, else the oldest listed.
  const era =
    [...profile.versions].reverse().find(([, from]) => year >= from) ?? profile.versions[0];
  if (!era) throw new Error(`${sid}: no standard versions configured`);
  const version = era[0];
  const methodologyVersions = METHODOLOGY_VERSIONS[methodologyId] ?? ["1.0", "1.0"];
  const p = projectShell(ctx, spec, {
    name,
    description: `${kind.activityType} across ${areaHa} ha in ${spec.anchor.locality}, developed by ${spec.developer.organisation.legal_name} under the ${spec.standard.cdop_name}.`,
    nativeProjectId: profile.nativeId(spec.index),
    standardVersion: version,
    methodologyVersionId: `${methodologyId}@${year < 2023 ? methodologyVersions[0] : methodologyVersions[1]}`,
    activityType: kind.activityType,
    site,
    statusHistory,
    mitigation: kind.mitigation,
    startOn,
    endOn: addDays(addYears(startOn, creditingYears), -1),
    durationYears: creditingYears,
    creditingPeriodType: profile.periodType,
    maxCumulativeCreditingYears: creditingYears * profile.maxPeriods,
    maxCreditingPeriods: profile.maxPeriods,
    totalMitigation,
    bufferRate,
  });
  p.native_attributes = prune({
    afolu_category: kind.afolu ? kindId : undefined,
    leakage_rate: leakageRate,
    retroactive_start: startOn.getTime() < spec.createdAt.getTime(),
  });
  if (kind.afolu)
    p.project_risk = {
      internal_risk: rng.int("risk:internal", 0, 12),
      external_risk: rng.int("risk:external", 0, 10),
      natural_risk: rng.int("risk:natural", 2, 10),
      non_permanence_risk_rating_pct: Math.round(bufferRate * 100),
    };
  p.governance_structure = `${spec.developer.organisation.legal_name} is the project proponent; community and landholder participation is governed by benefit-sharing agreements.`;
  if (kind.afolu)
    p.community_frameworks =
      "Free, prior and informed consent procedure and a grievance mechanism agreed with participating communities.";
  p.previous_program = false;

  // ------------------------------------------------------------------------------ validation
  const submitted = w.firstAction("SUBMIT_FOR_VALIDATION");
  const opinion = w.firstAction("VALIDATION_COMPLETE");
  const failed = w.firstAction("VALIDATION_FAILED");
  const registeredStep = w.firstInto("REGISTERED");
  let validation: ValidationEvent | undefined;
  if (submitted) {
    const decided = opinion ?? failed;
    const status: ValidationEvent["status"] = opinion
      ? "completed"
      : failed
        ? "rejected"
        : w.state === "LISTED"
          ? "changes_requested"
          : nativeState(sid, w.state)?.terminal
            ? "withdrawn"
            : "in_review";
    const visit = addDays(submitted.at, rng.int("val:visit", 20, 60));
    const visited = visit.getTime() < (decided?.at ?? ctx.now).getTime();
    validation = prune({
      id: makeId(ctx, spec, "val", "1", submitted.at),
      sequence: 1,
      validation_type: INITIAL_VALIDATION,
      status,
      vvb_organisation_id: spec.vvb.organisation.id,
      vvb_account_id: seats.vvb.id,
      submitted_on: startOfDayUtc(submitted.at),
      site_visit_start_on: visited ? startOfDayUtc(visit) : undefined,
      site_visit_end_on: visited
        ? startOfDayUtc(addDays(visit, rng.int("val:visit:days", 2, 9)))
        : undefined,
      decided_on: decided ? startOfDayUtc(decided.at) : undefined,
      opinion: opinion ? ("positive" as const) : failed ? ("negative" as const) : undefined,
    });
    p.validations.push(validation);
  }
  p.public_comment = Boolean(submitted);
  if (submitted)
    p.public_comment_summary = rng.pick("comment", [
      "No comments were received during the 30-day public comment period.",
      "Two comments were received on benefit sharing; both were addressed in the revised project description.",
      "One comment queried the baseline scenario; the validation body reviewed the response and closed it.",
    ]);

  // ------------------------------------------------------------- crediting period, estimates
  const period = makeCreditingPeriod(
    ctx,
    spec,
    1,
    startOn,
    creditingYears,
    profile.periodType,
    opinion ? validation?.id : undefined,
  );
  p.creditingPeriods.push(period);
  if (validation && opinion) validation.crediting_period_id = period.id;
  const plan: VintagePlan = {
    startOn,
    durationYears: creditingYears,
    periodYears: spec.standard.vintage_period_years,
    totalMitigation,
    bufferRate,
    maxVintages: 50,
  };
  p.estimations = makeEstimations(
    ctx,
    spec,
    plan,
    spec.createdAt,
    registeredStep?.at,
    registeredStep ? validation?.id : undefined,
  );
  const vintages = lastOf(p.estimations).vintages;

  // ---------------------------------------------------------------------------- verifications
  const submits = w.steps.filter((s) => s.transition.action === "REQUEST_VERIFICATION_APPROVAL");
  const approvals = w.steps.filter((s) => s.transition.action === "APPROVE_VERIFICATION");
  // A more-info bounce re-submits the same cycle, so count cycles by approvals, not submits.
  const cycleCount = Math.min(
    cycles.length,
    approvals.length + (w.state === "VERIFICATION_APPROVAL_REQUESTED" ? 1 : 0),
  );
  for (let k = 0; k < cycleCount; k++) {
    const cycle = cycles[k] as Cycle;
    const approved = approvals[k];
    const prior = k === 0 ? registeredStep?.at : approvals[k - 1]?.at;
    const submit =
      submits.find((s) => !prior || s.at.getTime() > prior.getTime()) ?? lastOf(submits);
    const visit = addDays(cycle.end, rng.int(`vrf:${k}:visit`, 30, 120));
    const v: VerificationEvent = prune({
      id: makeId(ctx, spec, "vrf", String(k + 1), submit.at),
      sequence: k + 1,
      monitoring_period_start_on: cycle.start,
      monitoring_period_end_on: cycle.end,
      status: approved ? ("completed" as const) : ("in_review" as const),
      vvb_organisation_id: spec.vvb.organisation.id,
      site_visit_start_on: visit.getTime() < submit.at.getTime() ? startOfDayUtc(visit) : undefined,
      site_visit_end_on:
        visit.getTime() < submit.at.getTime()
          ? startOfDayUtc(addDays(visit, rng.int(`vrf:${k}:visit:days`, 2, 8)))
          : undefined,
      submitted_on: startOfDayUtc(submit.at),
      verified_on: approved ? startOfDayUtc(approved.at) : undefined,
      opinion: approved ? ("positive" as const) : undefined,
      claim_type: kind.claimType,
      uom: "tCO2e",
      predicted_quantity: vintages
        .filter(
          (x) =>
            x.vintage_start_on.getTime() >= cycle.start.getTime() &&
            x.vintage_end_on.getTime() <= cycle.end.getTime(),
        )
        .reduce((s, x) => s + x.estimated_mitigation, 0),
      leakage_deduction: 0,
      buffer_deduction: 0,
      uncertainty_deduction: 0,
    });
    p.verifications.push(v);
  }

  // -------------------------------------------------------------------------------- documents
  const listed = w.firstAction("LIST");
  if (listed) {
    for (const [local, typeId] of [
      ["pdd", "generic:pdd"],
      ["monitoring-plan", "generic:monitoring-plan"],
      ["consultation", "generic:consultation-record"],
    ] as const) {
      p.documents.push(
        makeDocument(ctx, spec, rng, local, typeId, name, listed.at, {
          uploadedBy: seats.developer.id,
        }),
      );
    }
    p.geolocationFiles.push(
      makeGeolocationFile(
        ctx,
        spec,
        site,
        "boundary",
        kind.areaType,
        lastOf(p.documents).uploaded_at,
        `${p.native_project_id}_boundary.geojson`,
      ),
    );
    if (kindId === "REDD") {
      p.geolocationFiles.push(
        makeGeolocationFile(
          ctx,
          spec,
          site,
          "reference",
          "Reference Area",
          lastOf(p.documents).uploaded_at,
          `${p.native_project_id}_reference_region.geojson`,
        ),
      );
      p.geolocationFiles.push(
        makeGeolocationFile(
          ctx,
          spec,
          site,
          "leakage",
          "Leakage Area",
          lastOf(p.documents).uploaded_at,
          `${p.native_project_id}_leakage_belt.geojson`,
        ),
      );
    }
  }
  const decidedStep = opinion ?? failed;
  if (decidedStep && validation) {
    const report = makeDocument(
      ctx,
      spec,
      rng,
      "val:report",
      "generic:validation-report",
      name,
      decidedStep.at,
      { uploadedBy: seats.vvb.id, validationEventId: validation.id },
    );
    const statement = makeDocument(
      ctx,
      spec,
      rng,
      "val:opinion",
      "generic:validation-opinion",
      name,
      decidedStep.at,
      { uploadedBy: seats.vvb.id, validationEventId: validation.id },
    );
    p.documents.push(report, statement);
    validation.report_document_id = report.id;
    validation.statement_document_id = statement.id;
    if (kind.afolu)
      p.documents.push(
        makeDocument(
          ctx,
          spec,
          rng,
          "val:risk",
          "generic:nonpermanence-risk-report",
          name,
          decidedStep.at,
          { uploadedBy: seats.developer.id, validationEventId: validation.id },
        ),
      );
  }
  p.verifications.forEach((v, k) => {
    const before = v.submitted_on ?? ctx.now;
    const label = `${v.monitoring_period_start_on.getUTCFullYear()}-${v.monitoring_period_end_on.getUTCFullYear()}`;
    const monitoring = makeDocument(
      ctx,
      spec,
      rng,
      `vrf:${k}:monitoring`,
      "generic:monitoring-report",
      name,
      before,
      { uploadedBy: seats.developer.id, verificationEventId: v.id, versionLabel: label },
    );
    const report = makeDocument(
      ctx,
      spec,
      rng,
      `vrf:${k}:report`,
      "generic:verification-report",
      name,
      before,
      { uploadedBy: seats.vvb.id, verificationEventId: v.id, versionLabel: label },
    );
    p.documents.push(monitoring, report);
    v.report_document_id = report.id;
    if (v.status === "completed") {
      const statement = makeDocument(
        ctx,
        spec,
        rng,
        `vrf:${k}:statement`,
        "generic:verification-statement",
        name,
        before,
        { uploadedBy: seats.vvb.id, verificationEventId: v.id, versionLabel: label },
      );
      p.documents.push(statement);
      v.statement_document_id = statement.id;
    }
  });
  const pdd = p.documents.find((d) => d.document_type_id === "generic:pdd");
  p.attestations = prune({
    carbon_credit_ownership_attestation: true,
    carbon_credit_ownership_documentation: pdd?.id,
    legal_compliance_attestation: true,
    legal_compliance_documentation: pdd?.id,
    land_right_attestation: kind.afolu ? true : undefined,
    child_labor_attestation: true,
    labor_worker_attestation: true,
  });

  // ------------------------------------------------------------------------------- milestones
  if (registeredStep) {
    const next = cycles[p.verifications.filter((v) => v.status === "completed").length];
    p.verifications.forEach((v, k) => {
      const approved = approvals[k];
      p.milestones.push(
        makeMilestone(
          ctx,
          spec,
          "verification_due",
          `Verification ${v.sequence} (${v.monitoring_period_start_on.getUTCFullYear()}-${v.monitoring_period_end_on.getUTCFullYear()})`,
          10 + k,
          addYears(v.monitoring_period_end_on, 1),
          approved ? { at: approved.at, verificationEventId: v.id } : undefined,
        ),
      );
    });
    if (
      next &&
      !p.verifications.some((v) => v.monitoring_period_end_on.getTime() === next.end.getTime())
    )
      p.milestones.push(
        makeMilestone(
          ctx,
          spec,
          "monitoring_report_due",
          `Monitoring report due (${next.start.getUTCFullYear()}-${next.end.getUTCFullYear()})`,
          50,
          addDays(next.end, 270),
        ),
      );
    p.milestones.push(
      makeMilestone(ctx, spec, "crediting_period_end", "Crediting period end", 99, period.end_on),
    );
  }

  // ---------------------------------------------------------------------------------- extras
  p.stakeholders = makeStakeholders(ctx, spec, spec.createdAt);
  if (kind.afolu) p.landowners = makeLandowners(rng, spec);
  const unitPrice = round2(rng.float("price", profile.price[0], profile.price[1]));
  p.finance = makeFinance(rng, Math.min(areaHa, 5000), totalMitigation, "USD", unitPrice);
  if (rng.bool("extras:cobenefits", 0.6)) {
    p.sdgs = makeSdgs(rng);
    p.cobenefitMethods = [
      sid === "vcs"
        ? "CCB Standards monitoring"
        : sid === "gs4gg"
          ? "Gold Standard SDG Impact Tool"
          : "Programme monitoring report",
    ];
    p.cobenefits = makeCobenefits(ctx, spec, rng, p.verifications);
  }
  if (registeredStep && rng.bool("extras:agreement", 0.2)) {
    const at = addDays(registeredStep.at, rng.int("extras:agreement:lag", 20, 300));
    if (at.getTime() < ctx.now.getTime())
      p.agreements.push(
        makeAgreement(
          ctx,
          spec,
          rng,
          pickSkewed(rng, "extras:agreement:buyer", ctx.parties.buyers),
          at,
          "USD",
          unitPrice,
          Math.round(totalMitigation * rng.float("extras:agreement:share", 0.05, 0.3)),
          startOn.getUTCFullYear(),
        ),
      );
  }
  const unitLabels: string[] = [];
  if (sid === "vcs" && registeredStep) {
    if (kind.afolu && rng.bool("label:ccb", 0.35)) {
      p.labels.push(makeLabel(ctx, spec, "ccb", "accreditation", registeredStep.at));
      if (opinion && validation)
        p.documents.push(
          makeDocument(ctx, spec, rng, "val:ccb", "generic:ccb-report", name, opinion.at, {
            uploadedBy: seats.developer.id,
            validationEventId: validation.id,
          }),
        );
    } else if (rng.bool("label:sdvista", 0.08)) {
      p.labels.push(makeLabel(ctx, spec, "sd-vista", "accreditation", registeredStep.at));
    }
    if (kindId !== "REDD" && rng.bool("label:ccp", 0.3)) unitLabels.push("ccp");
    if (rng.bool("label:corsia", 0.15)) unitLabels.push("corsia-p1");
  }

  buildExPostLedger(ctx, spec, rng, p, { leakageRate, unitLabels });
  touch(p);
  return p;
}
