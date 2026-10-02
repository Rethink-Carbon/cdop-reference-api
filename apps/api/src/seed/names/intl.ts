/**
 * Invented international site and organisation names. Places are real administrative
 * regions or landscape features (public geography); the combinations, estates and
 * organisations are made up. Word stems are common nouns in the relevant languages.
 */
import type { Rng } from "../prng.js";

interface CountryFragments {
  places: string[];
  features: string[];
  /** Organisation stems (language-flavoured common nouns). */
  stems: string[];
  forms: string[];
}

const FRAGMENTS: Record<string, CountryFragments> = {
  KEN: {
    places: [
      "Kilifi",
      "Kwale",
      "Taita",
      "Narok",
      "Laikipia",
      "Baringo",
      "Nyandarua",
      "Makueni",
      "Tana",
      "Lamu",
      "Kajiado",
      "Samburu",
    ],
    features: [
      "Creek",
      "Hills",
      "Mangroves",
      "Rangelands",
      "Escarpment",
      "Community Forest",
      "Dryland",
    ],
    stems: ["Kijani", "Msitu", "Mlima", "Ziwa", "Bonde", "Tumaini", "Amani", "Mvua"],
    forms: ["Conservancy", "Trust", "Ltd", "Co-operative"],
  },
  IDN: {
    places: [
      "Katingan",
      "Kapuas",
      "Berau",
      "Siak",
      "Merang",
      "Kampar",
      "Mahakam",
      "Bengkalis",
      "Musi",
      "Sebangau",
    ],
    features: ["Peat Swamp", "Peatlands", "Mangroves", "Watershed", "Forest Block", "Delta"],
    stems: ["Hutan", "Bumi", "Lestari", "Hijau", "Rimba", "Sungai", "Gambut"],
    forms: ["PT", "Yayasan", "Koperasi"],
  },
  BRA: {
    places: [
      "Xingu",
      "Tapajós",
      "Purus",
      "Juruá",
      "Madeira",
      "Araguaia",
      "Tocantins",
      "Jari",
      "Trombetas",
      "Uatumã",
    ],
    features: ["Basin", "Headwaters", "Floodplain", "Forest Corridor", "Reserve", "Watershed"],
    stems: [
      "Mata Viva",
      "Rio Verde",
      "Floresta Nova",
      "Terra Firme",
      "Várzea",
      "Seringal",
      "Igarapé",
    ],
    forms: ["Ltda", "S.A.", "Associação", "Instituto"],
  },
  PER: {
    places: [
      "Ucayali",
      "Loreto",
      "Madre de Dios",
      "San Martín",
      "Huánuco",
      "Junín",
      "Pasco",
      "Cusco",
      "Amazonas",
      "Puno",
    ],
    features: [
      "Concession",
      "Native Community Lands",
      "Watershed",
      "Forest Corridor",
      "Highlands",
      "Lowland Forest",
    ],
    stems: ["Bosque Vivo", "Selva Nueva", "Tierra Alta", "Río Claro", "Monte Verde", "Sacha"],
    forms: ["S.A.C.", "S.R.L.", "Asociación", "Comunidad"],
  },
  COL: {
    places: [
      "Caquetá",
      "Guaviare",
      "Putumayo",
      "Vaupés",
      "Chocó",
      "Meta",
      "Vichada",
      "Cauca",
      "Antioquia",
      "Amazonas",
    ],
    features: ["Reserve", "Resguardo Lands", "Piedmont", "Watershed", "Forest Corridor", "Savanna"],
    stems: ["Verdemonte", "Altavista", "Selva Azul", "Bosque Andino", "Río Nuevo", "Cordillera"],
    forms: ["S.A.S.", "Fundación", "Corporación", "Asociación"],
  },
  KHM: {
    places: [
      "Koh Kong",
      "Stung Treng",
      "Ratanakiri",
      "Mondulkiri",
      "Kratie",
      "Preah Vihear",
      "Siem Reap",
      "Kampong Thom",
      "Pursat",
      "Oddar Meanchey",
    ],
    features: [
      "Wildlife Sanctuary Buffer",
      "Protected Forest",
      "Community Forest",
      "Watershed",
      "Flooded Forest",
      "Highlands",
    ],
    stems: ["Prey", "Tonle", "Phnom", "Stung", "Chamkar", "Kampong"],
    forms: ["Co. Ltd", "Association", "Foundation"],
  },
  COD: {
    places: [
      "Mai-Ndombe",
      "Équateur",
      "Tshuapa",
      "Sud-Kivu",
      "Nord-Kivu",
      "Tshopo",
      "Mongala",
      "Kwilu",
      "Maniema",
      "Ituri",
    ],
    features: [
      "Forest Concession",
      "Community Forest",
      "Wetlands",
      "Peatlands",
      "Watershed",
      "Forest Block",
    ],
    stems: ["Zamba", "Mai", "Ngomba", "Ebale", "Losako", "Bolingo"],
    forms: ["SARL", "ASBL", "Coopérative"],
  },
  IND: {
    places: [
      "Odisha",
      "Chhattisgarh",
      "Madhya Pradesh",
      "Maharashtra",
      "Karnataka",
      "Tamil Nadu",
      "Andhra",
      "Gujarat",
      "Rajasthan",
      "Assam",
    ],
    features: ["Watershed", "Farmlands", "Wastelands", "Mangroves", "Village Commons", "Foothills"],
    stems: ["Hariyali", "Vanam", "Prakriti", "Jeevan", "Dharti", "Nadi", "Aranya"],
    forms: ["Pvt Ltd", "Foundation", "Trust", "Society"],
  },
  UGA: {
    places: [
      "Hoima",
      "Masindi",
      "Kibaale",
      "Mbale",
      "Kabale",
      "Gulu",
      "Lira",
      "Bushenyi",
      "Kasese",
      "Luwero",
    ],
    features: [
      "Hills",
      "Wetlands",
      "Farmlands",
      "Forest Reserve Buffer",
      "Watershed",
      "Escarpment",
    ],
    stems: ["Kijani", "Mwangaza", "Ekitangaala", "Obulamu", "Amagara", "Ensi"],
    forms: ["Ltd", "Co-operative", "Trust", "Foundation"],
  },
  GHA: {
    places: [
      "Ashanti",
      "Western",
      "Eastern",
      "Brong",
      "Northern",
      "Central",
      "Volta",
      "Upper West",
      "Savannah",
      "Bono East",
    ],
    features: [
      "Cocoa Landscape",
      "Forest Reserve Buffer",
      "Savanna",
      "Watershed",
      "Hills",
      "Farmlands",
    ],
    stems: ["Nkabom", "Nyansapo", "Adom", "Asase", "Nsuo", "Kwae"],
    forms: ["Ltd", "Co-operative", "Foundation", "Enterprise"],
  },
  NPL: {
    places: [
      "Koshi",
      "Madhesh",
      "Bagmati",
      "Gandaki",
      "Lumbini",
      "Karnali",
      "Sudurpashchim",
      "Chitwan",
      "Dolakha",
      "Kailali",
    ],
    features: ["Community Forest", "Terai", "Mid-hills", "Watershed", "Foothills", "Valley"],
    stems: ["Hariyali", "Sagarmatha", "Himal", "Jangal", "Khola", "Pahad"],
    forms: ["Pvt Ltd", "Users Group", "Foundation", "Co-operative"],
  },
  VNM: {
    places: [
      "Quảng Nam",
      "Nghệ An",
      "Hà Tĩnh",
      "Lâm Đồng",
      "Đắk Lắk",
      "Gia Lai",
      "Sơn La",
      "Yên Bái",
      "Quảng Bình",
      "Kon Tum",
    ],
    features: [
      "Watershed",
      "Highlands",
      "Mangroves",
      "Coastal Forest",
      "Community Forest",
      "Uplands",
    ],
    stems: ["Rừng Xanh", "Đất Lành", "Sông Xanh", "Núi Xanh", "Mầm Xanh", "Biển Xanh"],
    forms: ["Co. Ltd", "JSC", "Co-operative"],
  },
  RWA: {
    places: [
      "Eastern",
      "Northern",
      "Western",
      "Southern",
      "Gishwati",
      "Nyungwe",
      "Rugezi",
      "Mukura",
      "Kayonza",
      "Gicumbi",
    ],
    features: ["Hills", "Wetlands", "Buffer Zone", "Farmlands", "Watershed", "Terraces"],
    stems: ["Ubumwe", "Imbere", "Urumuri", "Ishyamba", "Isoko", "Ubuzima"],
    forms: ["Ltd", "Co-operative", "Foundation"],
  },
  MEX: {
    places: [
      "Chiapas",
      "Oaxaca",
      "Campeche",
      "Yucatán",
      "Quintana Roo",
      "Veracruz",
      "Jalisco",
      "Michoacán",
      "Durango",
      "Chihuahua",
    ],
    features: ["Ejido Lands", "Sierra", "Selva", "Watershed", "Mangroves", "Highlands"],
    stems: ["Selva Viva", "Monte Alto", "Tierra Nueva", "Bosque Sano", "Sierra Verde", "Río Bravo"],
    forms: ["S.A. de C.V.", "S.C.", "A.C.", "Ejido"],
  },
  MWI: {
    places: [
      "Mzimba",
      "Nkhata Bay",
      "Ntchisi",
      "Dedza",
      "Zomba",
      "Mulanje",
      "Thyolo",
      "Machinga",
      "Kasungu",
      "Mangochi",
    ],
    features: ["Hills", "Escarpment", "Farmlands", "Forest Reserve Buffer", "Watershed", "Plateau"],
    stems: ["Mtengo", "Nkhalango", "Madzi", "Chikondi", "Moyo", "Dziko"],
    forms: ["Ltd", "Co-operative", "Trust", "Association"],
  },
  TZA: {
    places: [
      "Tabora",
      "Morogoro",
      "Kigoma",
      "Kagera",
      "Iringa",
      "Ruvuma",
      "Lindi",
      "Tanga",
      "Manyara",
      "Mbeya",
    ],
    features: [
      "Miombo Woodlands",
      "Village Forest",
      "Highlands",
      "Watershed",
      "Mangroves",
      "Rangelands",
    ],
    stems: ["Kijani", "Msitu", "Mlima", "Ziwa", "Maisha", "Nuru", "Tumaini"],
    forms: ["Ltd", "Co-operative", "Trust", "Society"],
  },
  NIC: {
    places: [
      "Jinotega",
      "Matagalpa",
      "Rivas",
      "Nueva Segovia",
      "Estelí",
      "Boaco",
      "Chontales",
      "Río San Juan",
      "Caribe Norte",
      "Caribe Sur",
    ],
    features: [
      "Highlands",
      "Coffee Landscape",
      "Watershed",
      "Reserve Buffer",
      "Farmlands",
      "Lowland Forest",
    ],
    stems: [
      "Bosque Vivo",
      "Tierra Fértil",
      "Monte Verde",
      "Río Claro",
      "Selva Nueva",
      "Cerro Alto",
    ],
    forms: ["S.A.", "Cooperativa", "Asociación", "Fundación"],
  },
  FJI: {
    places: [
      "Ba",
      "Nadroga",
      "Ra",
      "Bua",
      "Macuata",
      "Cakaudrove",
      "Tailevu",
      "Naitasiri",
      "Serua",
      "Rewa",
    ],
    features: ["Mangroves", "Uplands", "Watershed", "Mataqali Lands", "Coastal Forest", "Hills"],
    stems: ["Vanua", "Veikau", "Wai", "Bula", "Loloma", "Tikina"],
    forms: ["Ltd", "Trust", "Co-operative"],
  },
  USA: {
    places: [
      "Klamath",
      "Cascade",
      "Ozark",
      "Allegheny",
      "Adirondack",
      "Cumberland",
      "Sierra",
      "Olympic",
      "Blue Ridge",
      "Superior",
      "Bitterroot",
      "Chattahoochee",
    ],
    features: [
      "Working Forest",
      "Timberlands",
      "Watershed",
      "Ranch",
      "Foothills",
      "Uplands",
      "Basin",
    ],
    stems: [
      "Ridgeline",
      "Timberline",
      "Northfork",
      "Clearwater",
      "Ironwood",
      "Stonecreek",
      "Bluewater",
    ],
    forms: ["LLC", "Inc", "LP", "Trust"],
  },
  CAN: {
    places: [
      "Kootenay",
      "Cariboo",
      "Skeena",
      "Muskoka",
      "Algonquin",
      "Laurentian",
      "Cape Breton",
      "Miramichi",
      "Athabasca",
      "Interlake",
    ],
    features: ["Working Forest", "Timberlands", "Watershed", "Boreal Block", "Uplands", "Wetlands"],
    stems: ["Boreal", "Northfork", "Clearwater", "Lakehead", "Granite", "Tamarack"],
    forms: ["Inc", "Ltd", "Corp", "Co-operative"],
  },
  FIN: {
    places: [
      "Lappi",
      "Kainuu",
      "Pohjois-Karjala",
      "Keski-Suomi",
      "Satakunta",
      "Pirkanmaa",
      "Etelä-Savo",
      "Pohjanmaa",
      "Uusimaa",
      "Kymenlaakso",
    ],
    features: [
      "Biochar Facility",
      "Sawmill Site",
      "Forest Holding",
      "Peatland",
      "Industrial Park",
      "Mire",
    ],
    stems: ["Metsä", "Hiili", "Suo", "Järvi", "Puu", "Tuli"],
    forms: ["Oy", "Oyj", "Osk"],
  },
  SWE: {
    places: [
      "Norrbotten",
      "Västerbotten",
      "Jämtland",
      "Dalarna",
      "Värmland",
      "Gävleborg",
      "Småland",
      "Skåne",
      "Härjedalen",
      "Ångermanland",
    ],
    features: [
      "Biochar Facility",
      "Forest Holding",
      "Sawmill Site",
      "Industrial Park",
      "Peatland",
      "Uplands",
    ],
    stems: ["Skog", "Kol", "Sjö", "Björk", "Tall", "Myr"],
    forms: ["AB", "Ekonomisk förening", "Stiftelse"],
  },
  DEU: {
    places: [
      "Brandenburg",
      "Mecklenburg",
      "Niedersachsen",
      "Bayern",
      "Thüringen",
      "Sachsen",
      "Hessen",
      "Schwarzwald",
      "Eifel",
      "Harz",
    ],
    features: ["Biochar Facility", "Forest Holding", "Moor", "Industrial Site", "Uplands", "Heath"],
    stems: ["Wald", "Kohle", "Moor", "Quelle", "Buche", "Tanne"],
    forms: ["GmbH", "eG", "Stiftung", "AG"],
  },
};

