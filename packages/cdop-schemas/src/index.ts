import { readFileSync } from "node:fs";
import type { JsonSchema, PodName, UpstreamPin } from "./types.js";

export type { JsonSchema, PodName, FieldRecord, UpstreamPin } from "./types.js";
export { buildFieldRegistry, fieldsOf, enumValues, listEnums } from "./registry.js";
export {
  validatePayload,
  getValidator,
  type ValidationResult,
  type ValidationError,
} from "./validator.js";
export { lintSchemas, type LintFinding } from "./lint.js";

export const SCHEMA_FILES: Record<PodName, string> = {
  "full-list": "Full_List.schema.json",
  "location-details": "Location_Details.schema.json",
  "project-approach-details": "Project_Approach_Details.schema.json",
  disclosures: "Disclosures.schema.json",
  issuances: "Issuances.schema.json",
  "unit-description": "Unit_Description.schema.json",
  "crediting-period": "Crediting_Period.schema.json",
  estimations: "Estimations.schema.json",
  "co-benefits": "Co_Benefits.schema.json",
  "durability-permanence": "Durability_Permanence.schema.json",
  "project-finance": "Project_Finance.schema.json",
  "labels-certifications": "Labels_Certifications.schema.json",
};

export const EXAMPLE_FILES: Partial<Record<PodName, string>> = {
  "full-list": "full_list.json",
  "location-details": "location_details.json",
  "project-approach-details": "project_approach_and_details.json",
  disclosures: "disclosures.json",
  issuances: "issuances.json",
  "unit-description": "unit_description.json",
  "crediting-period": "crediting_period.json",
  estimations: "estimations.json",
  "co-benefits": "co_benefits.json",
  "durability-permanence": "durability_permanence.json",
  "project-finance": "project_finance.json",
};

export const POD_NAMES = Object.keys(SCHEMA_FILES) as PodName[];

/** Human titles as CDOP names them (README headings). */
export const POD_TITLES: Record<PodName, string> = {
  "full-list": "Full List",
  "location-details": "Location Details",
  "project-approach-details": "Project Approach & Details",
  disclosures: "Disclosures",
  issuances: "Issuances",
  "unit-description": "Unit Description",
  "crediting-period": "Crediting Period",
  estimations: "Estimations",
  "co-benefits": "Co-Benefits",
  "durability-permanence": "Durability & Permanence",
  "project-finance": "Project Finance",
  "labels-certifications": "Labels & Certifications",
};

export function isPodName(value: string): value is PodName {
  return Object.prototype.hasOwnProperty.call(SCHEMA_FILES, value);
}

export const packageRoot = new URL("../", import.meta.url);
export const schemasDir = new URL("schemas/v2/", packageRoot);
export const examplesDir = new URL("examples/v2/", packageRoot);

const schemaCache = new Map<PodName, JsonSchema>();

export function loadSchema(pod: PodName): JsonSchema {
  const cached = schemaCache.get(pod);
  if (cached) return cached;
  const raw = readFileSync(new URL(SCHEMA_FILES[pod], schemasDir), "utf8");
  const parsed = JSON.parse(raw) as JsonSchema;
  schemaCache.set(pod, parsed);
  return parsed;
}

export function loadSchemaText(pod: PodName): string {
  return readFileSync(new URL(SCHEMA_FILES[pod], schemasDir), "utf8");
}

export function loadExample(pod: PodName): unknown {
  const file = EXAMPLE_FILES[pod];
  if (!file) throw new Error(`no upstream example for ${pod}`);
  return JSON.parse(readFileSync(new URL(file, examplesDir), "utf8")) as unknown;
}

export function loadUpstream(): UpstreamPin {
  return JSON.parse(readFileSync(new URL("UPSTREAM.json", packageRoot), "utf8")) as UpstreamPin;
}

/** Schema version plus short upstream commit, e.g. "2.0+eff6ca3". */
export function schemaVersionLabel(): string {
  const up = loadUpstream();
  return `${up.schema_version}+${up.commit.slice(0, 7)}`;
}
