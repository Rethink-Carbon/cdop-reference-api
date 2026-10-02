/**
 * The optional trimmings a project may carry: SDGs and co-benefit targets, finance,
 * agreements with offtakes, labels, stakeholders and landowners. Every enum string is a
 * CDOP value (checked by invariants.ts against the vendored schema).
 */
import type {
  Agreement,
  CobenefitTarget,
  ProjectFinance,
  ProjectLabel,
  Stakeholder,
  VerificationEvent,
} from "../aggregate.js";
import { intlLandholderName } from "../names/intl.js";
import { ukLandownerName } from "../names/uk.js";
import type { Party } from "../parties.js";
import type { Rng } from "../prng.js";
import { addDays, addYears, startOfDayUtc } from "../time.js";
import { prune } from "../util.js";
import { makeId, type GenContext, type ProjectSpec } from "./common.js";

const COBENEFIT_TYPES = [
  "Energy",
  "Air, land, and water",
  "Ecology and natural resources",
  "Human rights",
  "Labour",
  "Health and safety",
  "Gender equality",
  "Land acquisition and involuntary resettlement",
  "Indigenous Peoples",
  "Corruption",
  "Cultural heritage",
];

interface CobenefitTemplate {
  type: string;
  indicator: string;
  overview: string;
  unitType: string;
  unitSymbol: string;
  frequency: string;
  baseline: string;
  target: string;
}

const TEMPLATES: CobenefitTemplate[] = [
  {
    type: "Ecology and natural resources",
    indicator: "IND-BIO-01",
    overview: "Native woodland habitat created or restored",
    unitType: "Area",
    unitSymbol: "ha",
    frequency: "Every 5 years",
    baseline: "0",
    target: "38",
  },
  {
    type: "Ecology and natural resources",
    indicator: "IND-BIO-02",
    overview: "Breeding bird species recorded on site",
    unitType: "Count",
    unitSymbol: "#",
    frequency: "Annually",
    baseline: "12",
    target: "24",
  },
  {
    type: "Air, land, and water",
    indicator: "IND-WAT-01",
    overview: "Reduction in dissolved organic carbon in downstream watercourse",
    unitType: "Percentage",
    unitSymbol: "%",
    frequency: "Annually",
    baseline: "0",
    target: "15",
  },
  {
    type: "Labour",
    indicator: "IND-JOB-01",
    overview: "Local full-time-equivalent jobs supported by the project",
    unitType: "Count",
    unitSymbol: "#",
    frequency: "Annually",
    baseline: "0",
    target: "6",
  },
  {
    type: "Health and safety",
    indicator: "IND-HLT-01",
    overview: "Households with reduced indoor air pollution exposure",
    unitType: "Count",
    unitSymbol: "#",
    frequency: "Annually",
    baseline: "0",
    target: "1200",
  },
  {
    type: "Gender equality",
    indicator: "IND-GEN-01",
    overview: "Share of project payments reaching women-headed households",
    unitType: "Percentage",
    unitSymbol: "%",
    frequency: "Annually",
    baseline: "18",
    target: "40",
  },
  {
    type: "Indigenous Peoples",
    indicator: "IND-IP-01",
    overview: "Free, prior and informed consent process completed with resident communities",
    unitType: "Binary",
    unitSymbol: "Y/N",
    frequency: "Sporadically",
    baseline: "N",
    target: "Y",
  },
  {
    type: "Energy",
    indicator: "IND-ENE-01",
    overview: "Fuelwood consumption avoided per household",
    unitType: "Percentage",
    unitSymbol: "%",
    frequency: "Annually",
    baseline: "0",
    target: "45",
  },
  {
    type: "Cultural heritage",
    indicator: "IND-CUL-01",
    overview: "Historic features surveyed and protected within the site",
    unitType: "Count",
    unitSymbol: "#",
    frequency: "Every 5 years",
    baseline: "0",
    target: "3",
  },
];

