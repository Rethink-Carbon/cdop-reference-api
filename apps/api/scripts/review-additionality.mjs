// Review the four original JSON files from the standard-track draft, without modifying them.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.argv[2];
if (!root)
  throw new Error(
    "Usage: node apps/api/scripts/review-additionality.mjs <original-json-directory>",
  );
const read = (file) => readFileSync(path.join(root, file));
const load = (file) => JSON.parse(read(file));
const hash = (file) => createHash("sha256").update(read(file)).digest("hex");
const compile = (schema) => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
};
const result = (validate, data) => ({
  valid: validate(data),
  errors: globalThis.structuredClone(validate.errors ?? []),
});
function undeclared(schema, data, at = "") {
  if (Array.isArray(data))
    return data.flatMap((v, i) => undeclared(schema.items ?? {}, v, `${at}/${i}`));
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).flatMap(([k, v]) =>
    schema.properties?.[k] ? undeclared(schema.properties[k], v, `${at}/${k}`) : [`${at}/${k}`],
  );
}
function fields(node, out = new Map()) {
  if (node["x-cdop-field-id"] !== undefined)
    out.set(Number(node["x-cdop-field-id"]), node["x-cdop-field-path"]);
  for (const child of Object.values(node.properties ?? {})) fields(child, out);
  if (node.items) fields(node.items, out);
  return out;
}
const schema = load("Additionality.schema.json"),
  validate = compile(schema);
const example = load("additionality.json");
const properties = schema.properties.additionality.properties;
const report = {
  reviewed_on: "2026-11-13",
  source_commit: "daab3d58d7b7b01cc26ca849f652194b111a35eb",
  sources: [
    ["Additionality.schema.json", "additionality.json"],
    ["Full_List.schema.json", "full_list.json"],
  ].map(([s, e]) => ({
    schema: s,
    schema_sha256: hash(s),
    example: e,
    example_sha256: hash(e),
    ...result(compile(load(s)), load(e)),
    undeclared_fields: undeclared(load(s), load(e)),
  })),
  required: schema.properties.additionality.required,
  fields: Object.keys(properties).length,
  private_fields: Object.entries(properties)
    .filter(([, v]) => v["x-cdop-public-private"] === "Private")
    .map(([k]) => k),
  collisions: [],
  probes: {},
};
const current = fields(schema);
for (const file of [
  "v2/Full_List.schema.json",
  "round2/Registry_Metadata.schema.json",
  "round2/Validation_Metadata.schema.json",
  "round2/Verification_Metadata.schema.json",
]) {
  const other = fields(
    JSON.parse(
      readFileSync(
        new URL(`../../../packages/cdop-schemas/schemas/${file}`, import.meta.url),
        "utf8",
      ),
    ),
  );
  report.collisions.push({
    schema: file,
    fields: [...current]
      .filter(([id, p]) => other.has(id) && other.get(id) !== p)
      .map(([id, p]) => ({ id, additionality_path: p, other_path: other.get(id) })),
  });
}
const probe = (name, data) => {
  report.probes[name] = result(validate, data);
};
probe("identifier_only", { additionality: { additionality_project_id: "cdop:demo:one" } });
probe("missing_identifier", { additionality: {} });
probe("empty_identifier", { additionality: { additionality_project_id: "" } });
probe("undeclared_property", {
  additionality: { additionality_project_id: "demo", passes_additionality: true },
});
probe("regulatory_claim_without_evidence", {
  additionality: {
    additionality_project_id: "demo",
    regulatory_additionality_exceeds_legal_requirements: true,
  },
});
probe("benchmark_selected_without_details", {
  additionality: {
    additionality_project_id: "demo",
    financial_additionality_financial_benchmark_approach: true,
  },
});
probe("incorrect_boolean_type", {
  additionality: { additionality_project_id: "demo", common_practice_first_of_kind: "yes" },
});
const withoutPrivate = globalThis.structuredClone(example);
for (const key of report.private_fields) delete withoutPrivate.additionality[key];
probe("without_private_financial_information", withoutPrivate);
console.log(JSON.stringify(report, null, 2));
