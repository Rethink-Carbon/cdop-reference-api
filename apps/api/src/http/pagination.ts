import { sql, type RawBuilder } from "kysely";
import { ProblemError } from "./problems.js";

export interface Cursor {
  /** sort value (ISO timestamp, string or number) */
  v: string | number;
  /** id tiebreak */
  id: string;
}

/**
 * The column a keyset page sorts and resumes on. A cursor carries a timestamp as an ISO string at
 * millisecond precision, and Postgres keeps microseconds: compared with the raw column, the cursor
 * matches neither `=` nor `<` for rows that share its millisecond, and the next page silently skips
 * them (every seeded unit and issuance shares one transaction timestamp, so page 2 came back
 * empty). Timestamp keys therefore sort and compare truncated to the millisecond.
 */
export function sortKey(column: string, timestamp = false): RawBuilder<unknown> {
  return timestamp ? sql`date_trunc('milliseconds', ${sql.ref(column)})` : sql.ref(column);
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value: string | undefined): Cursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") throw new Error("shape");
    const { v, id } = parsed as Record<string, unknown>;
    if ((typeof v !== "string" && typeof v !== "number") || typeof id !== "string")
      throw new Error("shape");
    return { v, id };
  } catch {
    throw new ProblemError(
      "cursor-invalid",
      "The cursor could not be decoded; start again from the first page.",
    );
  }
}

export interface PageParams {
  limit: number;
  cursor: Cursor | undefined;
  sort: string;
  direction: "asc" | "desc";
}

export function parsePage(
  query: Record<string, string | undefined>,
  opts: { defaultLimit?: number; maxLimit?: number; sorts: string[]; defaultSort: string },
): PageParams {
  const defaultLimit = opts.defaultLimit ?? 20;
  const maxLimit = opts.maxLimit ?? 100;
  const rawLimit = query.limit;
  let limit = defaultLimit;
  if (rawLimit !== undefined) {
    const n = Number(rawLimit);
    if (!Number.isInteger(n) || n < 1)
      throw new ProblemError(
        "validation-failed",
        `limit must be an integer between 1 and ${maxLimit}`,
      );
    limit = Math.min(n, maxLimit);
  }
  let sort = opts.defaultSort;
  let direction: "asc" | "desc" = sort.startsWith("-") ? "desc" : "asc";
  sort = sort.replace(/^-/, "");
  if (query.sort) {
    const raw = query.sort;
    const dir: "asc" | "desc" = raw.startsWith("-") ? "desc" : "asc";
    const key = raw.replace(/^-/, "");
    if (!opts.sorts.includes(key)) {
      throw new ProblemError(
        "validation-failed",
        `sort must be one of ${opts.sorts.map((s) => `${s}, -${s}`).join(", ")}`,
      );
    }
    sort = key;
    direction = dir;
  }
  return { limit, cursor: decodeCursor(query.cursor), sort, direction };
}

/** Given one extra row fetched (limit + 1), split into page + next cursor. */
export function slicePage<T>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => Cursor,
): { items: T[]; nextCursor?: string } {
  if (rows.length > limit) {
    const items = rows.slice(0, limit);
    const last = items[items.length - 1] as T;
    return { items, nextCursor: encodeCursor(cursorOf(last)) };
  }
  return { items: rows };
}
