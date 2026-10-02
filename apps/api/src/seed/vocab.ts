/**
 * Static reference data: registries (the id authority), crediting programs, standards,
 * methodologies, labels, document types. CDOP enum strings are copied verbatim from the
 * vendored schema (typos included; see SCHEMA-FEEDBACK.md).
 */

export interface RegistrySeed {
  id: string;
  cdop_name: string;
  operator_name?: string;
  url?: string;
  project_url_template?: string;
  serial_grammar?: string;
  country_code?: string;
}

export const REGISTRIES: RegistrySeed[] = [
  {
    id: "ukl",
    cdop_name: "UK Land Carbon Registry",
    operator_name: "S&P Global Commodity Insights",
    url: "https://registry.spglobal.com/uklandcarbonregistry/",
    project_url_template:
      "https://registry.spglobal.com/uklandcarbonregistry/public/{standard}/projects/{native_project_id}",
    serial_grammar:
      "{CODE}-{UNITTYPE}-GB-{projectId}-{ddMMyyyy vintage start}-{ddMMyyyy vintage end}-{blockStart}-{blockEnd}-MER-0-P",
    country_code: "GBR",
  },
  {
    id: "verra",
    cdop_name: "Verra",
    operator_name: "Verra",
    url: "https://registry.verra.org/",
    project_url_template: "https://registry.verra.org/app/projectDetail/VCS/{native_project_id}",
    serial_grammar:
      "{issuance}-{blockStart}-{blockEnd}-VCS-VCU-{program}-VER-{alpha3}-{sector}-{projectId}-{ddMMyyyy}-{ddMMyyyy}-{flag}",
    country_code: "USA",
  },
  {
    id: "gold-standard",
    cdop_name: "Gold Standard",
    operator_name: "Gold Standard Foundation",
    url: "https://registry.goldstandard.org/",
    project_url_template: "https://registry.goldstandard.org/projects/details/{native_project_id}",
    serial_grammar: "GS1-1-GS-VER-{projectId}-{vintage}-{blockStart}-{blockEnd}",
    country_code: "CHE",
  },
  {
    id: "acr",
    cdop_name: "American Carbon Registry (ACR)",
    operator_name: "American Carbon Registry",
    url: "https://acr2.apx.com/",
    project_url_template: "https://acr2.apx.com/mymodule/reg/prjView.asp?id1={native_project_id}",
    serial_grammar: "ACR-{projectId}-{vintage}-{blockStart}-{blockEnd}",
    country_code: "USA",
  },
  {
    id: "plan-vivo",
    cdop_name: "Plan Vivo",
    operator_name: "Plan Vivo Foundation",
    url: "https://www.planvivo.org/",
    project_url_template: "https://www.planvivo.org/{native_project_id}",
    serial_grammar: "PV-{projectId}-{year}-{blockStart}-{blockEnd}",
    country_code: "GBR",
  },
  {
    id: "puro",
    cdop_name: "Puro Standard and Registry",
    operator_name: "Puro.earth",
    url: "https://registry.puro.earth/",
    project_url_template:
      "https://registry.puro.earth/carbon-removal-suppliers/{native_project_id}",
    serial_grammar: "CORC-{facility}-{year}-{blockStart}-{blockEnd}",
    country_code: "FIN",
  },
];

export interface ProgramSeed {
  id: string;
  cdop_name: string;
  url?: string;
}

export const PROGRAMS: ProgramSeed[] = [
  {
    id: "wcc",
    cdop_name: "Woodland Carbon Code" /* not in the CDOP program enum: CDOP-FB-028 */,
    url: "https://woodlandcarboncode.org.uk/",
  },
  {
    id: "iucn-ukpp",
    cdop_name: "IUCN UK Peatland Programme",
    url: "https://www.iucn-uk-peatlandprogramme.org/",
  },
  { id: "verra", cdop_name: "Verra", url: "https://verra.org/" },
  { id: "gold-standard", cdop_name: "Gold Standard", url: "https://www.goldstandard.org/" },
  { id: "acr", cdop_name: "American Carbon Registry (ACR)", url: "https://acrcarbon.org/" },
  { id: "plan-vivo", cdop_name: "Plan Vivo", url: "https://www.planvivo.org/" },
  { id: "puro", cdop_name: "Puro.earth", url: "https://puro.earth/" },
];

