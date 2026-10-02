/**
 * Invented UK names: places from per-nation morphemes, estates/holdings, and organisation
 * names built from compound adjectives + nouns. Nothing here is a real developer, VVB or
 * estate; NAME_DENYLIST guards against accidental collisions with real market actors.
 */
import type { Rng } from "../prng.js";

export type UkNation = "England" | "Scotland" | "Wales" | "Northern Ireland";

const MORPHEMES: Record<UkNation, { heads: string[]; tails: string[]; joiner: string }> = {
  Scotland: {
    heads: ["Glen", "Strath", "Kil", "Auch", "Inver", "Bal", "Dal", "Ard", "Drum", "Craig"],
    tails: [
      "more",
      "nagar",
      "drummond",
      "lochy",
      "garry",
      "affric",
      "beg",
      "cullen",
      "brae",
      "shiel",
      "coille",
      "dubh",
    ],
    joiner: "",
  },
  England: {
    heads: [
      "Ash",
      "Oak",
      "Elm",
      "Hazel",
      "Brack",
      "Stan",
      "Wither",
      "Nether",
      "Over",
      "Lang",
      "Thorn",
      "Wool",
      "Bur",
      "Hol",
    ],
    tails: [
      "thwaite",
      "dale",
      "hurst",
      "wood",
      "ley",
      "combe",
      "worth",
      "field",
      "ford",
      "holme",
      "bury",
      "den",
    ],
    joiner: "",
  },
  Wales: {
    heads: ["Cwm", "Coed", "Pen", "Nant", "Llan", "Bryn", "Cefn", "Rhos", "Blaen", "Tre"],
    tails: [
      "gwyn",
      "ddu",
      "goch",
      "glas",
      "bach",
      "mawr",
      "isaf",
      "uchaf",
      "y-mynydd",
      "yr-afon",
      "hir",
      "melyn",
    ],
    joiner: " ",
  },
  "Northern Ireland": {
    heads: ["Bally", "Drum", "Carrick", "Glen", "Kil", "Tully", "Derry", "Aghn", "Lis", "Clon"],
    tails: [
      "more",
      "beg",
      "keel",
      "shane",
      "gorm",
      "bracken",
      "reagh",
      "ard",
      "aghy",
      "dara",
      "ross",
      "carn",
    ],
    joiner: "",
  },
};

const ESTATE_SUFFIXES = [
  "Estate",
  "Farm",
  "Holding",
  "Moss",
  "Forest",
  "Hill",
  "Common",
  "Muir",
  "Fell",
  "Moor",
  "Park",
  "Grange",
];

const ORG_ADJECTIVES = [
  "Green",
  "Wild",
  "High",
  "Bright",
  "Old",
  "North",
  "Fair",
  "Long",
  "Silver",
  "Broad",
  "Deep",
  "Grey",
  "Red",
  "Black",
  "White",
  "Moss",
  "Ash",
  "Birch",
  "Rowan",
  "Alder",
];
const ORG_NOUNS = [
  "moor",
  "fell",
  "wood",
  "brook",
  "ridge",
  "shaw",
  "holt",
  "hurst",
  "combe",
  "dale",
  "beck",
  "firth",
  "crag",
  "haugh",
  "bank",
  "hollow",
  "gill",
  "ings",
  "law",
  "carr",
];
const ORG_KINDS = ["Carbon", "Woodlands", "Land", "Peatland", "Estates"];
const ORG_FORMS = ["Ltd", "LLP", "CIC", "Trust"];

const VVB_STEMS = [
  "Cheviot",
  "Lomond",
  "Pennine",
  "Tamar",
  "Severn",
  "Wye",
  "Moray",
  "Mendip",
  "Cairngorm",
  "Brecon",
  "Sperrin",
  "Malvern",
];

const CORP_FIRST = [
  "North",
  "Blue",
  "Iron",
  "Amber",
  "Clear",
  "Tidal",
  "Orbit",
  "Summit",
  "Harbour",
  "Beacon",
  "Granite",
  "Copper",
  "Meadow",
  "Crescent",
  "Lumen",
  "Vantage",
  "Cedar",
  "Quill",
  "Anvil",
  "Marlin",
];
const CORP_SECOND = [
  "wind",
  "crest",
  "gate",
  "bridge",
  "line",
  "path",
  "point",
  "stone",
  "works",
  "field",
  "port",
  "haven",
  "mark",
  "reach",
  "vale",
  "wick",
];
const CORP_SECTORS = [
  "Logistics",
  "Foods",
  "Energy",
  "Retail",
  "Insurance",
  "Bank",
  "Airways",
  "Software",
  "Pharma",
  "Brewing",
  "Textiles",
  "Shipping",
  "Telecom",
  "Motors",
  "Hotels",
  "Media",
];
const CORP_FORMS = ["plc", "Group", "Holdings", "Ltd", "Inc", "AG", "SA", "NV"];

const MARKET_STEMS = [
  "Lodestar",
  "Azimuth",
  "Kestrel",
  "Halcyon",
  "Parallax",
  "Cobalt",
  "Meridian",
  "Tessera",
  "Solstice",
  "Argent",
  "Quorum",
  "Lantern",
  "Isobar",
  "Cairn",
  "Fathom",
  "Tallow",
];

