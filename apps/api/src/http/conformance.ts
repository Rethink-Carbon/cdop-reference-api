/**
 * Ties a CDOP document's validation errors back to SCHEMA-FEEDBACK.md. A document this API
 * produces may only fail validation for a reason the register records; an error no entry
 * explains is a bug here, and the conformance tests fail on it.
 */
import type { ValidationError, ValidationResult } from "@cdop/schemas";

interface Rule {
  ref: string;
  explains: (e: ValidationError, missing: ReadonlySet<string>) => boolean;
}

/** Dotted path of the property a `required` error names, e.g. `project.compliance_market_id`. */
function missingPath(e: ValidationError): string | undefined {
  const property = e.params.missingProperty;
  if (e.keyword !== "required" || typeof property !== "string") return undefined;
  const parent = e.instancePath.replace(/^\//, "").replace(/\/\d+/g, "").replace(/\//g, ".");
  return parent ? `${parent}.${property}` : property;
}

const RULES: readonly Rule[] = [
  // A label is an accreditation or a compliance eligibility; the schema requires both halves.
  { ref: "CDOP-FB-029", explains: (e) => e.instancePath.startsWith("/unit/unit_level") },
  // Required with minItems 1 although "if applicable".
  {
    ref: "CDOP-FB-020",
    explains: (e) =>
      e.instancePath === "/project/compliance_market_id" ||
      missingPath(e) === "project.compliance_market_id",
  },
  // The UK codes are missing from the crediting program and methodology enums.
  {
    ref: "CDOP-FB-028",
    explains: (e) =>
      e.keyword === "enum" &&
      (/^\/crediting_program\/crediting_program\/\d+\/crediting_program_name$/.test(
        e.instancePath,
      ) ||
        /^\/methodology\/versions\/\d+\/methodology$/.test(e.instancePath)),
  },
  // Mechanically derived `required`: only for what the projection itself reported as unpublished.
  {
    ref: "CDOP-FB-005",
    explains: (e, missing) => {
      const path = missingPath(e);
      return path !== undefined && (missing.has(path) || missing.has(path.split(".")[0] as string));
    },
  },
];

export interface Conformance {
  valid: boolean;
  /** Register entries that explain the errors, in register order. */
  refs: string[];
  /** Errors no register entry explains. Always empty unless there is a bug in the projection. */
  unexplained: ValidationError[];
}

export function explainConformance(
  validation: ValidationResult,
  missing: readonly string[],
): Conformance {
  const refs = new Set<string>();
  const unexplained: ValidationError[] = [];
  const missingSet = new Set(missing);
  for (const e of validation.errors) {
    const rule = RULES.find((r) => r.explains(e, missingSet));
    if (rule) refs.add(rule.ref);
    else unexplained.push(e);
  }
  return { valid: validation.valid, refs: [...refs].sort(), unexplained };
}

/** `valid`, or `invalid; errors=3; missing=agreement; ref=CDOP-FB-005,CDOP-FB-020; placeholders=unit`. */
export function conformanceHeader(
  validation: ValidationResult,
  result: { missing: readonly string[]; placeholders: readonly string[] },
): string {
  const placeholders = result.placeholders.length
    ? `; placeholders=${result.placeholders.join(",")}`
    : "";
  if (validation.valid) return `valid${placeholders}`;
  const { refs, unexplained } = explainConformance(validation, result.missing);
  const missing = result.missing.length ? `; missing=${result.missing.join(",")}` : "";
  const ref = refs.length ? `; ref=${refs.join(",")}` : "";
  return `invalid; errors=${validation.errors.length}${missing}${ref}${unexplained.length ? `; unexplained=${unexplained.length}` : ""}${placeholders}`;
}
