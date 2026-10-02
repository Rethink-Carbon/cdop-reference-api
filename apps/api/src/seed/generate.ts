/**
 * Turns a seed and a project mix into the whole dataset: parties sized to the mix, then one
 * spec per project (lifecycle target, age, place, developer, VVB) handed to the standard's
 * factory. Everything is a pure function of (seed, counts, now).
 */
import type { Dataset, ProjectAggregate } from "./aggregate.js";
import { anchorsFor } from "./geo/anchors.js";
import type { UkNation } from "./names/uk.js";
import { buildParties, pickSkewed, STANDARD_IDS, type StandardId } from "./parties.js";
import { Rng } from "./prng.js";
import { projectId } from "./standards/assemble.js";
import type { GenContext, ProjectSpec } from "./standards/common.js";
import { buildExPostProject } from "./standards/expost.js";
import { buildPcProject } from "./standards/pc.js";
import { buildWccProject } from "./standards/wcc.js";
import { atBusinessHours } from "./time.js";
import { clamp } from "./util.js";
import { STANDARDS, type StandardSeed } from "./vocab.js";

export type Counts = Partial<Record<StandardId, number>>;

export interface GenerateOptions {
  seed: string;
  counts?: Counts | undefined;
  /** The dataset's present. Fixed by default so a given seed always yields the same data. */
  now?: Date | undefined;
}

/**
 * Default mix, and what the hosted demo seeds: every standard the generator models, so the demo
 * shows CDOP across registries, small enough to seed in seconds. The full mix (plan §10) is
 * FULL_COUNTS.
 */
export const DEFAULT_COUNTS: Counts = {
  wcc: 15,
  pc: 10,
  vcs: 15,
  gs4gg: 10,
  acr: 8,
  "plan-vivo": 6,
  puro: 6,
};
export const FULL_COUNTS: Counts = {
  wcc: 200,
  pc: 100,
  vcs: 100,
  gs4gg: 40,
  acr: 30,
  "plan-vivo": 20,
  puro: 10,
};

/** CDOP schema v2.0 publication week; histories are generated up to this instant. */
export const SEED_NOW = new Date("2026-09-18T12:00:00Z");

const YEAR_MS = 365.25 * 86_400_000;

type Weighted<T> = ReadonlyArray<readonly [T, number]>;

/** First date a project could have been created under each standard. */
const ERA: Record<StandardId, string> = {
  wcc: "2011-07-01",
  pc: "2015-11-02",
  vcs: "2007-03-01",
  gs4gg: "2008-06-02",
  acr: "2008-09-01",
  "plan-vivo": "2008-02-01",
  puro: "2019-06-03",
};

const WCC_TARGETS: Weighted<string> = [
  ["NEW", 3],
  ["PENDING_REVIEW_UNDER_DEVELOPMENT_ACTOR2", 5],
  ["DEVELOPMENT", 22],
  ["PENDING_REVIEW_ACTOR5", 6],
  ["PENDING_REVIEW_ACTOR6", 3],
  ["PENDING_PAYMENT_ACTOR7", 2],
  ["VALIDATED", 30],
  ["VERIFIED", 18],
  ["WITHDRAWN", 5],
  ["NOT_DELIVERED", 3],
  ["REJECTED", 3],
];
const PC_TARGETS: Weighted<string> = [
  ["NEW", 4],
  ["PENDING_REVIEW_UNDER_DEVELOPMENT_3RD_PARTY", 5],
  ["DEVELOPMENT", 25],
  ["PENDING_REVIEW_VALIDATION_VALIDATOR", 8],
  ["PENDING_3RD_VAL", 3],
  ["VALIDATED", 18],
  ["PENDING_VALIDATOR_RESTORATION_VALIDATION", 5],
  ["RESTORATION_VALIDATED", 12],
  ["VERIFIED", 10],
  ["WITHDRAWN", 6],
  ["REJECTED", 4],
];
const EX_POST_TARGETS: Weighted<string> = [
  ["UNDER_DEVELOPMENT", 4],
  ["LISTED", 10],
  ["UNDER_VALIDATION", 10],
  ["REGISTRATION_REQUESTED", 4],
  ["REGISTERED", 17],
  ["VERIFICATION_APPROVAL_REQUESTED", 5],
  ["UNITS_ISSUED", 38],
  ["ON_HOLD", 3],
  ["CREDITING_PERIOD_ENDED", 2],
  ["WITHDRAWN", 4],
  ["REJECTED", 2],
  ["INACTIVE", 1],
];

