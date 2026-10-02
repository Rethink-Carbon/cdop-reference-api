/**
 * Organisations and registry accounts: registry operators, code administrators and
 * buffer pools per standard, VVBs, developers sized to the project mix, and the market
 * side (corporate end users, aggregators, traders) with an account on every registry.
 */
import type { Account, AccountType, Organisation } from "./aggregate.js";
import { deterministicId } from "../domain/ids.js";
import {
  aggregatorName,
  corporateName,
  traderName,
  ukDeveloperName,
  ukVvbName,
} from "./names/uk.js";
import { intlDeveloperName, intlVvbName } from "./names/intl.js";
import type { Rng } from "./prng.js";
import { addDays } from "./time.js";
import { prune } from "./util.js";
import { COUNTRY_NAMES, REGIONS, REGISTRIES, STANDARDS } from "./vocab.js";

export type StandardId = "wcc" | "pc" | "vcs" | "gs4gg" | "acr" | "plan-vivo" | "puro";
export const STANDARD_IDS: readonly StandardId[] = [
  "wcc",
  "pc",
  "vcs",
  "gs4gg",
  "acr",
  "plan-vivo",
  "puro",
];

/** An organisation plus its account on each registry it operates on. */
export interface Party {
  organisation: Organisation;
  accounts: Record<string, Account>;
}

export interface Parties {
  organisations: Organisation[];
  accounts: Account[];
  registryOperator: Record<string, Account>;
  codeAdmin: Record<StandardId, Account>;
  bufferPool: Record<StandardId, Account>;
  /** UK VVBs work the UK Land Carbon Registry; international ones every other registry. */
  vvbs: { uk: Party[]; intl: Party[] };
  developers: Record<StandardId, Party[]>;
  buyers: Party[];
  aggregators: Party[];
  traders: Party[];
}

export interface PartySizes {
  buyers?: number;
  aggregators?: number;
  traders?: number;
}

const UK_REGISTRY = "ukl";
const INTL_REGISTRIES = REGISTRIES.map((r) => r.id).filter((id) => id !== UK_REGISTRY);
const EPOCH = new Date("2009-01-05T00:00:00Z");

/** Native account ids in each registry's own shape (UKL 15-digit band, others numeric). */
function nativeAccountId(registryId: string, ordinal: number): string {
  switch (registryId) {
    case "ukl":
      return `1030000000${String(10000 + ordinal)}`;
    case "verra":
      return String(100000 + ordinal * 7);
    case "gold-standard":
      return String(5000 + ordinal * 3);
    case "acr":
      return String(2000 + ordinal * 2);
    case "plan-vivo":
      return `PV-A${String(100 + ordinal)}`;
    default:
      return String(300000 + ordinal * 11);
  }
}

function orgCountry(
  country: string,
): Pick<Organisation, "country_code" | "country_name" | "region_code" | "region_name"> {
  const region = REGIONS[country];
  return prune({
    country_code: country,
    country_name: COUNTRY_NAMES[country],
    region_code: region?.code,
    region_name: region?.name,
  });
}

