/**
 * Peatland Code projects: larger upland sites, emission reductions driven by the change in
 * condition category, a 15% buffer (20% from v2.1), a payment hold before validation and a
 * restoration validation once the works are done, before the year-5 verification.
 */
import type { ProjectAggregate } from "../aggregate.js";
import { ukProjectName } from "../names/uk.js";
import { addDays, startOfDayUtc } from "../time.js";
import { pad, round2 } from "../util.js";
import { projectRng, type GenContext, type ProjectSpec } from "./common.js";
import { buildUkProject, type UkProfile } from "./uk.js";

const PROFILE: UkProfile = {
  codes: {
    development: "DEVELOPMENT",
    customerReview: "PENDING_REVIEW_VALIDATION_CUSTOMER",
    systemReview: "PENDING_REVIEW_VALIDATION_MARKIT",
    paymentHold: "VALIDATED_PENDING_PAYMENT",
    holdAction: "REGISTRY_ADMIN_PENDING_PAYMENT_PROJECT",
    releaseAction: "REGISTRY_ADMIN_APPROVE_PROJECT",
    validateAction: "VALIDATE_PROJECT",
    validated: "VALIDATED",
    verified: "VERIFIED",
    restoration: {
      submitAction: "RESTORATION_VALIDATE_PROJECT",
      pending: ["PENDING_VALIDATOR_RESTORATION_VALIDATION", "PENDING_MOP_RESTORATION_VALIDATION"],
      validated: "RESTORATION_VALIDATED",
    },
  },
  docs: {
    registration: [
      "pc:100000000000099",
      "pc:100000000000371",
      "pc:100000000000372",
      "pc:100000000000518",
    ],
    validation: [
      "pc:100000000000011",
      "pc:100000000000505",
      "pc:103000000000198",
      "pc:100000000000511",
      "pc:100000000000510",
      "pc:100000000000512",
      "pc:100000000000355",
    ],
    validationStatement: "pc:3100011",
    restorationStatement: "pc:3100012",
    progressReport: "pc:300000000000001",
    verificationStatement: "pc:100000000000010",
    ownership: "pc:100000000000011",
    pdd: "pc:100000000000099",
  },
  areaType: "Project Area",
  claimType: "EMISSION_REDUCTION",
  cobenefitMethod: "Peatland Code management and monitoring plan",
};

/** Peatland Code condition categories with emission factors (tCO2e/ha/yr), most degraded first. */
const CONDITION: ReadonlyArray<readonly [category: string, factor: number]> = [
  ["Actively Eroding: Hagg/Gully", 23.84],
  ["Actively Eroding: Flat Bare", 23.84],
  ["Drained: Hagg/Gully", 4.54],
  ["Drained: Artificial", 4.54],
  ["Modified", 2.54],
  ["Near Natural", 1.08],
];
const RISK = ["Low", "Low", "Medium", "Medium", "High"];

function standardVersion(createdAt: Date): string {
  const t = createdAt.getTime();
  return t < Date.UTC(2023, 2, 1) ? "1.2" : t < Date.UTC(2024, 6, 1) ? "2.0" : "2.1";
}

export function buildPcProject(ctx: GenContext, spec: ProjectSpec): ProjectAggregate {
  const rng = projectRng(ctx, spec);
  const nation = spec.anchor.nation ?? "Scotland";
  const name = ukProjectName(rng, "name", nation, "peatland");
  const areaHa = round2(rng.logNormal("area", 120, 0.95, 5, 3200));
  const durationYears = rng.weighted("duration", [
    [100, 30],
    [75, 10],
    [50, 25],
    [40, 15],
    [30, 20],
  ] as const);
  const version = standardVersion(spec.createdAt);

  // Split the site across two or three baseline categories; restoration moves each one step
  // (eroding → drained → modified), and the claim is the emission-factor difference.
  const picked = rng.sample("condition:pick", CONDITION.slice(0, 5), rng.int("condition:n", 2, 3));
  const weights = picked.map((_, i) => rng.float(`condition:w${i}`, 0.2, 1));
  const weightTotal = weights.reduce((s, x) => s + x, 0);
  let annual = 0;
  const categories = picked.map(([category, factor], i) => {
    const ha = round2((areaHa * (weights[i] as number)) / weightTotal);
    const after = category.startsWith("Actively Eroding")
      ? (["Drained: Hagg/Gully", 4.54] as const)
      : category.startsWith("Drained")
        ? (["Modified", 2.54] as const)
        : (["Near Natural", 1.08] as const);
    annual += ha * (factor - after[1]);
    return {
      baseline_condition: category,
      restored_condition: after[0],
      area_ha: ha,
      baseline_emission_factor: factor,
      restored_emission_factor: after[1],
    };
  });
  const totalMitigation = Math.max(80, Math.round(annual * durationYears));
  const startOn = startOfDayUtc(addDays(spec.createdAt, rng.int("start", 60, 500)));

  return buildUkProject(ctx, spec, rng, PROFILE, {
    name,
    description: `Restoration of ${areaHa} ha of degraded ${rng.pick("bog", ["blanket bog", "blanket bog", "raised bog", "upland blanket bog"])} in ${spec.anchor.locality}, ${nation}, by ${rng.pick("works", ["grip blocking and hagg reprofiling", "drain blocking and bare peat revegetation", "gully blocking, reprofiling and sphagnum inoculation", "ditch blocking and bunding"])}, under the Peatland Code for ${durationYears} years.`,
    nativeProjectId: `1030000000${pad(40000 + spec.index, 5)}`,
    areaHa,
    startOn,
    durationYears,
    totalMitigation,
    bufferRate: version === "2.1" ? 0.2 : (spec.standard.default_buffer_rate ?? 0.15),
    standardVersion: version,
    methodologyVersionId: `pc-emissions-calculator@${version === "2.1" ? "2.1" : "2.0"}`,
    activityType: "Peatland restoration",
    mitigation: {
      mitigation_type: "Reduction - nature",
      project_sector: "A01 - Crop and animal production, hunting and related service activities",
      project_type: "Wetland Restoration",
    },
    unitPrice: round2(rng.float("price", 16, 30)),
    nativeAttributes: {
      peatland_type: rng.pick("peat:type", ["Blanket bog", "Blanket bog", "Raised bog"]),
      condition_categories: categories,
      mean_peat_depth_m: round2(rng.float("peat:depth", 0.6, 3.4)),
      restoration_works_start_on: startOn.toISOString().slice(0, 10),
      public_funding: rng.pick("funding", [
        "National peatland restoration grant",
        "Devolved peatland restoration programme",
        "None",
      ]),
    },
    projectRisk: {
      fire: rng.pick("risk:fire", RISK),
      grazing_and_trampling: rng.pick("risk:grazing", RISK),
      drain_failure: rng.pick("risk:drains", RISK),
      buffer_contribution_pct: version === "2.1" ? 20 : 15,
    },
  });
}
