/** Loose JSON Schema 2020-12 shape sufficient for walking CDOP's generated schemas. */
export interface JsonSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  "x-cdop-field-id"?: number | string;
  "x-cdop-field-path"?: string;
  "x-cdop-cardinality"?: string;
  "x-cdop-mutability"?: string;
  "x-cdop-public-private"?: string;
  "x-cdop-data-source"?: string;
  "x-cdop-pre-issuance-inclusion"?: string;
  "x-cdop-required-optional"?: string;
  [key: string]: unknown;
}

export type PodName =
  | "full-list"
  | "location-details"
  | "project-approach-details"
  | "disclosures"
  | "issuances"
  | "unit-description"
  | "crediting-period"
  | "estimations"
  | "co-benefits"
  | "durability-permanence"
  | "project-finance"
  | "labels-certifications";

export interface FieldRecord {
  /** Dotted path with [] for array items, e.g. `project.status[].project_status` */
  path: string;
  /** Top-level CDOP entity (project, unit, …) */
  entity: string;
  /** Leaf key */
  key: string;
  /** JSON type(s) */
  type: string;
  format?: string;
  enum?: string[];
  /** true when listed in the parent's `required` */
  required: boolean;
  fieldId?: number;
  fieldPath?: string;
  cardinality?: string;
  mutability?: string;
  publicPrivate?: string;
  dataSource?: string;
  preIssuanceInclusion?: string;
  description?: string;
  /** Which pod files declare this path */
  pods: PodName[];
}

export interface UpstreamPin {
  repo: string;
  ref: string;
  commit: string;
  commit_date: string;
  schema_version: string;
  fetched_at: string;
  paths: Record<string, string>;
  files: Record<string, string>;
}