/** Real developers, VVBs, registries and programme operators that must never appear in invented names. */
export const NAME_DENYLIST: readonly string[] = [
  "Forest Carbon",
  "Scottish Woodlands",
  "Soil Association",
  "OF&G",
  "Organic Farmers",
  "South Pole",
  "Verra",
  "Sylvera",
  "BeZero",
  "Gold Standard",
  "Tilhill",
  "Highland Carbon",
  "Treeconomy",
  "Finance Earth",
  "SCS Global",
  "Aster Global",
  "Bureau Veritas",
  "TÜV",
  "DNV",
  "Earthood",
  "EPIC Sustainability",
  "Ruby Canyon",
  "Carbon Check",
  "S&P Global",
  "Markit",
  "Scottish Forestry",
  "Forestry Commission",
  "Natural Resources Wales",
  "Peatland ACTION",
];

export function containsDeniedName(name: string): boolean {
  const lower = name.toLowerCase();
  return NAME_DENYLIST.some((d) => lower.includes(d.toLowerCase()));
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A place name in the nation's morphology, e.g. "Glenmore", "Cwm Gwyn", "Ballykeel". */
export function ukPlaceName(rng: Rng, tag: string, nation: UkNation): string {
  const m = MORPHEMES[nation];
  const head = rng.pick(`${tag}:head`, m.heads);
  const tail = rng.pick(`${tag}:tail`, m.tails);
  return m.joiner ? `${head}${m.joiner}${cap(tail)}` : `${head}${tail}`;
}

/** "Glenmore Estate", "Ashthwaite Farm": the landholding a project sits on. */
export function ukHoldingName(rng: Rng, tag: string, nation: UkNation): string {
  return `${ukPlaceName(rng, tag, nation)} ${rng.pick(`${tag}:suffix`, ESTATE_SUFFIXES)}`;
}

const WOODLAND_KINDS = [
  "Woodland Creation",
  "New Native Woodland",
  "Woodland",
  "Native Woodland Creation",
  "Mixed Woodland",
  "Riparian Woodland",
  "Farm Woodland",
];
const PEATLAND_KINDS = [
  "Peatland Restoration",
  "Bog Restoration",
  "Blanket Bog Restoration",
  "Moss Restoration",
  "Peatland Recovery",
];

/** Project name: "{holding} {kind}", e.g. "Strathgarry Estate Woodland Creation". */
export function ukProjectName(
  rng: Rng,
  tag: string,
  nation: UkNation,
  kind: "woodland" | "peatland",
): string {
  const holding = ukHoldingName(rng, `${tag}:holding`, nation);
  const kinds = kind === "woodland" ? WOODLAND_KINDS : PEATLAND_KINDS;
  return `${holding} ${rng.pick(`${tag}:kind`, kinds)}`;
}

export function ukGroupSchemeName(rng: Rng, tag: string, nation: UkNation): string {
  return `${ukPlaceName(rng, tag, nation)} Group Scheme`;
}

/** "{adjective}{noun} {Carbon|Woodlands|Land|Peatland|Estates} {Ltd|LLP|CIC|Trust}". */
export function ukDeveloperName(rng: Rng, tag: string): string {
  const adj = rng.pick(`${tag}:adj`, ORG_ADJECTIVES);
  const noun = rng.pick(`${tag}:noun`, ORG_NOUNS);
  return `${adj}${noun} ${rng.pick(`${tag}:kind`, ORG_KINDS)} ${rng.pick(`${tag}:form`, ORG_FORMS)}`;
}

/** UK validation/verification bodies: "{stem} Certification Ltd". */
export function ukVvbName(index: number): string {
  return `${VVB_STEMS[index % VVB_STEMS.length] ?? "Cheviot"} Certification Ltd`;
}

/** Corporate end users (the beneficiaries of retirements). */
export function corporateName(rng: Rng, tag: string): string {
  const first = rng.pick(`${tag}:first`, CORP_FIRST);
  const second = rng.pick(`${tag}:second`, CORP_SECOND);
  return `${first}${second} ${rng.pick(`${tag}:sector`, CORP_SECTORS)} ${rng.pick(`${tag}:form`, CORP_FORMS)}`;
}

export function aggregatorName(rng: Rng, tag: string): string {
  const stem = rng.pick(`${tag}:stem`, MARKET_STEMS);
  const kind = rng.pick(`${tag}:kind`, [
    "Offset Exchange",
    "Climate Partners",
    "Carbon Marketplace",
    "Nature Credits",
  ]);
  return `${stem} ${kind} ${rng.pick(`${tag}:form`, ["Ltd", "Inc", "GmbH", "BV"])}`;
}

export function traderName(rng: Rng, tag: string): string {
  const stem = rng.pick(`${tag}:stem`, MARKET_STEMS);
  const kind = rng.pick(`${tag}:kind`, [
    "Environmental Markets",
    "Commodities",
    "Carbon Trading",
    "Emissions Desk",
  ]);
  return `${stem} ${kind} ${rng.pick(`${tag}:form`, ["LLP", "LLC", "AG", "SA"])}`;
}

/** A landowner name for the project's landowner list: a holding, never a person. */
export function ukLandownerName(rng: Rng, tag: string, nation: UkNation): string {
  const holding = ukHoldingName(rng, tag, nation);
  return rng.bool(`${tag}:trust`, 0.3) ? `The ${holding} Trust` : `${holding} Partnership`;
}