/** Years before `now` a project was created, by where its history should have got to. */
const AGE: Record<string, [number, number]> = {
  NEW: [0.05, 0.4],
  PENDING_REVIEW_UNDER_DEVELOPMENT_ACTOR2: [0.2, 0.9],
  PENDING_REVIEW_UNDER_DEVELOPMENT_3RD_PARTY: [0.2, 0.9],
  DEVELOPMENT: [0.5, 3],
  PENDING_REVIEW_ACTOR5: [1.2, 3.2],
  PENDING_REVIEW_ACTOR6: [1.4, 3.4],
  PENDING_PAYMENT_ACTOR7: [1.5, 3.5],
  PENDING_REVIEW_VALIDATION_VALIDATOR: [1.2, 3.2],
  PENDING_3RD_VAL: [1.4, 3.4],
  VALIDATED: [2, 5.5],
  PENDING_VALIDATOR_RESTORATION_VALIDATION: [3.5, 6],
  RESTORATION_VALIDATED: [4, 6.5],
  VERIFIED: [7.2, 14.5],
  NOT_DELIVERED: [4, 9],
  UNDER_DEVELOPMENT: [0.05, 0.5],
  LISTED: [0.3, 1.5],
  UNDER_VALIDATION: [0.8, 2.5],
  REGISTRATION_REQUESTED: [1.2, 3],
  REGISTERED: [1.5, 4],
  VERIFICATION_APPROVAL_REQUESTED: [3, 9],
  UNITS_ISSUED: [4, 15],
  ON_HOLD: [4, 10],
  INACTIVE: [6, 12],
  CREDITING_PERIOD_ENDED: [13, 18],
  WITHDRAWN: [1.5, 8],
  REJECTED: [0.6, 6],
};

const WCC_NATIONS: Weighted<UkNation> = [
  ["England", 90],
  ["Scotland", 80],
  ["Wales", 22],
  ["Northern Ireland", 8],
];
const PC_NATIONS: Weighted<UkNation> = [
  ["Scotland", 70],
  ["England", 20],
  ["Wales", 7],
  ["Northern Ireland", 3],
];
const COUNTRIES: Partial<Record<StandardId, readonly string[]>> = {
  vcs: ["KEN", "IDN", "BRA", "PER", "COL", "KHM", "COD", "IND"],
  gs4gg: ["KEN", "UGA", "GHA", "IND", "NPL", "VNM", "RWA", "MWI", "TZA"],
  acr: ["USA", "USA", "CAN", "MEX"],
  "plan-vivo": ["KEN", "UGA", "TZA", "MWI", "NIC", "MEX", "FJI", "NPL"],
  puro: ["FIN", "SWE", "DEU", "USA"],
};

/**
 * Largest-remainder apportionment, so a small mix still gets the rare cases a weighted
 * draw would usually miss (one withdrawn project in twenty rather than probably none).
 */
export function apportion<T>(n: number, weights: Weighted<T>): T[] {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  const quotas = weights.map(([value, w], i) => ({
    value,
    i,
    floor: Math.floor((n * w) / total),
    rest: ((n * w) / total) % 1,
  }));
  let left = n - quotas.reduce((s, q) => s + q.floor, 0);
  for (const q of [...quotas].sort((a, b) => b.rest - a.rest || a.i - b.i)) {
    if (left <= 0) break;
    q.floor += 1;
    left -= 1;
  }
  return quotas.flatMap((q) => Array.from({ length: q.floor }, () => q.value));
}

function createdAt(rng: Rng, key: string, sid: StandardId, target: string, now: Date): Date {
  const [min, max] = AGE[target] ?? [1, 5];
  const wanted = now.getTime() - rng.float(`${key}:age`, min, max) * YEAR_MS;
  return atBusinessHours(
    rng,
    `${key}:created`,
    new Date(Math.max(new Date(`${ERA[sid]}T00:00:00Z`).getTime(), wanted)),
  );
}

