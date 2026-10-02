/**
 * Woodland Carbon Code projects: log-normal site areas (median 25 ha), mostly 100-year
 * durations, 5-year vintages, a 20% buffer, validation due within three years of
 * registration and verification at year 5 then every 10 years.
 */
import type { ProjectAggregate } from "../aggregate.js";
import { ukGroupSchemeName, ukProjectName } from "../names/uk.js";
import { addDays, startOfDayUtc } from "../time.js";
import { pad, round2 } from "../util.js";
import { projectRng, type GenContext, type ProjectSpec } from "./common.js";
import { buildUkProject, type UkProfile } from "./uk.js";

const PROFILE: UkProfile = {
  codes: {
    development: "DEVELOPMENT",
    customerReview: "PENDING_REVIEW_ACTOR4",
    systemReview: "PENDING_REVIEW_ACTOR7",
    paymentHold: "PENDING_PAYMENT_ACTOR7",
    holdAction: "PENDING_PAYMENT_ACTOR7",
    releaseAction: "APPROVE_ACTOR7",
    approveSystemAction: "APPROVE_ACTOR7",
    validateAction: "VALIDATE_ACTOR4",
    validated: "VALIDATED",
    verified: "VERIFIED",
  },
  docs: {
    registration: [
      "wcc:100000000000099",
      "wcc:100000000000371",
      "wcc:100000000000372",
      "wcc:100000000000506",
      "wcc:100000000000005",
      "wcc:100000000000505",
    ],
    validation: ["wcc:103000000000198", "wcc:100000000000355", "wcc:100000000000507"],
    validationStatement: "wcc:100000000000370",
    progressReport: "wcc:300000000000001",
    verificationStatement: "wcc:100000000000374",
    ownership: "wcc:100000000000005",
    pdd: "wcc:100000000000099",
  },
  areaType: "Planting Area",
  claimType: "CARBON_REMOVAL",
  cobenefitMethod: "Woodland Benefits Tool",
};

const SPECIES_MIXES = [
  "Native broadleaf mix",
  "Native broadleaf with Scots pine",
  "Mixed broadleaf and conifer",
  "Productive conifer with native broadleaf edges",
  "Riparian native broadleaf",
  "Upland native woodland (birch, rowan, willow)",
];
const ESTABLISHMENT = [
  "Planting",
  "Planting",
  "Planting",
  "Natural regeneration",
  "Planting with natural regeneration",
];
const RISK = ["Low", "Low", "Low", "Medium", "Medium", "High"];

function standardVersion(createdAt: Date): string {
  const y = createdAt.getUTCFullYear();
  return y < 2019 ? "2.0" : y < 2022 ? "2.1" : y < 2025 ? "2.2" : "3.0";
}

export function buildWccProject(ctx: GenContext, spec: ProjectSpec): ProjectAggregate {
  const rng = projectRng(ctx, spec);
  const nation = spec.anchor.nation ?? "England";
  const isGroup = spec.programType === "Scaled up program";
  const name = isGroup
    ? ukGroupSchemeName(rng, "name", nation)
    : ukProjectName(rng, "name", nation, "woodland");
  // A group scheme is the sum of several small holdings, so it runs larger than a single site.
  const areaHa = round2(rng.logNormal("area", isGroup ? 90 : 25, 0.9, 1.5, 850));
  const durationYears = rng.weighted("duration", [
    [100, 70],
    [65, 8],
    [55, 8],
    [40, 8],
    [35, 6],
  ] as const);
  const species = rng.pick("species", SPECIES_MIXES);
  // Lookup-table yields run roughly 280–520 tCO2e/ha over a century; shorter projects claim less.
  const perHa =
    rng.float("yield", 280, 520) *
    Math.pow(durationYears / 100, 0.75) *
    (species.startsWith("Productive") ? 1.15 : 1);
  const totalMitigation = Math.max(60, Math.round(areaHa * perHa));
  const version = standardVersion(spec.createdAt);
  const startOn = startOfDayUtc(addDays(spec.createdAt, rng.int("start", 30, 400)));
  const establishment = rng.pick("establishment", ESTABLISHMENT);

  return buildUkProject(ctx, spec, rng, PROFILE, {
    name,
    description: `${establishment === "Natural regeneration" ? "Natural regeneration" : "Creation"} of ${areaHa} ha of new woodland (${species.toLowerCase()}) in ${spec.anchor.locality}, ${nation}, registered under the Woodland Carbon Code for ${durationYears} years.`,
    nativeProjectId: `1030000000${pad(20000 + spec.index, 5)}`,
    areaHa,
    startOn,
    durationYears,
    totalMitigation,
    bufferRate: spec.standard.default_buffer_rate ?? 0.2,
    standardVersion: version,
    methodologyVersionId: `wcc-carbon-calculator@${version === "3.0" ? "3.0" : "2.4"}`,
    activityType: "Woodland creation",
    mitigation: {
      mitigation_type: "Removal - nature",
      project_sector: "A02 - Forestry and logging",
      project_type: "Afforestation",
    },
    unitPrice: round2(rng.float("price", 18, 34)),
    validationDeadlineYears: 3,
    nativeAttributes: {
      species_mix: species,
      establishment_method: establishment,
      net_planted_area_ha: round2(areaHa * rng.float("net", 0.78, 0.96)),
      gross_area_ha: areaHa,
      planting_start_on: startOn.toISOString().slice(0, 10),
      is_group: isGroup,
      previous_land_use: rng.pick("landuse", [
        "Improved grassland",
        "Rough grazing",
        "Arable",
        "Semi-improved grassland",
        "Bracken",
      ]),
      grant_scheme: rng.pick("grant", [
        "National woodland creation grant",
        "Devolved forestry grant scheme",
        "Small woodland grant",
        "None",
        "None",
      ]),
    },
    projectRisk: {
      fire: rng.pick("risk:fire", RISK),
      wind: rng.pick("risk:wind", RISK),
      pests_and_disease: rng.pick("risk:pests", RISK),
      deer_and_grazing: rng.pick("risk:deer", RISK),
      buffer_contribution_pct: 20,
    },
  });
}
