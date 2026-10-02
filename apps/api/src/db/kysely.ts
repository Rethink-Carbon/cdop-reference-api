import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import type { DB } from "./types.generated.js";

const { Pool, types } = pg;
// numeric/bigint come back as strings by default; parse them as numbers (values here are well within 2^53).
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

export type Database = Kysely<DB>;

export function createPool(connectionString: string, max = 10): pg.Pool {
  return new Pool({ connectionString, max, application_name: "cdop-reference-api" });
}

export function createDb(pool: pg.Pool): Database {
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

/** Run `fn` inside a transaction with the row-event trigger suppressed (API/seed/simulator emit their own events). */
export async function withSuppressedRowEvents<T>(
  db: Database,
  fn: (trx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('cdop.suppress_row_events', 'on', true)`.execute(trx);
    return fn(trx);
  });
}

export { sql };
