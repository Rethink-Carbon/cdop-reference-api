// Reproduce the 16 November check against the pinned release and reviewed draft commit.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { ROUND1_PODS, loadExample, loadSchema, validatePayload } from "@cdop/schemas";

const repo = "Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol";
const commit = "f7b21490a199dd492cec79753db9e6915855300b";
async function download(path) {
  const response = await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${path}`);
  if (!response.ok) throw new Error(`${response.status}: ${path}`);
  const text = await response.text();
  return { sha256: createHash("sha256").update(text).digest("hex"), data: JSON.parse(text) };
}
function fields(node, path = "", output = []) {
  if (node["x-cdop-field-id"] !== undefined) output.push({ path, ...node });
  for (const [key, child] of Object.entries(node.properties ?? {}))
    fields(child, path ? `${path}.${key}` : key, output);
  if (node.items) fields(node.items, `${path}[]`, output);
  return output;
}
const reviewed = JSON.parse(
  readFileSync(new URL("../../../docs/reviews/round2-2026-11-13.json", import.meta.url), "utf8"),
);
const schemas = {};
for (const name of ["Registry", "Validation", "Verification"])
  schemas[name] = await download(`json_schema/${name}_Metadata.schema.json`);
const example = await download("examples/validation_metadata.json");
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schemas.Validation.data);
const probe = (data) => {
  const valid = validate(data);
  return { valid, errors: globalThis.structuredClone(validate.errors ?? []) };
};
const planned = globalThis.structuredClone(example.data);
planned.validation.validation_is_planned = true;
delete planned.validation.validation_date;
const published = fields(loadSchema("full-list"));
const wanted = [
  "activity_type",
  "project_financing_stage",
  "validation_id",
  "estimation_id",
  "previous_project_registration_id",
  "owner_account_id",
  "project_risk",
  "type",
  "crediting_program_name",
];
const report = {
  reviewed_on: "2026-11-16",
  published_release: "v2.1.0",
  published_commit: "363b1944f949eb45b5dd5a22aed576621a27678b",
  fast_track_reviewed_commit: commit,
  note: "Review only. The demo still serves fast-track commit 39ac535; the reviewed Registry and Verification schemas match the October 26 Registry and November 6 PAE attachments.",
  published_examples: ROUND1_PODS.map((pod) => ({
    pod,
    ...validatePayload(pod, loadExample(pod)),
  })),
  published_required_sections: loadSchema("full-list").required,
  published_formats: [...new Set(published.map((f) => f.format).filter(Boolean))],
  published_open_fields: published
    .filter((f) => wanted.includes(f.path.split(".").at(-1)))
    .map((f) => ({
      path: f.path,
      type: f.type,
      enum: f.enum,
      format: f.format,
      privacy: f["x-cdop-public-private"],
    })),
  drafts: Object.fromEntries(
    Object.entries(schemas).map(([name, source]) => {
      const rows = fields(source.data);
      return [
        name,
        {
          sha256: source.sha256,
          matches_previous_review: reviewed.sources
            .filter((s) => s.schema_sha256 === source.sha256)
            .map((s) => s.schema),
          field_count: rows.length,
          missing_mutability: rows.filter((f) => !f["x-cdop-mutability"]).map((f) => f.path),
          missing_privacy: rows.filter((f) => !f["x-cdop-public-private"]).map((f) => f.path),
          project_references: rows
            .filter((f) => /project_(id|identifier)$/.test(f.path))
            .map((f) => ({ path: f.path, type: f.type, required: f["x-cdop-cardinality"] })),
        },
      ];
    }),
  ),
  validation_example_sha256: example.sha256,
  validation_example: probe(example.data),
  planned_validation_without_outcome_date: probe(planned),
  validation_required: schemas.Validation.data.properties.validation.required,
  validation_fields: fields(schemas.Validation.data).map((f) => ({
    path: f.path,
    type: f.type,
    enum: f.enum,
    cardinality: f["x-cdop-cardinality"],
    format: f.format,
  })),
};
console.log(JSON.stringify(report, null, 2));