function specsFor(ctx: GenContext, rng: Rng, standard: StandardSeed, n: number): ProjectSpec[] {
  const sid = standard.id as StandardId;
  const uk = standard.registry_id === "ukl";
  const targets = rng.shuffle(
    `${sid}:targets`,
    apportion(n, sid === "wcc" ? WCC_TARGETS : sid === "pc" ? PC_TARGETS : EX_POST_TARGETS),
  );
  const nations = uk
    ? rng.shuffle(`${sid}:nations`, apportion(n, sid === "wcc" ? WCC_NATIONS : PC_NATIONS))
    : [];
  const vvbs = uk ? ctx.parties.vvbs.uk : ctx.parties.vvbs.intl;

  const specs = targets.map((target, index): ProjectSpec => {
    const key = `${sid}:${index}`;
    const country = uk ? "GBR" : rng.pick(`${key}:country`, COUNTRIES[sid] ?? ["USA"]);
    return {
      key,
      index,
      standard,
      target,
      anchor: rng.pick(`${key}:anchor`, anchorsFor(country, nations[index])),
      developer: pickSkewed(rng, `${key}:developer`, ctx.parties.developers[sid]),
      vvb: pickSkewed(rng, `${key}:vvb`, vvbs, 1.2),
      createdAt: createdAt(rng, key, sid, target, ctx.now),
    };
  });

  // WCC group schemes: the oldest project in each group is the master, the rest nest under
  // it with the master's developer and nation.
  if (sid === "wcc" && n >= 12) {
    const pool = rng.shuffle("wcc:groups", specs);
    const groups = Math.max(1, Math.round(n * 0.075));
    for (let g = 0; g < groups; g++) {
      const members = pool
        .splice(0, rng.int(`wcc:group:${g}:size`, 3, 4))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const master = members[0];
      if (!master || members.length < 3) break;
      master.programType = "Scaled up program";
      for (const child of members.slice(1)) {
        child.programType = "Nested project";
        child.masterProjectId = projectId(ctx, master);
        child.developer = master.developer;
        child.anchor = rng.pick(
          `${child.key}:anchor:group`,
          anchorsFor("GBR", master.anchor.nation),
        );
      }
    }
  }
  return specs;
}

function factoryFor(sid: StandardId): (ctx: GenContext, spec: ProjectSpec) => ProjectAggregate {
  return sid === "wcc" ? buildWccProject : sid === "pc" ? buildPcProject : buildExPostProject;
}

export function generateDataset(opts: GenerateOptions): Dataset {
  const counts = opts.counts ?? DEFAULT_COUNTS;
  const now = opts.now ?? SEED_NOW;
  const rng = new Rng(`${opts.seed}:dataset`);
  const total = STANDARD_IDS.reduce((s, sid) => s + (counts[sid] ?? 0), 0);

  // About three developers per four projects, so a few hold several and most hold one.
  const developerCounts = Object.fromEntries(
    STANDARD_IDS.map((sid) => [sid, Math.ceil((counts[sid] ?? 0) * 0.76)]),
  ) as Record<StandardId, number>;
  const parties = buildParties(new Rng(`${opts.seed}:parties`), opts.seed, developerCounts, {
    buyers: clamp(Math.round(total * 0.12), 8, 60),
    aggregators: clamp(Math.round(total * 0.03), 3, 12),
    traders: clamp(Math.round(total * 0.015), 2, 6),
  });
  const ctx: GenContext = { seed: opts.seed, now, parties };

  const projects: ProjectAggregate[] = [];
  for (const standard of STANDARDS) {
    const sid = standard.id as StandardId;
    const n = counts[sid] ?? 0;
    if (n <= 0) continue;
    const build = factoryFor(sid);
    for (const spec of specsFor(ctx, rng, standard, n)) projects.push(build(ctx, spec));
  }
  // Oldest first: group masters precede their children, which the writer's FK order relies on.
  projects.sort(
    (a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id),
  );

  return {
    seed: opts.seed,
    generatedAt: now,
    organisations: parties.organisations,
    accounts: parties.accounts,
    projects,
  };
}