export interface StandardSeed {
  id: string;
  cdop_name: string;
  short_code: string;
  crediting_program_id: string;
  registry_id: string;
  native_standard_id?: string;
  unit_type_pending?: string;
  unit_type_verified: string;
  default_buffer_rate?: number;
  vintage_period_years: number;
  verification_schedule: { first_year: number; interval_years: number };
  status_vocabulary: string;
  versions: string[];
}

export const STANDARDS: StandardSeed[] = [
  {
    id: "wcc",
    cdop_name: "Woodland Carbon Code",
    short_code: "WCC",
    crediting_program_id: "wcc",
    registry_id: "ukl",
    native_standard_id: "100000000000042",
    unit_type_pending: "PIU",
    unit_type_verified: "WCU",
    default_buffer_rate: 0.2,
    vintage_period_years: 5,
    verification_schedule: { first_year: 5, interval_years: 10 },
    status_vocabulary: "ukl-wcc",
    versions: ["2.0", "2.1", "2.2", "3.0"],
  },
  {
    id: "pc",
    cdop_name: "Peatland Code",
    short_code: "PC",
    crediting_program_id: "iucn-ukpp",
    registry_id: "ukl",
    native_standard_id: "100000000000157",
    unit_type_pending: "PIU",
    unit_type_verified: "PCU",
    default_buffer_rate: 0.15,
    vintage_period_years: 5,
    verification_schedule: { first_year: 5, interval_years: 10 },
    status_vocabulary: "ukl-pc",
    versions: ["1.2", "2.0", "2.1"],
  },
  {
    id: "vcs",
    cdop_name: "Verificed Carbon Standard (VCS)",
    short_code: "VCS",
    crediting_program_id: "verra",
    registry_id: "verra",
    unit_type_verified: "VCU",
    vintage_period_years: 1,
    verification_schedule: { first_year: 1, interval_years: 1 },
    status_vocabulary: "verra",
    versions: ["4.0", "4.4", "4.5", "4.7"],
  },
  {
    id: "gs4gg",
    cdop_name: "Gold Standard for the Global Goals",
    short_code: "GS",
    crediting_program_id: "gold-standard",
    registry_id: "gold-standard",
    unit_type_verified: "VER, CER",
    vintage_period_years: 1,
    verification_schedule: { first_year: 2, interval_years: 2 },
    status_vocabulary: "gold-standard",
    versions: ["1.2", "1.3"],
  },
  {
    id: "acr",
    cdop_name: "American Carbon Registry (ACR) Standard",
    short_code: "ACR",
    crediting_program_id: "acr",
    registry_id: "acr",
    unit_type_verified: "ERT",
    vintage_period_years: 1,
    verification_schedule: { first_year: 1, interval_years: 1 },
    status_vocabulary: "acr",
    versions: ["7.0", "8.0"],
  },
  {
    id: "plan-vivo",
    cdop_name: "Plan Vivo Standard",
    short_code: "PV",
    crediting_program_id: "plan-vivo",
    registry_id: "plan-vivo",
    unit_type_verified: "PVC",
    vintage_period_years: 1,
    verification_schedule: { first_year: 1, interval_years: 1 },
    status_vocabulary: "plan-vivo",
    versions: ["2013", "5.0"],
  },
  {
    id: "puro",
    cdop_name: "Puro Standard",
    short_code: "PURO",
    crediting_program_id: "puro",
    registry_id: "puro",
    unit_type_verified: "CORC",
    vintage_period_years: 1,
    verification_schedule: { first_year: 1, interval_years: 1 },
    status_vocabulary: "puro",
    versions: ["3.0", "4.0"],
  },
];

export interface MethodologySeed {
  id: string;
  cdop_name: string;
  code?: string;
  title?: string;
  standard_id: string;
  sector?: string;
  url?: string;
  versions: string[];
}

