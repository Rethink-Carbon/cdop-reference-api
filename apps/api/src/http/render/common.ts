import type { Linker, Link } from "../hal.js";
import { POD_NAMES, SCHEMA_FILES } from "@cdop/schemas";

export const iso = (d: Date | string | null | undefined): string | undefined => {
  if (d === null || d === undefined) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
};
export const isoTs = (d: Date | string | null | undefined): string | undefined => {
  if (d === null || d === undefined) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** Drop undefined/null members so responses stay tidy. */
export function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) if (obj[k] === undefined || obj[k] === null) delete obj[k];
  return obj;
}

export function schemaLink(linker: Linker, pod: keyof typeof SCHEMA_FILES): Link {
  return { href: linker.url(`/v2/schemas/${SCHEMA_FILES[pod]}`), type: "application/schema+json" };
}

/** The `cdop:document` named-link array for a project or unit. */
export function documentLinks(
  linker: Linker,
  basePath: string,
  pods: readonly (keyof typeof SCHEMA_FILES)[] = POD_NAMES,
): Link[] {
  return pods.map((pod) => ({
    name: pod,
    href: linker.url(`${basePath}/cdop/${pod}`),
    profile: linker.url(`/v2/schemas/${SCHEMA_FILES[pod]}`),
    type: "application/json",
  }));
}

export const PROJECT_PODS = POD_NAMES.filter((p) => p !== "unit-description");
export const UNIT_PODS = ["unit-description", "full-list"] as const;
