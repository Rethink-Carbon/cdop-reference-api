import type { Dataset, Organisation, Account } from "../../seed/aggregate.js";
import { LABELS, METHODOLOGIES, PROGRAMS, REGISTRIES, STANDARDS } from "../../seed/vocab.js";

export interface OrgLite {
  id: string;
  legal_name: string;
  website?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  cdop_role?: string | undefined;
  classification?: string | undefined;
  country_code: string;
  country_name?: string | undefined;
  region_code?: string | undefined;
  region_name?: string | undefined;
  subdivision_code?: string | undefined;
  subdivision_name?: string | undefined;
  city?: string | undefined;
  postal_code?: string | undefined;
  address_line_1?: string | undefined;
  founded_on?: Date | undefined;
  employees?: number | undefined;
  project_employees?: number | undefined;
  mission?: string | undefined;
  team_experience?: string | undefined;
  project_experience_years?: number | undefined;
}

export interface MethodologyVersionLite {
  id: string;
  methodology_id: string;
  cdop_name: string;
  version: string;
  document_url?: string | undefined;
}

export interface ProjectionContext {
  /** Public origin for links (documents, geo files, registry deep links fallback). */
  baseUrl: string;
  org(id: string | undefined): OrgLite | undefined;
  account(id: string | undefined): { id: string; name: string } | undefined;
  registry(id: string):
    | {
        id: string;
        cdop_name: string;
        url?: string | undefined;
        project_url_template?: string | undefined;
      }
    | undefined;
  program(id: string): { id: string; cdop_name: string } | undefined;
  standard(id: string): { id: string; cdop_name: string; versions: string[] } | undefined;
  methodologyVersion(id: string | undefined): MethodologyVersionLite | undefined;
  standardVersion(id: string | undefined): string | undefined;
  label(id: string):
    | {
        id: string;
        name: string;
        cdop_enum_value?: string | undefined;
        url?: string | undefined;
        level: string;
      }
    | undefined;
}

/** Context backed by the static vocabulary plus an in-memory Dataset (seed fixtures, tests). */
export function contextFromDataset(ds: Dataset, baseUrl: string): ProjectionContext {
  const orgs = new Map(ds.organisations.map((o) => [o.id, o]));
  const accounts = new Map(ds.accounts.map((a) => [a.id, a]));
  return contextFromMaps({ baseUrl, orgs, accounts });
}

export function contextFromMaps(input: {
  baseUrl: string;
  orgs: Map<string, Organisation | OrgLite>;
  accounts: Map<string, Account | { id: string; name: string }>;
}): ProjectionContext {
  const registries = new Map(REGISTRIES.map((r) => [r.id, r]));
  const programs = new Map(PROGRAMS.map((p) => [p.id, p]));
  const standards = new Map(STANDARDS.map((s) => [s.id, s]));
  const labels = new Map(LABELS.map((l) => [l.id, l]));
  const methVersions = new Map<string, MethodologyVersionLite>();
  for (const m of METHODOLOGIES)
    for (const v of m.versions)
      methVersions.set(`${m.id}@${v}`, {
        id: `${m.id}@${v}`,
        methodology_id: m.id,
        cdop_name: m.cdop_name,
        version: v,
        document_url: m.url,
      });
  return {
    baseUrl: input.baseUrl,
    org: (id) => (id ? input.orgs.get(id) : undefined),
    account: (id) => (id ? input.accounts.get(id) : undefined),
    registry: (id) => registries.get(id),
    program: (id) => programs.get(id),
    standard: (id) => standards.get(id),
    methodologyVersion: (id) => (id ? methVersions.get(id) : undefined),
    standardVersion: (id) => (id ? id.split("@")[1] : undefined),
    label: (id) => labels.get(id),
  };
}
