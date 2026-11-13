// Run against the original JSON attachments, saved in registry/ and verification/ subfolders.
// Does not publish attachments or contact their sender. Produces hashes and reproducible probes.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.argv[2];
if (!root) throw new Error("Usage: node scripts/review-round2.mjs <attachment-directory>");
const load = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const hash = (file) =>
  createHash("sha256")
    .update(readFileSync(path.join(root, file)))
    .digest("hex");
function validator(schema) {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
}
function result(validate, value) {
  const valid = validate(value);
  return {
    valid,
    errors: (validate.errors ?? []).map(({ instancePath, keyword, message, params }) => ({
      instancePath,
      keyword,
      message,
      params,
    })),
  };
}
function unknownFields(schema, value, at = "") {
  if (Array.isArray(value))
    return value.flatMap((v, i) => unknownFields(schema.items ?? {}, v, `${at}/${i}`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const child = schema.properties?.[k];
    return child ? unknownFields(child, v, `${at}/${k}`) : [`${at}/${k}`];
  });
}
const pairs = [
  ["registry/Registry_Metadata.schema.json", "registry/registry_metadata.json"],
  ["registry/Full_List.schema.json", "registry/full_list.json"],
  ...["VAE", "PAE"].flatMap((v) => [
    [
      `verification/Verification_Metadata.schema ${v}.json`,
      `verification/verification_metadata ${v}.json`,
    ],
    [`verification/Full_List.schema ${v}.json`, `verification/full_list ${v}.json`],
  ]),
];
const report = { reviewed_on: "2026-11-13", sources: [], probes: {} };
for (const [schemaFile, exampleFile] of pairs) {
  const schema = load(schemaFile),
    example = load(exampleFile);
  report.sources.push({
    schema: schemaFile,
    schema_sha256: hash(schemaFile),
    example: exampleFile,
    example_sha256: hash(exampleFile),
    ...result(validator(schema), example),
    unvalidated_fields: unknownFields(schema, example),
  });
}
const regSchema = load(pairs[0][0]),
  regExample = load(pairs[0][1]);
const regValidate = validator(regSchema);
function probe(name, validate, original, change) {
  const payload = globalThis.structuredClone(original);
  change(payload);
  report.probes[name] = result(validate, payload);
}
probe("registry_woodland_program", regValidate, regExample, (d) => {
  d.crediting_program.program_name = "Woodland Carbon Code";
});
probe("registry_without_registration", regValidate, regExample, (d) => {
  delete d.project_registry_history.registrations;
});
probe("registry_two_current_registrations", regValidate, regExample, (d) => {
  const row = globalThis.structuredClone(d.project_registry_history.registrations[0]);
  row.registry_project_identifier = "SECOND";
  row.is_current = true;
  d.project_registry_history.registrations[0].is_current = true;
  d.project_registry_history.registrations.push(row);
});
probe("registry_reversed_dates", regValidate, regExample, (d) => {
  d.project_registry_history.registrations[0].registry_exit_date = "1900-01-01";
});
for (const variant of ["VAE", "PAE"]) {
  const schema = load(`verification/Verification_Metadata.schema ${variant}.json`);
  const example = load(`verification/verification_metadata ${variant}.json`);
  const validate = validator(schema);
  const rows = (d) => (variant === "VAE" ? d.verification : d.project.verification);
  probe(`${variant}_without_digital_credentials`, validate, example, (d) => {
    for (const row of rows(d))
      for (const k of [
        "verification_credential_issuer_id",
        "verification_cryptographic_proof_type",
        "verification_digital_signature_payload",
      ])
        delete row[k];
  });
  probe(`${variant}_pending_without_outcomes`, validate, example, (d) => {
    const row = rows(d)[0];
    row.status = [
      {
        verification_audit_checkpoint_status: "Pending review (Audit currently in progress)",
        is_current: true,
      },
    ];
    for (const k of ["verification_date", "verified_quantity", "verification_report_url"])
      delete row[k];
  });
  probe(`${variant}_negative_quantity`, validate, example, (d) => {
    rows(d)[0].verified_quantity = -1;
  });
  probe(`${variant}_invalid_report_url`, validate, example, (d) => {
    rows(d)[0].verification_report_url = ["not a URL"];
  });
  probe(`${variant}_duplicate_event_id`, validate, example, (d) => {
    rows(d).push(globalThis.structuredClone(rows(d)[0]));
  });
  probe(`${variant}_tCO2`, validate, example, (d) => {
    rows(d)[0].verification_quantity_uom = "tCO2";
  });
}
console.log(JSON.stringify(report, null, 2));