const KIND_LABELS: Record<string, string[]> = {
  ARR: [
    "Reforestation Project",
    "Restoration Project",
    "Native Forest Restoration",
    "Agroforestry Programme",
  ],
  REDD: ["REDD+ Project", "Forest Conservation Project", "Avoided Deforestation Project"],
  IFM: ["Improved Forest Management Project", "Managed Forest Project"],
  WRC: ["Mangrove Restoration", "Peatland Rewetting Project", "Wetland Restoration Project"],
  ALM: ["Regenerative Agriculture Programme", "Soil Carbon Project"],
  ENERGY: ["Clean Cookstove Programme", "Household Energy Programme", "Biodigester Programme"],
  BIOCHAR: ["Biochar Carbon Removal", "Biochar Production Facility"],
  WELLS: ["Orphan Well Plugging Project"],
};

function fragments(country: string): CountryFragments {
  const f = FRAGMENTS[country];
  if (!f) throw new Error(`no name fragments for ${country}`);
  return f;
}

export const INTL_COUNTRIES: readonly string[] = Object.keys(FRAGMENTS);

/** "{place} {feature} {kind}", e.g. "Kilifi Creek Mangrove Restoration". */
export function intlProjectName(rng: Rng, tag: string, country: string, kind: string): string {
  const f = fragments(country);
  const labels = KIND_LABELS[kind] ?? KIND_LABELS.ARR ?? ["Project"];
  return `${rng.pick(`${tag}:place`, f.places)} ${rng.pick(`${tag}:feature`, f.features)} ${rng.pick(`${tag}:kind`, labels)}`;
}