export function makeSdgs(rng: Rng): number[] {
  const core = [13, 15];
  const extra = rng.sample("sdg:extra", [1, 3, 6, 8, 12, 5, 7, 11], rng.int("sdg:n", 0, 3));
  return [...new Set([...core, ...extra])].sort((a, b) => a - b);
}

export function makeCobenefits(
  ctx: GenContext,
  spec: ProjectSpec,
  rng: Rng,
  verifications: readonly VerificationEvent[],
): CobenefitTarget[] {
  const chosen = rng.sample("cob:pick", TEMPLATES, rng.int("cob:n", 1, 3));
  return chosen.map((t, i) => {
    const impacts = verifications
      .filter((v) => v.status === "completed" && v.verified_on)
      .map((v, k) => {
        const achieved = Math.round(
          Number(t.baseline) +
            (Number(t.target) - Number(t.baseline)) * rng.float(`cob:${i}:ach:${k}`, 0.3, 1.1),
        );
        return prune({
          id: makeId(ctx, spec, "cbi", `${t.indicator}:${k}`),
          verification_event_id: v.id,
          achieved_impact: `${t.overview}: ${Number.isNaN(achieved) ? t.target : achieved} ${t.unitSymbol}`,
          achieved_value: Number.isNaN(achieved) ? t.target : String(achieved),
          change_type: t.unitType === "Percentage" ? "Relative" : "Absolute",
          reported_on: v.verified_on,
        });
      });
    if (!COBENEFIT_TYPES.includes(t.type))
      throw new Error(`co-benefit type ${t.type} is not a CDOP value`);
    return {
      id: makeId(ctx, spec, "cbt", t.indicator),
      cobenefit_type: t.type,
      indicator_id: t.indicator,
      impact_overview: t.overview,
      approach: "Monitored through the project's annual monitoring report and site survey.",
      unit_description: t.overview,
      unit_type: t.unitType,
      unit_symbol: t.unitSymbol,
      monitoring_frequency: t.frequency,
      baseline_value: t.baseline,
      target_value: t.target,
      impacts,
    };
  });
}

const FINANCING = [
  "equity_financing",
  "debt_financing",
  "offtake_agreement",
  "forward_purchase",
  "revenue_share",
  "grant",
  "guarantee",
];
const COMMUNITY = ["revenue_share", "equity_stake", "employment", "in_kind", "trust_fund"];

export function makeFinance(
  rng: Rng,
  areaHa: number,
  totalMitigation: number,
  currency: string,
  unitPrice: number,
): ProjectFinance {
  const initial = Math.round(areaHa * rng.float("fin:init", 4000, 12000));
  return prune({
    expected_initial_costs: initial,
    expected_annual_costs: Math.round(areaHa * rng.float("fin:annual", 60, 220)),
    expected_annual_revenue: Math.round((totalMitigation / 40) * unitPrice),
    total_funding_required: initial,
    total_funding_secured: Math.round(initial * rng.float("fin:secured", 0.4, 1)),
    financing_options: rng.sample("fin:options", FINANCING, rng.int("fin:nopt", 1, 3)),
    community_benefit_mechanisms: rng.bool("fin:community", 0.5)
      ? rng.sample("fin:community:pick", COMMUNITY, rng.int("fin:ncom", 1, 2))
      : [],
    expected_credit_price: Math.round(unitPrice * 100) / 100,
    currency,
  });
}