/** CDOP's methodology enum has no UK code entries; those two names are extensions (CDOP-FB). */
export const METHODOLOGIES: MethodologySeed[] = [
  {
    id: "wcc-carbon-calculator",
    cdop_name: "WCC - Carbon Calculation Spreadsheet",
    code: "WCC",
    title: "Woodland Carbon Code carbon calculation spreadsheet",
    standard_id: "wcc",
    sector: "A02 - Forestry and logging",
    url: "https://woodlandcarboncode.org.uk/standard-and-guidance/3-carbon-sequestration",
    versions: ["2.4", "3.0"],
  },
  {
    id: "pc-emissions-calculator",
    cdop_name: "Peatland Code - Emissions Calculator",
    code: "PC",
    title: "Peatland Code emissions calculator (condition category method)",
    standard_id: "pc",
    sector: "A01 - Crop and animal production, hunting and related service activities",
    url: "https://www.iucn-uk-peatlandprogramme.org/peatland-code",
    versions: ["2.0", "2.1"],
  },
  {
    id: "vcs-vm0033",
    cdop_name: "VCS - VM0033",
    code: "VM0033",
    title: "Methodology for Tidal Wetland and Seagrass Restoration",
    standard_id: "vcs",
    sector: "A02 - Forestry and logging",
    url: "https://verra.org/methodologies/vm0033-methodology-for-tidal-wetland-and-seagrass-restoration-v2-1/",
    versions: ["2.0", "2.1"],
  },
  {
    id: "vcs-vm0047",
    cdop_name: "VCS - VM0047",
    code: "VM0047",
    title: "Afforestation, Reforestation and Revegetation",
    standard_id: "vcs",
    sector: "A02 - Forestry and logging",
    url: "https://verra.org/methodologies/vm0047-afforestation-reforestation-and-revegetation-v1-0/",
    versions: ["1.0", "1.1"],
  },
  {
    id: "vcs-vm0048",
    cdop_name: "VCS - VM0048",
    code: "VM0048",
    title: "Reducing Emissions from Deforestation and Forest Degradation",
    standard_id: "vcs",
    sector: "A02 - Forestry and logging",
    url: "https://verra.org/methodologies/vm0048-reducing-emissions-from-deforestation-and-forest-degradation-v1-0/",
    versions: ["1.0", "1.1"],
  },
  {
    id: "vcs-vm0042",
    cdop_name: "VCS - VM0042",
    code: "VM0042",
    title: "Improved Agricultural Land Management",
    standard_id: "vcs",
    sector: "A01 - Crop and animal production, hunting and related service activities",
    url: "https://verra.org/methodologies/vm0042-methodology-for-improved-agricultural-land-management-v2-1/",
    versions: ["2.0", "2.1"],
  },
  {
    id: "gs-ar-am0001",
    cdop_name: "GS - AFFORESTATION/REFORESTATION GHG EMISSIONS REDUCTION & SEQUESTRATION",
    code: "GS-AR",
    title: "A/R GHG Emissions Reduction and Sequestration Methodology",
    standard_id: "gs4gg",
    sector: "A02 - Forestry and logging",
    url: "https://globalgoals.goldstandard.org/",
    versions: ["1.0", "2.0"],
  },
  {
    id: "acr-ifm",
    cdop_name: "ACR - Improved Forest Management (IFM) on Non-Federal U.S. Forestlands",
    code: "ACR-IFM",
    title: "Improved Forest Management on Non-Federal U.S. Forestlands",
    standard_id: "acr",
    sector: "A02 - Forestry and logging",
    url: "https://acrcarbon.org/methodology/improved-forest-management-ifm-on-non-federal-u-s-forestlands/",
    versions: ["1.3", "2.0"],
  },
  {
    id: "plan-vivo-agroforestry",
    cdop_name: "PV - PM001",
    code: "PV-AF",
    title: "Agroforestry and community forestry approved approach",
    standard_id: "plan-vivo",
    sector: "A02 - Forestry and logging",
    url: "https://www.planvivo.org/approved-approaches",
    versions: ["1.0"],
  },
  {
    id: "puro-biochar",
    cdop_name: "PURO - Biochar",
    code: "PURO-BIOCHAR",
    title: "Biochar methodology",
    standard_id: "puro",
    sector: "C20 - Manufacture of chemicals and chemical products",
    url: "https://puro.earth/methodologies/biochar",
    versions: ["2.0", "3.0"],
  },
];