export function buildParties(
  rng: Rng,
  seed: string,
  developerCounts: Record<StandardId, number>,
  sizes: PartySizes = {},
): Parties {
  const organisations: Organisation[] = [];
  const accounts: Account[] = [];
  let ordinal = 0;

  const org = (
    key: string,
    legal_name: string,
    country: string,
    extra: Partial<Organisation> = {},
  ): Organisation => {
    const o: Organisation = prune({
      id: deterministicId("org", `${seed}:org:${key}`),
      legal_name,
      ...orgCountry(country),
      ...extra,
    });
    organisations.push(o);
    return o;
  };
  const account = (
    key: string,
    registry_id: string,
    name: string,
    account_type: AccountType,
    extra: Partial<Account> = {},
  ): Account => {
    ordinal += 1;
    const a: Account = prune({
      id: deterministicId("acc", `${seed}:acc:${key}`),
      registry_id,
      native_account_id: nativeAccountId(registry_id, ordinal),
      name,
      account_type,
      status: "active" as const,
      is_master: true,
      opened_on: addDays(EPOCH, rng.int(`acc:${key}:opened`, 0, 365 * 14)),
      holdings_public: account_type === "buffer_pool" || account_type === "registry_operator",
      retirements_public: true,
      ...extra,
    });
    accounts.push(a);
    return a;
  };
  const party = (
    key: string,
    organisation: Organisation,
    registries: readonly string[],
    type: AccountType,
  ): Party => {
    const acc: Record<string, Account> = {};
    for (const registryId of registries) {
      acc[registryId] = account(
        `${key}:${registryId}`,
        registryId,
        organisation.legal_name,
        type,
        prune({ organisation_id: organisation.id, country_code: organisation.country_code }),
      );
    }
    return { organisation, accounts: acc };
  };

  // Registry operators: one system account per registry, owned by the operator organisation.
  const registryOperator: Record<string, Account> = {};
  for (const r of REGISTRIES) {
    const o = org(
      `registry:${r.id}`,
      r.operator_name ?? r.cdop_name,
      r.country_code ?? "USA",
      prune({ cdop_role: "Register/ accounting and tracking registry", website: r.url }),
    );
    registryOperator[r.id] = account(
      `registry:${r.id}`,
      r.id,
      `${r.cdop_name} operator`,
      "registry_operator",
      { organisation_id: o.id, holdings_public: true },
    );
  }

  // Code administrators and buffer pools per standard (invented programme offices).
  const codeAdminNames: Record<StandardId, string> = {
    wcc: "Woodland Code Administration Office",
    pc: "Peatland Programme Office",
    vcs: "Verified Standard Programme Office",
    gs4gg: "Global Goals Programme Office",
    acr: "American Registry Programme Office",
    "plan-vivo": "Plan Vivo Programme Office",
    puro: "Removal Standard Programme Office",
  };
  const codeAdmin = {} as Record<StandardId, Account>;
  const bufferPool = {} as Record<StandardId, Account>;
  for (const s of STANDARDS) {
    const sid = s.id as StandardId;
    const registry = REGISTRIES.find((r) => r.id === s.registry_id);
    const country = registry?.country_code ?? "GBR";
    const o = org(`admin:${sid}`, codeAdminNames[sid], country, {
      cdop_role: "Carbon Crediting Program/ Standard Setters",
    });
    codeAdmin[sid] = account(
      `admin:${sid}`,
      s.registry_id,
      `${s.cdop_name} administrator`,
      "code_administrator",
      { organisation_id: o.id, standard_id: sid },
    );
    bufferPool[sid] = account(
      `buffer:${sid}`,
      s.registry_id,
      `${s.short_code} buffer pool`,
      "buffer_pool",
      { standard_id: sid, holdings_public: true },
    );
  }

  // VVBs: 6 UK certification bodies, 19 international.
  const uk: Party[] = [];
  for (let i = 0; i < 6; i++) {
    const o = org(`vvb:uk:${i}`, ukVvbName(i), "GBR", {
      cdop_role: "Verification Accreditation Agency",
      classification: "Validation/verification body",
    });
    uk.push(party(`vvb:uk:${i}`, o, [UK_REGISTRY], "vvb"));
  }
  const intlVvbCountries = [
    "DEU",
    "CHE",
    "USA",
    "IND",
    "KEN",
    "BRA",
    "IDN",
    "GBR",
    "CAN",
    "COL",
    "MEX",
    "VNM",
    "DEU",
    "USA",
    "IND",
    "KEN",
    "CHE",
    "BRA",
    "USA",
  ];
  const intl: Party[] = intlVvbCountries.map((country, i) => {
    const o = org(`vvb:intl:${i}`, intlVvbName(i, country), country, {
      cdop_role: "Verification Accreditation Agency",
      classification: "Validation/verification body",
    });
    return party(`vvb:intl:${i}`, o, INTL_REGISTRIES, "vvb");
  });

  // Developers per standard, each with one account on the standard's registry.
  const developers = {} as Record<StandardId, Party[]>;
  for (const s of STANDARDS) {
    const sid = s.id as StandardId;
    const n = Math.max(1, developerCounts[sid] ?? 0);
    developers[sid] = [];
    for (let i = 0; i < n; i++) {
      const key = `dev:${sid}:${i}`;
      const country =
        s.registry_id === UK_REGISTRY
          ? "GBR"
          : rng.pick(`${key}:country`, DEVELOPER_COUNTRIES[sid] ?? ["USA"]);
      const name =
        country === "GBR" ? ukDeveloperName(rng, key) : intlDeveloperName(rng, key, country);
      const o = org(key, name, country, {
        cdop_role: "Project developer",
        classification: rng.pick(`${key}:class`, [
          "Private company",
          "Community enterprise",
          "Charity",
          "Landowner",
        ]),
      });
      developers[sid].push(party(key, o, [s.registry_id], "project_developer"));
    }
  }

  const buyers: Party[] = [];
  const buyerCountries = [
    "GBR",
    "GBR",
    "USA",
    "DEU",
    "CHE",
    "FIN",
    "SWE",
    "CAN",
    "IND",
    "BRA",
    "MEX",
    "USA",
  ];
  for (let i = 0; i < (sizes.buyers ?? 60); i++) {
    const key = `buyer:${i}`;
    const o = org(key, corporateName(rng, key), rng.pick(`${key}:country`, buyerCountries), {
      cdop_role: "Other",
      classification: "Corporate end user",
    });
    buyers.push(
      party(
        key,
        o,
        REGISTRIES.map((r) => r.id),
        "corporate_end_user",
      ),
    );
  }
  const aggregators: Party[] = [];
  for (let i = 0; i < (sizes.aggregators ?? 12); i++) {
    const key = `aggregator:${i}`;
    const o = org(
      key,
      aggregatorName(rng, key),
      rng.pick(`${key}:country`, ["GBR", "USA", "DEU", "CHE", "SWE"]),
      { cdop_role: "Infrastructure providers/ operators", classification: "Retail aggregator" },
    );
    aggregators.push(
      party(
        key,
        o,
        REGISTRIES.map((r) => r.id),
        "retail_aggregator",
      ),
    );
  }
  const traders: Party[] = [];
  for (let i = 0; i < (sizes.traders ?? 6); i++) {
    const key = `trader:${i}`;
    const o = org(key, traderName(rng, key), rng.pick(`${key}:country`, ["GBR", "USA", "CHE"]), {
      cdop_role: "Registry with Transaction Functionality",
      classification: "Trader",
    });
    traders.push(
      party(
        key,
        o,
        REGISTRIES.map((r) => r.id),
        "trader",
      ),
    );
  }

  return {
    organisations,
    accounts,
    registryOperator,
    codeAdmin,
    bufferPool,
    vvbs: { uk, intl },
    developers,
    buyers,
    aggregators,
    traders,
  };
}

