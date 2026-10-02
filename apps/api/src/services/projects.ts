import { sql } from "kysely";
import type { Database } from "../db/kysely.js";
import { loadAggregate, loadAggregates } from "../db/aggregate-loader.js";
import type { ProjectAggregate } from "../seed/aggregate.js";
import { parseId, parseUrn } from "../domain/ids.js";
import { ProblemError, notFound } from "../http/problems.js";
import { encodeCursor, type PageParams } from "../http/pagination.js";

export interface ProjectFilter {
  status?: string[] | undefined;
  lifecycle?: string[] | undefined;
  country_code?: string[] | undefined;
  registry?: string[] | undefined;
  standard?: string[] | undefined;
  crediting_program?: string[] | undefined;
  project_type?: string[] | undefined;
  mitigation_type?: string[] | undefined;
  methodology?: string[] | undefined;
  program_type?: string[] | undefined;
  project_identifier?: string | undefined;
  current_registry_project_id?: string | undefined;
  master_project_id?: string | undefined;
  q?: string | undefined;
  modified_since?: Date | undefined;
  bbox?: [number, number, number, number] | undefined;
}

export interface ProjectIndexRow {
  id: string;
  project_identifier: string;
  name: string;
  registry_id: string;
  standard_id: string;
  crediting_program_id: string;
  native_project_id: string;
  country_code: string;
  country_name: string;
  subdivision_name: string | null;
  lifecycle_state: string;
  native_state_code: string;
  cdop_project_status: string;
  area_ha: number | null;
  estimated_total_mitigation: number | null;
  registered_on: Date | string | null;
  validated_on: Date | string | null;
  modified_at: Date;
  version: number;
  developer_organisation_id: string | null;
  master_project_id: string | null;
  centroid_lat: number | null;
  centroid_lon: number | null;
}

export const PROJECT_SORTS = [
  "modified_at",
  "name",
  "project_registration_date",
  "created_at",
] as const;

