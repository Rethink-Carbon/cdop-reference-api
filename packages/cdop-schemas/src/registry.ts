import { POD_NAMES, loadSchema } from "./index.js";
import type { FieldRecord, JsonSchema, PodName } from "./types.js";

function typeOf(node: JsonSchema): string {
  if (Array.isArray(node.type)) return node.type.join("|");
  if (node.type) return node.type;
  if (node.anyOf) return node.anyOf.map((n) => typeOf(n)).join("|");
  return "unknown";
}

function walk(
  node: JsonSchema,
  prefix: string,
  entity: string,
  requiredHere: Set<string>,
  pod: PodName,
  out: Map<string, FieldRecord>,
): void {
  const props = node.properties ?? {};
  for (const [key, child] of Object.entries(props)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const isArrayOfObjects = child.type === "array" && child.items?.type === "object";
    const isObject = child.type === "object" && !!child.properties;
    const leaf = child.type === "array" && child.items ? child.items : child;
    const enumSource = child.enum ?? (child.type === "array" ? child.items?.enum : undefined);
    const existing = out.get(path);
    if (existing) {
      if (!existing.pods.includes(pod)) existing.pods.push(pod);
    } else {
      const record: FieldRecord = {
        path,
        entity,
        key,
        type: child.type === "array" ? `array<${typeOf(leaf)}>` : typeOf(child),
        required: requiredHere.has(key),
        pods: [pod],
      };
      const fmt = child.format ?? leaf.format;
      if (fmt) record.format = fmt;
      if (enumSource) record.enum = enumSource.map((v) => String(v));
      const fieldId = child["x-cdop-field-id"];
      if (fieldId !== undefined) record.fieldId = Number(fieldId);
      if (child["x-cdop-field-path"]) record.fieldPath = child["x-cdop-field-path"];
      if (child["x-cdop-cardinality"]) record.cardinality = child["x-cdop-cardinality"];
      if (child["x-cdop-mutability"]) record.mutability = child["x-cdop-mutability"];
      if (child["x-cdop-public-private"]) record.publicPrivate = child["x-cdop-public-private"];
      if (child["x-cdop-data-source"]) record.dataSource = child["x-cdop-data-source"];
      if (child["x-cdop-pre-issuance-inclusion"])
        record.preIssuanceInclusion = child["x-cdop-pre-issuance-inclusion"];
      if (child.description) record.description = child.description;
      out.set(path, record);
    }
    if (isObject) walk(child, path, entity, new Set(child.required ?? []), pod, out);
    else if (isArrayOfObjects && child.items)
      walk(child.items, `${path}[]`, entity, new Set(child.items.required ?? []), pod, out);
  }
}

let registryCache: FieldRecord[] | undefined;

/** Every property path across every pod, de-duplicated, with CDOP annotations. */
export function buildFieldRegistry(): FieldRecord[] {
  if (registryCache) return registryCache;
  const out = new Map<string, FieldRecord>();
  for (const pod of POD_NAMES) {
    const schema = loadSchema(pod);
    for (const [entity, node] of Object.entries(schema.properties ?? {})) {
      const path = entity;
      if (!out.has(path)) {
        out.set(path, {
          path,
          entity,
          key: entity,
          type: typeOf(node),
          required: (schema.required ?? []).includes(entity),
          pods: [pod],
        });
      } else {
        const rec = out.get(path);
        if (rec && !rec.pods.includes(pod)) rec.pods.push(pod);
      }
      walk(node, entity, entity, new Set(node.required ?? []), pod, out);
    }
  }
  registryCache = [...out.values()].sort((a, b) => a.path.localeCompare(b.path));
  return registryCache;
}

export function fieldsOf(entity: string): FieldRecord[] {
  return buildFieldRegistry().filter((f) => f.entity === entity);
}

/** Enum values for a dotted path (accepts `a.b[].c` or `a.b.c`). */
export function enumValues(path: string): string[] | undefined {
  const normalised = path.replace(/\[\]/g, "");
  const hit = buildFieldRegistry().find(
    (f) => f.path.replace(/\[\]/g, "") === normalised && f.enum,
  );
  return hit?.enum;
}

/** All enum-bearing fields: path → values. */
export function listEnums(): Array<{
  path: string;
  entity: string;
  values: string[];
  fieldId?: number;
}> {
  return buildFieldRegistry()
    .filter((f) => f.enum && f.enum.length > 0)
    .map((f) => {
      const item: { path: string; entity: string; values: string[]; fieldId?: number } = {
        path: f.path,
        entity: f.entity,
        values: f.enum as string[],
      };
      if (f.fieldId !== undefined) item.fieldId = f.fieldId;
      return item;
    });
}