export interface LabelSeed {
  id: string;
  name: string;
  level: "project" | "unit" | "standard";
  issuer?: string;
  url?: string;
  cdop_enum_value?: string;
}

export const LABELS: LabelSeed[] = [
  {
    id: "ccb",
    name: "Climate, Community & Biodiversity (CCB)",
    level: "project",
    issuer: "Verra",
    cdop_enum_value: "CCB",
  },
  {
    id: "sd-vista",
    name: "SD VISta",
    level: "project",
    issuer: "Verra",
    cdop_enum_value: "SD VISta",
  },
  {
    id: "ccp",
    name: "Core Carbon Principles (CCP) label",
    level: "unit",
    issuer: "ICVCM",
    cdop_enum_value: "CCP",
  },
  {
    id: "corsia-p1",
    name: "CORSIA First Phase eligible (2024-2026)",
    level: "unit",
    issuer: "ICAO",
    cdop_enum_value: "CORSIA First Phase approved (2024-2026)",
  },
  {
    id: "corsia-p2a",
    name: "CORSIA Second Phase eligible (2027-2029)",
    level: "unit",
    issuer: "ICAO",
    cdop_enum_value: "CORSIA Second Phase approved (2027-2029)",
  },
  {
    id: "icvcm",
    name: "ICVCM CCP-approved program",
    level: "standard",
    issuer: "ICVCM",
    cdop_enum_value: "ICVCM",
  },
  // Not a CDOP value: the compliance enums list schemes that accept credits today, and UK ETS does not yet.
  {
    id: "uk-ets-eligible",
    name: "UK ETS eligible (under consultation)",
    level: "project",
    issuer: "UK Government",
  },
];

export interface DocumentTypeSeed {
  id: string;
  standard_id?: string;
  native_id?: string;
  name: string;
  cdop_type?: string;
  kind:
    | "pdd"
    | "map"
    | "carbon_calc"
    | "validation_report"
    | "validation_statement"
    | "verification_report"
    | "verification_statement"
    | "monitoring_report"
    | "registration"
    | "legal"
    | "photos"
    | "risk"
    | "baseline"
    | "plan"
    | "shapefile"
    | "other";
  stage: "registration" | "validation" | "verification" | "issuance" | "any";
}

const wcc = (
  native_id: string,
  name: string,
  kind: DocumentTypeSeed["kind"],
  stage: DocumentTypeSeed["stage"],
  cdop_type?: string,
): DocumentTypeSeed => {
  const d: DocumentTypeSeed = {
    id: `wcc:${native_id}`,
    standard_id: "wcc",
    native_id,
    name,
    kind,
    stage,
  };
  if (cdop_type) d.cdop_type = cdop_type;
  return d;
};
const pc = (
  native_id: string,
  name: string,
  kind: DocumentTypeSeed["kind"],
  stage: DocumentTypeSeed["stage"],
  cdop_type?: string,
): DocumentTypeSeed => {
  const d: DocumentTypeSeed = {
    id: `pc:${native_id}`,
    standard_id: "pc",
    native_id,
    name,
    kind,
    stage,
  };
  if (cdop_type) d.cdop_type = cdop_type;
  return d;
};
const generic = (
  id: string,
  name: string,
  kind: DocumentTypeSeed["kind"],
  stage: DocumentTypeSeed["stage"],
  cdop_type?: string,
): DocumentTypeSeed => {
  const d: DocumentTypeSeed = { id: `generic:${id}`, name, kind, stage };
  if (cdop_type) d.cdop_type = cdop_type;
  return d;
};

