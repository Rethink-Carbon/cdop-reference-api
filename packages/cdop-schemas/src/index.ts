import { readFileSync } from "node:fs";
import type { JsonSchema, PodName, SchemaRound, UpstreamPin } from "./types.js";

export type { JsonSchema, PodName, FieldRecord, SchemaRound, UpstreamPin } from "./types.js";
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
  "registry-metadata": "Registry_Metadata.schema.json",
  "validation-metadata": "Validation_Metadata.schema.json",
  "verification-metadata": "Verification_Metadata.schema.json",
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
  "registry-metadata": "registry_metadata.json",
  "validation-metadata": "validation_metadata.json",
  "verification-metadata": "verification_metadata.json",
};

/** Which round each pod belongs to. Round 2 pods are drafts from an upstream test branch. */
export const POD_ROUND: Record<PodName, SchemaRound> = {
  "full-list": 1,
  "location-details": 1,
  "project-approach-details": 1,
  disclosures: 1,
  issuances: 1,
  "unit-description": 1,
  "crediting-period": 1,
  estimations: 1,
  "co-benefits": 1,
  "durability-permanence": 1,
  "project-finance": 1,
  "labels-certifications": 1,
  "registry-metadata": 2,
  "validation-metadata": 2,
  "verification-metadata": 2,
};

export const POD_NAMES = Object.keys(SCHEMA_FILES) as PodName[];
export const ROUND1_PODS = POD_NAMES.filter((p) => POD_ROUND[p] === 1);
export const ROUND2_PODS = POD_NAMES.filter((p) => POD_ROUND[p] === 2);

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
  "registry-metadata": "Registry Metadata",
  "validation-metadata": "Validation Metadata",
  "verification-metadata": "Verification Metadata",
};

export function isPodName(value: string): value is PodName {
  return Object.prototype.hasOwnProperty.call(SCHEMA_FILES, value);
}

export const packageRoot = new URL("../", import.meta.url);
export const schemasDir = new URL("schemas/v2/", packageRoot);
export const examplesDir = new URL("examples/v2/", packageRoot);
export const round2SchemasDir = new URL("schemas/round2/", packageRoot);
export const round2ExamplesDir = new URL("examples/round2/", packageRoot);

const UPSTREAM_FILES: Record<SchemaRound, string> = {
  1: "UPSTREAM.json",
  2: "UPSTREAM-ROUND2.json",
};

/** Package-relative path of a pod's vendored schema, as keyed in its UPSTREAM file. */
export function vendoredSchemaPath(pod: PodName): string {
  return `${POD_ROUND[pod] === 2 ? "schemas/round2" : "schemas/v2"}/${SCHEMA_FILES[pod]}`;
}

function schemaUrl(pod: PodName): URL {
  return new URL(vendoredSchemaPath(pod), packageRoot);
}

const schemaCache = new Map<PodName, JsonSchema>();

export function loadSchema(pod: PodName): JsonSchema {
  const cached = schemaCache.get(pod);
  if (cached) return cached;
  const parsed = JSON.parse(readFileSync(schemaUrl(pod), "utf8")) as JsonSchema;
  schemaCache.set(pod, parsed);
  return parsed;
}

export function loadSchemaText(pod: PodName): string {
  return readFileSync(schemaUrl(pod), "utf8");
}

export function loadExample(pod: PodName): unknown {
  const file = EXAMPLE_FILES[pod];
  if (!file) throw new Error(`no upstream example for ${pod}`);
  const dir = POD_ROUND[pod] === 2 ? round2ExamplesDir : examplesDir;
  return JSON.parse(readFileSync(new URL(file, dir), "utf8")) as unknown;
}

/** The upstream pin for a round: `main` for round 1, the Round 2 test branch for round 2. */
export function loadUpstream(round: SchemaRound = 1): UpstreamPin {
  return JSON.parse(
    readFileSync(new URL(UPSTREAM_FILES[round], packageRoot), "utf8"),
  ) as UpstreamPin;
}

export function upstreamFileName(round: SchemaRound): string {
  return UPSTREAM_FILES[round];
}

/**
 * Schema version plus short upstream commit: "2.0+eff6ca3" for the published schema, or
 * "round2-draft+39ac535" for a Round 2 pod.
 */
export function schemaVersionLabel(pod?: PodName): string {
  const up = loadUpstream(pod ? POD_ROUND[pod] : 1);
  return `${up.schema_version}+${up.commit.slice(0, 7)}`;
}