/** "{stem} {Conservation|Forestry|…} {form}", e.g. "Msitu Landscapes Ltd". */
export function intlDeveloperName(rng: Rng, tag: string, country: string): string {
  const f = fragments(country);
  const kind = rng.pick(`${tag}:kind`, [
    "Conservation",
    "Forestry",
    "Carbon",
    "Landscapes",
    "Agroforestry",
    "Climate",
    "Restoration",
  ]);
  return `${rng.pick(`${tag}:stem`, f.stems)} ${kind} ${rng.pick(`${tag}:form`, f.forms)}`;
}

const VVB_STEMS = [
  "Azimuth",
  "Lodestar",
  "Parallax",
  "Halcyon",
  "Meridian",
  "Cobalt",
  "Tessera",
  "Solstice",
  "Argent",
  "Quorum",
  "Isobar",
  "Fathom",
  "Kestrel",
  "Lantern",
  "Cairn",
  "Basalt",
  "Sextant",
  "Corvid",
  "Umber",
];
const VVB_KINDS = ["Assurance", "Verification", "Certification", "Audit", "Validation Services"];
const VVB_FORMS: Record<string, string> = {
  DEU: "GmbH",
  CHE: "AG",
  USA: "Inc",
  IND: "Pvt Ltd",
  KEN: "Ltd",
  BRA: "Ltda",
  IDN: "PT",
  GBR: "Ltd",
  CAN: "Inc",
  COL: "S.A.S.",
  MEX: "S.A. de C.V.",
  VNM: "Co. Ltd",
};

/** Deterministic by index so the roster is stable regardless of counts elsewhere. */
export function intlVvbName(index: number, country: string): string {
  const stem = VVB_STEMS[index % VVB_STEMS.length] ?? "Azimuth";
  const kind = VVB_KINDS[Math.floor(index / VVB_STEMS.length) % VVB_KINDS.length] ?? "Assurance";
  return `${stem} ${kind} ${VVB_FORMS[country] ?? "Ltd"}`;
}

/** A community or landholder name for landowner lists. */
export function intlLandholderName(rng: Rng, tag: string, country: string): string {
  const f = fragments(country);
  return `${rng.pick(`${tag}:place`, f.places)} ${rng.pick(`${tag}:kind`, ["Community Association", "Landholders Group", "Farmers' Co-operative", "Village Council"])}`;
}
