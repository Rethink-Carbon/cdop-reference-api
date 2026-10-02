import { POD_NAMES, loadSchema } from "./index.js";
import { buildFieldRegistry } from "./registry.js";
import type { JsonSchema, PodName } from "./types.js";

export interface LintFinding {
  rule: string;
  severity: "error" | "warning" | "info";
  pod: PodName | "all";
  path: string;
  message: string;
}

const KEY_RE = /^[a-z][a-z0-9_]*$/;

function walkKeys(node: JsonSchema, prefix: string, pod: PodName, out: LintFinding[]): void {
  for (const [key, child] of Object.entries(node.properties ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!KEY_RE.test(key)) {
      out.push({
        rule: "key-format",
        severity: "error",
        pod,
        path,
        message: /\s/.test(key)
          ? `property name contains whitespace: ${JSON.stringify(key)}`
          : `property name is not snake_case: ${JSON.stringify(key)}`,
      });
    }
    const stem = key.match(/([a-z]{4,})\1/);
    if (stem) {
      out.push({
        rule: "key-mangled",
        severity: "warning",
        pod,
        path,
        message: `repeated token in key "${key}" (looks mangled)`,
      });
    }
    if (child.type === "object" && child.properties) walkKeys(child, path, pod, out);
    if (child.type === "array" && child.items?.properties)
      walkKeys(child.items, `${path}[]`, pod, out);
  }
}

/** Static checks over the vendored schemas: the lint step the generation pipeline lacks. */
export function lintSchemas(): LintFinding[] {
  const out: LintFinding[] = [];
  for (const pod of POD_NAMES) {
    const schema = loadSchema(pod);
    for (const [entity, node] of Object.entries(schema.properties ?? {}))
      walkKeys(node, entity, pod, out);
    // Top-level required entities that only carry nested requireds (mechanical derivation).
    for (const req of schema.required ?? []) {
      const node = schema.properties?.[req];
      if (!node) continue;
      const directRequired = node.required ?? [];
      if (directRequired.length === 0) {
        out.push({
          rule: "required-derived",
          severity: "warning",
          pod,
          path: req,
          message: `top-level "${req}" is required although it has no directly required field (derived from nested requireds)`,
        });
      }
    }
  }
  const registry = buildFieldRegistry();
  for (const f of registry) {
    const key = f.key;
    if (/(_id|_identifier)$/.test(key) && /integer|number/.test(f.type)) {
      out.push({
        rule: "identifier-integer",
        severity: "warning",
        pod: "all",
        path: f.path,
        message: `identifier "${key}" is typed ${f.type}; identifiers should be strings`,
      });
    }
    if (/(_link|_url|website|_report$|^document$)/.test(key) && f.type === "string" && !f.format) {
      out.push({
        rule: "missing-uri-format",
        severity: "info",
        pod: "all",
        path: f.path,
        message: `"${key}" looks like a link but has no format: uri`,
      });
    }
    if (/(_on$|_date|timestamp|_at$)/.test(key) && f.type === "string" && !f.format) {
      out.push({
        rule: "missing-date-format",
        severity: "info",
        pod: "all",
        path: f.path,
        message: `"${key}" looks like a date but has no format`,
      });
    }
    if (f.required && f.publicPrivate && /private/i.test(f.publicPrivate)) {
      out.push({
        rule: "required-private",
        severity: "warning",
        pod: "all",
        path: f.path,
        message: `"${key}" is required but marked Private, so public documents cannot validate`,
      });
    }
  }
  // Annotation casing consistency.
  for (const attr of [
    "mutability",
    "publicPrivate",
    "dataSource",
    "preIssuanceInclusion",
  ] as const) {
    const seen = new Map<string, Set<string>>();
    for (const f of registry) {
      const v = f[attr];
      if (!v) continue;
      const norm = v.toLowerCase().trim();
      if (!seen.has(norm)) seen.set(norm, new Set());
      seen.get(norm)?.add(v);
    }
    for (const [norm, variants] of seen) {
      if (variants.size > 1) {
        out.push({
          rule: "annotation-casing",
          severity: "info",
          pod: "all",
          path: `x-cdop-${attr}`,
          message: `value "${norm}" spelled ${variants.size} ways: ${[...variants].join(" | ")}`,
        });
      }
    }
  }
  // Enum near-duplicates (case/whitespace-insensitive).
  for (const f of registry) {
    if (!f.enum) continue;
    const seen = new Map<string, string>();
    for (const v of f.enum) {
      const norm = v.toLowerCase().replace(/\s+/g, " ").trim();
      const prior = seen.get(norm);
      if (prior && prior !== v) {
        out.push({
          rule: "enum-near-duplicate",
          severity: "warning",
          pod: "all",
          path: f.path,
          message: `enum values differ only by case/whitespace: "${prior}" vs "${v}"`,
        });
      }
      seen.set(norm, v);
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path) || a.rule.localeCompare(b.rule));
}