/** Registry document-type catalogues for WCC and PC (native ids as published by the UK Land Carbon Registry). */
export const DOCUMENT_TYPES: DocumentTypeSeed[] = [
  wcc("100000000000099", "Project Design Document", "pdd", "registration"),
  wcc("100000000000371", "Map of Site", "map", "registration"),
  wcc("100000000000372", "Carbon Calculations", "carbon_calc", "registration"),
  wcc("100000000000506", "Contact Details", "registration", "registration"),
  wcc("100000000000005", "Proof of Right", "legal", "registration"),
  wcc("100000000000505", "Commitment Statement", "legal", "registration"),
  wcc("100000000000004", "Communications Agreement", "legal", "registration"),
  wcc("103000000000198", "Additionality", "other", "validation"),
  wcc("100000000000355", "Photos (aerial and on-the-ground)", "photos", "validation"),
  wcc("100000000000507", "Woodland Benefits Tool", "other", "validation"),
  wcc("100000000000370", "Validation Statement", "validation_statement", "validation"),
  wcc("100000000000374", "Verification Statement", "verification_statement", "verification"),
  wcc(
    "300000000000001",
    "Project Progress Report",
    "monitoring_report",
    "verification",
    "project monitoring report",
  ),
  wcc(
    "103000000000410",
    "Biodiversity Monitoring Report",
    "monitoring_report",
    "verification",
    "project monitoring report",
  ),
  wcc("103000000000409", "Remedial Plan", "plan", "any", "loss event report"),
  wcc("100000000000375", "Certification to another standard", "other", "any"),
  wcc("300000000000002", "Group Agreement", "legal", "registration"),
  wcc("651000000000001", "Discontinued Project Form", "other", "any"),
  wcc("100000000000098", "Other", "other", "any"),
  pc("100000000000099", "Project Design Document", "pdd", "registration"),
  pc("100000000000371", "Map of Site", "map", "registration"),
  pc("100000000000372", "Carbon Calculations", "carbon_calc", "registration"),
  pc("100000000000518", "Project Area Shapefiles", "shapefile", "registration"),
  pc("100000000000011", "Proof of Ownership", "legal", "validation"),
  pc("100000000000505", "Commitment Statement", "legal", "validation"),
  pc("103000000000198", "Additionality", "other", "validation"),
  pc(
    "100000000000511",
    "Management & Monitoring Plan",
    "plan",
    "validation",
    "project monitoring plan",
  ),
  pc("100000000000510", "Risk Assessment", "risk", "validation", "non-permanence risk assessment"),
  pc("100000000000512", "Peat Depth", "baseline", "validation"),
  pc("100000000000513", "Water Table Information", "baseline", "validation"),
  pc("100000000000423", "Baseline - Supporting Documents", "baseline", "validation"),
  pc("100000000000509", "Proof of Other Income", "legal", "validation"),
  pc("100000000000514", "Public Funding Confirmation", "legal", "validation"),
  pc("100000000000355", "Photos (aerial and on-the-ground)", "photos", "validation"),
  pc("3100011", "Validation Statement", "validation_statement", "validation"),
  pc("3100012", "Restoration Validation Statement", "validation_statement", "validation"),
  pc("100000000000010", "Verification Statement", "verification_statement", "verification"),
  pc(
    "300000000000001",
    "Project Progress Report",
    "monitoring_report",
    "verification",
    "project monitoring report",
  ),
  pc("100000000000098", "Other", "other", "any"),
  generic("pdd", "Project Description Document", "pdd", "registration"),
  generic("validation-report", "Validation Report", "validation_report", "validation"),
  generic(
    "validation-opinion",
    "Validation Opinion / Statement",
    "validation_statement",
    "validation",
  ),
  generic(
    "monitoring-report",
    "Monitoring Report",
    "monitoring_report",
    "verification",
    "project monitoring report",
  ),
  generic("verification-report", "Verification Report", "verification_report", "verification"),
  generic(
    "verification-statement",
    "Verification Statement",
    "verification_statement",
    "verification",
  ),
  generic("monitoring-plan", "Monitoring Plan", "plan", "registration", "project monitoring plan"),
  generic(
    "nonpermanence-risk-report",
    "Non-Permanence Risk Report",
    "risk",
    "validation",
    "non-permanence risk assessment",
  ),
  generic("ccb-report", "CCB Project Description", "other", "validation"),
  generic(
    "consultation-record",
    "Stakeholder Consultation Record",
    "other",
    "registration",
    "consultation record",
  ),
  generic("loss-event-report", "Loss Event Report", "other", "any", "loss event report"),
  generic(
    "cancellation-certificate",
    "Voluntary Cancellation Certificate",
    "other",
    "issuance",
    "voluntary cancellation certification",
  ),
  generic("retirement-certificate", "Retirement Certificate", "other", "issuance"),
  generic("gis-boundary", "Project Boundary (GeoJSON)", "map", "registration"),
];