const DEVELOPER_COUNTRIES: Partial<Record<StandardId, string[]>> = {
  vcs: ["KEN", "IDN", "BRA", "PER", "COL", "KHM", "COD", "IND", "USA", "GBR"],
  gs4gg: ["KEN", "UGA", "GHA", "IND", "NPL", "VNM", "RWA", "MWI", "TZA", "DEU"],
  acr: ["USA", "USA", "CAN", "MEX"],
  "plan-vivo": ["KEN", "UGA", "TZA", "MWI", "NIC", "MEX", "FJI", "NPL", "KHM", "GBR"],
  puro: ["FIN", "SWE", "DEU", "USA", "IND", "CAN"],
};

/** The account a party holds on `registryId` (throws if it has none, which is a wiring bug). */
export function accountOn(p: Party, registryId: string): Account {
  const a = p.accounts[registryId];
  if (!a) throw new Error(`${p.organisation.legal_name} has no account on ${registryId}`);
  return a;
}

/** Skewed pick so a few developers hold many projects, most hold one or two. */
export function pickSkewed<T>(rng: Rng, tag: string, items: readonly T[], exponent = 1.6): T {
  const i = Math.min(
    items.length - 1,
    Math.floor(items.length * Math.pow(rng.unit(tag), exponent)),
  );
  return items[i] as T;
}