export async function listProjects(
  db: Database,
  filter: ProjectFilter,
  page: PageParams,
): Promise<{ items: ProjectIndexRow[]; nextCursor?: string; total: number }> {
  const sortColumn =
    page.sort === "project_registration_date"
      ? "registered_on"
      : page.sort === "name"
        ? "name"
        : page.sort === "created_at"
          ? "created_at"
          : "modified_at";
  let q = db
    .selectFrom("project")
    .select([
      "id",
      "project_identifier",
      "name",
      "registry_id",
      "standard_id",
      "crediting_program_id",
      "native_project_id",
      "country_code",
      "country_name",
      "subdivision_name",
      "lifecycle_state",
      "native_state_code",
      "cdop_project_status",
      "area_ha",
      "estimated_total_mitigation",
      "registered_on",
      "validated_on",
      "modified_at",
      "version",
      "developer_organisation_id",
      "master_project_id",
      "centroid_lat",
      "centroid_lon",
    ]);
  let count = db.selectFrom("project").select((eb) => eb.fn.countAll<number>().as("n"));
  const apply = <Q extends typeof q | typeof count>(qb: Q): Q => {
    let out = qb;
    const inList = (
      col:
        | "cdop_project_status"
        | "lifecycle_state"
        | "country_code"
        | "registry_id"
        | "standard_id"
        | "crediting_program_id"
        | "program_type",
      values?: string[],
    ) => {
      if (values && values.length) out = (out as typeof q).where(col, "in", values) as Q;
    };
    inList("cdop_project_status", filter.status);
    inList("lifecycle_state", filter.lifecycle);
    inList("country_code", filter.country_code);
    inList("registry_id", filter.registry);
    inList("standard_id", filter.standard);
    inList("crediting_program_id", filter.crediting_program);
    inList("program_type", filter.program_type);
    if (filter.project_identifier)
      out = (out as typeof q).where("project_identifier", "=", filter.project_identifier) as Q;
    if (filter.current_registry_project_id)
      out = (out as typeof q).where(
        "native_project_id",
        "=",
        filter.current_registry_project_id,
      ) as Q;
    if (filter.master_project_id)
      out = (out as typeof q).where("master_project_id", "=", filter.master_project_id) as Q;
    if (filter.modified_since)
      out = (out as typeof q).where("modified_at", ">=", filter.modified_since) as Q;
    if (filter.q) {
      const like = `%${filter.q.toLowerCase()}%`;
      out = (out as typeof q).where((eb) =>
        eb.or([
          eb(sql`lower(name)`, "like", like),
          eb(sql`lower(coalesce(description, ''))`, "like", like),
          eb("native_project_id", "=", filter.q as string),
        ]),
      ) as Q;
    }
    if (filter.bbox) {
      const [w, s, e, nn] = filter.bbox;
      out = (out as typeof q)
        .where("centroid_lon", ">=", w)
        .where("centroid_lon", "<=", e)
        .where("centroid_lat", ">=", s)
        .where("centroid_lat", "<=", nn) as Q;
    }
    if (filter.project_type?.length || filter.mitigation_type?.length) {
      out = (out as typeof q).where((eb) =>
        eb.exists(
          eb
            .selectFrom("project_mitigation")
            .select("project_mitigation.id")
            .whereRef("project_mitigation.project_id", "=", "project.id")
            .$if(!!filter.project_type?.length, (qb) =>
              qb.where("project_mitigation.project_type", "in", filter.project_type as string[]),
            )
            .$if(!!filter.mitigation_type?.length, (qb) =>
              qb.where(
                "project_mitigation.mitigation_type",
                "in",
                filter.mitigation_type as string[],
              ),
            ),
        ),
      ) as Q;
    }
    if (filter.methodology?.length) {
      out = (out as typeof q).where((eb) =>
        eb.exists(
          eb
            .selectFrom("methodology_version")
            .innerJoin("methodology", "methodology.id", "methodology_version.methodology_id")
            .select("methodology_version.id")
            .whereRef("methodology_version.id", "=", "project.methodology_version_id")
            .where((e2) =>
              e2.or([
                e2("methodology.cdop_name", "in", filter.methodology as string[]),
                e2("methodology.id", "in", filter.methodology as string[]),
              ]),
            ),
        ),
      ) as Q;
    }
    return out;
  };
  q = apply(q);
  count = apply(count);
  const dir = page.direction;
  if (page.cursor) {
    const { v, id } = page.cursor;
    const cmp = dir === "asc" ? ">" : "<";
    if (sortColumn === "name") {
      q = q.where((eb) =>
        eb.or([
          eb("name", cmp, String(v)),
          eb.and([eb("name", "=", String(v)), eb("id", cmp, id)]),
        ]),
      );
    } else if (sortColumn === "registered_on") {
      const d = new Date(String(v));
      q = q.where((eb) =>
        eb.or([
          eb("registered_on", cmp, d),
          eb.and([eb("registered_on", "=", d), eb("id", cmp, id)]),
        ]),
      );
    } else {
      q = q.where((eb) =>
        eb.or([
          eb(sortColumn, cmp, new Date(String(v))),
          eb.and([eb(sortColumn, "=", new Date(String(v))), eb("id", cmp, id)]),
        ]),
      );
    }
  }
  q = q
    .orderBy(sortColumn, dir)
    .orderBy("id", dir)
    .limit(page.limit + 1);
  const [rows, total] = await Promise.all([q.execute(), count.executeTakeFirst()]);
  const items = rows.slice(0, page.limit) as ProjectIndexRow[];
  const last = items[items.length - 1];
  const result: { items: ProjectIndexRow[]; nextCursor?: string; total: number } = {
    items,
    total: Number(total?.n ?? 0),
  };
  if (rows.length > page.limit && last) {
    const v =
      sortColumn === "name"
        ? last.name
        : sortColumn === "registered_on"
          ? new Date(last.registered_on ?? last.modified_at).toISOString()
          : new Date(
              sortColumn === "created_at"
                ? ((last as unknown as { created_at: Date }).created_at ?? last.modified_at)
                : last.modified_at,
            ).toISOString();
    result.nextCursor = encodeCursor({ v, id: last.id });
  }
  return result;
}

export async function getProjectAggregate(db: Database, id: string): Promise<ProjectAggregate> {
  if (!parseId(id)) throw notFound("Project", id);
  const agg = await loadAggregate(db, id);
  if (!agg) throw notFound("Project", id);
  return agg;
}

export async function getProjectAggregates(
  db: Database,
  ids: string[],
): Promise<ProjectAggregate[]> {
  return loadAggregates(db, ids);
}

/** Resolve a CDOP URN or a native registry id to a project id. */
export async function resolveIdentifier(
  db: Database,
  value: string,
): Promise<{ kind: "project" | "issuance"; id: string }> {
  const urn = parseUrn(value);
  if (urn) {
    if (urn.batch) {
      const iss = await db
        .selectFrom("issuance")
        .select("id")
        .where("batch_identifier", "=", value)
        .executeTakeFirst();
      if (iss) return { kind: "issuance", id: iss.id };
      throw new ProblemError("not-found", `No issuance batch is identified by ${value}`);
    }
    const row = await db
      .selectFrom("project")
      .select("id")
      .where("project_identifier", "=", value)
      .executeTakeFirst();
    if (row) return { kind: "project", id: row.id };
    throw new ProblemError("not-found", `No project is identified by ${value}`);
  }
  const byNative = await db
    .selectFrom("project")
    .select("id")
    .where("native_project_id", "=", value)
    .execute();
  if (byNative.length === 1) return { kind: "project", id: (byNative[0] as { id: string }).id };
  if (byNative.length > 1)
    throw new ProblemError(
      "conflict",
      `Registry id ${value} is used by ${byNative.length} projects on different registries; use the URN form cdop:<registry>:${value}`,
    );
  throw new ProblemError("not-found", `No project is identified by ${value}`);
}
