import type { Logger } from "pino";
import type { Env } from "../env.js";
import type { Database } from "../db/kysely.js";
import { Linker } from "./hal.js";
import type { ProjectionContext } from "../domain/projection/context.js";
import { contextFromMaps } from "../domain/projection/context.js";
import type { OrgLite } from "../domain/projection/context.js";

export type Role = "public" | "developer" | "vvb" | "code_admin" | "registry" | "admin" | "sandbox";

export interface Caller {
  role: Role;
  apiKeyId?: string;
  label?: string;
  accountId?: string;
}

export interface AppDeps {
  env: Env;
  db: Database;
  log: Logger;
  linker: Linker;
  schemaVersion: string;
  apiVersion: string;
  startedAt: Date;
}

export function createLinker(env: Env): Linker {
  return new Linker(env.PUBLIC_BASE_URL.replace(/\/$/, ""));
}

/** Projection context backed by the database (organisations/accounts referenced by a set of projects). */
export async function projectionContextFor(
  deps: AppDeps,
  orgIds: string[],
  accountIds: string[],
): Promise<ProjectionContext> {
  const orgs = new Map<string, OrgLite>();
  const accounts = new Map<string, { id: string; name: string }>();
  const uniqOrgs = [...new Set(orgIds.filter(Boolean))];
  const uniqAccounts = [...new Set(accountIds.filter(Boolean))];
  if (uniqOrgs.length) {
    const rows = await deps.db
      .selectFrom("organisation")
      .selectAll()
      .where("id", "in", uniqOrgs)
      .execute();
    for (const r of rows) {
      orgs.set(r.id, {
        id: r.id,
        legal_name: r.legal_name,
        website: r.website ?? undefined,
        email: r.email ?? undefined,
        phone: r.phone ?? undefined,
        cdop_role: r.cdop_role ?? undefined,
        classification: r.classification ?? undefined,
        country_code: r.country_code,
        country_name: r.country_name ?? undefined,
        region_code: r.region_code ?? undefined,
        region_name: r.region_name ?? undefined,
        subdivision_code: r.subdivision_code ?? undefined,
        subdivision_name: r.subdivision_name ?? undefined,
        city: r.city ?? undefined,
        postal_code: r.postal_code ?? undefined,
        address_line_1: r.address_line_1 ?? undefined,
        founded_on: r.founded_on ? new Date(r.founded_on) : undefined,
        employees: r.employees ?? undefined,
        project_employees: r.project_employees ?? undefined,
        mission: r.mission ?? undefined,
        team_experience: r.team_experience ?? undefined,
        project_experience_years: r.project_experience_years ?? undefined,
      });
    }
  }
  if (uniqAccounts.length) {
    const rows = await deps.db
      .selectFrom("account")
      .select(["id", "name"])
      .where("id", "in", uniqAccounts)
      .execute();
    for (const r of rows) accounts.set(r.id, { id: r.id, name: r.name });
  }
  return contextFromMaps({ baseUrl: deps.linker.baseUrl, orgs, accounts });
}