/** An offtake or forward purchase with a corporate counterparty, plus a funding ladder. */
export function makeAgreement(
  ctx: GenContext,
  spec: ProjectSpec,
  rng: Rng,
  counterparty: Party,
  effectiveOn: Date,
  currency: string,
  unitPrice: number,
  contractedVolume: number,
  vintageStartYear: number,
): Agreement {
  const type = rng.pick("agr:type", [
    "offtake_agreement",
    "forward_purchase",
    "forward_purchase",
    "grant",
  ]);
  const stage = rng.pick("agr:stage", ["Registered", "Validated", "Verified and issuing"]);
  const commitment =
    type === "grant"
      ? Math.round(contractedVolume * unitPrice * 0.3)
      : Math.round(contractedVolume * unitPrice);
  const offtakes: Agreement["offtakes"] =
    type === "grant"
      ? []
      : [
          prune({
            id: makeId(ctx, spec, "oft", "1"),
            contracted_volume: contractedVolume,
            contracted_price: Math.round(unitPrice * 100) / 100,
            vintage_start_year: vintageStartYear,
            vintage_end_year: vintageStartYear + rng.int("agr:span", 4, 14),
            requirements: "Delivery on conversion to verified units; buyer may retire on receipt.",
          }),
        ];
  const funding: Agreement["funding"] = [
    {
      id: makeId(ctx, spec, "fnd", "1"),
      sequence: 1,
      source_category: type === "grant" ? "Grant" : "Prepayment",
      expected_disbursement_on: addDays(effectiveOn, 30),
      disbursement_schedule: "Single tranche on signature",
      conditions_precedent: "Registration confirmed on the registry",
      is_fully_committed: true,
      commitment_status: "Signed",
      is_current: true,
    },
  ];
  return prune({
    id: makeId(ctx, spec, "agr", "1", effectiveOn),
    agreement_type: type,
    notes:
      type === "grant"
        ? "Establishment grant towards the works."
        : "Forward sale of a share of the project's units.",
    currency,
    commitment_amount: commitment,
    effective_on: startOfDayUtc(effectiveOn),
    expiry_on: addYears(effectiveOn, rng.int("agr:years", 5, 15)),
    governing_law: currency === "GBP" ? "England and Wales" : "New York",
    financing_stage: stage,
    marketplace_or_venue: type === "grant" ? [] : ["Bilateral"],
    collateral_type: [type === "grant" ? "None" : "Carbon_rights"],
    offtakes,
    insurance: rng.bool("agr:insured", 0.3)
      ? [
          {
            id: makeId(ctx, spec, "ins", "1"),
            policy_exists: true,
            insurer_name: "Cairn Mutual Assurance",
            policy_reference: `CM-${spec.index + 1000}`,
            coverage_type: "non-delivery",
          },
        ]
      : [],
    funding,
    counterparties: [
      {
        organisation_id: counterparty.organisation.id,
        role: type === "grant" ? "grant_provider" : "offtaker",
        sector: "L64 - Financial service activities, except insurance and pension funding",
      },
    ],
  });
}

export function makeLabel(
  ctx: GenContext,
  spec: ProjectSpec,
  labelId: string,
  kind: ProjectLabel["kind"],
  startOn: Date,
  expiryYears?: number,
): ProjectLabel {
  return prune({
    id: makeId(ctx, spec, "plb", labelId),
    label_id: labelId,
    kind,
    start_on: startOfDayUtc(startOn),
    approved_on: startOfDayUtc(startOn),
    expiry_on: expiryYears ? addYears(startOn, expiryYears) : undefined,
  });
}

export function makeStakeholders(
  ctx: GenContext,
  spec: ProjectSpec,
  createdAt: Date,
): Stakeholder[] {
  return [
    {
      id: makeId(ctx, spec, "stk", "developer"),
      organisation_id: spec.developer.organisation.id,
      stakeholder_type: "Project developer",
      is_primary_developer: true,
      role_started_on: startOfDayUtc(createdAt),
    },
  ];
}

export function makeLandowners(rng: Rng, spec: ProjectSpec): string[] {
  const n = rng.int("owners:n", 1, 2);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const nation = spec.anchor.nation;
    out.push(
      nation
        ? ukLandownerName(rng, `owners:${i}`, nation)
        : intlLandholderName(rng, `owners:${i}`, spec.anchor.country),
    );
  }
  return [...new Set(out)];
}