/** UN M49 region codes and names used by CDOP's location block. */
export const REGIONS: Record<string, { code: string; name: string }> = {
  GBR: { code: "154", name: "Northern Europe" },
  IRL: { code: "154", name: "Northern Europe" },
  FIN: { code: "154", name: "Northern Europe" },
  SWE: { code: "154", name: "Northern Europe" },
  DEU: { code: "155", name: "Western Europe" },
  CHE: { code: "155", name: "Western Europe" },
  USA: { code: "021", name: "Northern America" },
  CAN: { code: "021", name: "Northern America" },
  MEX: { code: "013", name: "Central America" },
  NIC: { code: "013", name: "Central America" },
  BRA: { code: "005", name: "South America" },
  PER: { code: "005", name: "South America" },
  COL: { code: "005", name: "South America" },
  KEN: { code: "014", name: "Eastern Africa" },
  UGA: { code: "014", name: "Eastern Africa" },
  RWA: { code: "014", name: "Eastern Africa" },
  TZA: { code: "014", name: "Eastern Africa" },
  MWI: { code: "014", name: "Eastern Africa" },
  GHA: { code: "011", name: "Western Africa" },
  COD: { code: "017", name: "Middle Africa" },
  IND: { code: "034", name: "Southern Asia" },
  NPL: { code: "034", name: "Southern Asia" },
  IDN: { code: "035", name: "South-eastern Asia" },
  KHM: { code: "035", name: "South-eastern Asia" },
  VNM: { code: "035", name: "South-eastern Asia" },
  FJI: { code: "054", name: "Melanesia" },
};

export const COUNTRY_NAMES: Record<string, string> = {
  GBR: "United Kingdom of Great Britain and Northern Ireland (the)",
  IRL: "Ireland",
  FIN: "Finland",
  SWE: "Sweden",
  DEU: "Germany",
  CHE: "Switzerland",
  USA: "United States of America (the)",
  CAN: "Canada",
  MEX: "Mexico",
  NIC: "Nicaragua",
  BRA: "Brazil",
  PER: "Peru",
  COL: "Colombia",
  KEN: "Kenya",
  UGA: "Uganda",
  RWA: "Rwanda",
  TZA: "Tanzania, the United Republic of",
  MWI: "Malawi",
  GHA: "Ghana",
  COD: "Congo (the Democratic Republic of the)",
  IND: "India",
  NPL: "Nepal",
  IDN: "Indonesia",
  KHM: "Cambodia",
  VNM: "Viet Nam",
  FJI: "Fiji",
};

export const SDG_NAMES: Record<number, string> = {
  1: "SDG 1: No Poverty",
  2: "SDG 2: Zero Hunger",
  3: "SDG 3: Good Health and Well-being",
  4: "SDG 4: Quality Education",
  5: "SDG 5: Gender Equality",
  6: "SDG 6: Clean Water and Sanitation",
  7: "SDG 7: Affordable and Clean Energy",
  8: "SDG 8: Decent Work and Economic Growth",
  9: "SDG 9: Industry, Innovation and Infrastructure",
  10: "SDG 10: Reduced Inequalities",
  11: "SDG 11: Sustainable Cities and Communities",
  12: "SDG 12: Responsible Consumption and Production",
  13: "SDG 13: Climate Action",
  14: "SDG 14: Life Below Water",
  15: "SDG 15: Life on Land",
  16: "SDG 16: Peace, Justice and Strong Institutions",
  17: "SDG 17: Partnerships for the Goals",
};
