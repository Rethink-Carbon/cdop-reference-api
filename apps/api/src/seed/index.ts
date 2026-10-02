/**
 * Seed CLI + boot helper.
 *   pnpm seed [--reset] [--seed 2026] [--counts wcc=200,pc=100,...] [--snapshot <dir>] [--dry-run]
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sql } from "kysely";
import type { Database } from "../db/kysely.js";
import { createDb, createPool } from "../db/kysely.js";
import { writeDataset } from "../db/writer.js";
import { backfillEvents } from "./events-backfill.js";
import { generateDataset, DEFAULT_COUNTS, type GenerateOptions } from "./generate.js";
import { checkInvariants } from "./invariants.js";
import { hashKey } from "../http/auth.js";
import { deterministicId } from "../domain/ids.js";

export interface SeedRunOptions {
  seed: string;
  counts?: GenerateOptions["counts"] | undefined;
  reset?: boolean | undefined;
  log?: ((m: string) => void) | undefined;
}

export function parseCounts(value: string | undefined): GenerateOptions["counts"] | undefined {
  if (!value) return undefined;
  const counts: Record<string, number> = {};
  for (const part of value.split(",")) {
    const [k, v] = part.split("=");
    if (!k || v === undefined || Number.isNaN(Number(v)))
      throw new Error(`bad --counts entry "${part}"`);
    counts[k.trim()] = Number(v);
  }
  return counts;
}

export async function runSeed(
  db: Database,
  opts: SeedRunOptions,
): Promise<{ projects: number; events: number }> {
  const log = opts.log ?? (() => undefined);
  const counts = opts.counts ?? DEFAULT_COUNTS;
  log(`generating dataset (seed ${opts.seed}, counts ${JSON.stringify(counts)})`);
  const ds = generateDataset({ seed: opts.seed, counts });
  const violations = checkInvariants(ds);
  if (violations.length)
    throw new Error(
      `generated dataset violates invariants:\n${violations.slice(0, 20).join("\n")}`,
    );
  await writeDataset(db, ds, { reset: opts.reset ?? false, log });
  const events = await backfillEvents(db, ds, { log });
  await ensureDemoKeys(db, opts.seed, log);
  log(`seeded ${ds.projects.length} projects, ${ds.accounts.length} accounts, ${events} events`);
  return { projects: ds.projects.length, events };
}

/** Deterministic demo API keys (printed once; hashes stored). */
async function ensureDemoKeys(db: Database, seed: string, log: (m: string) => void): Promise<void> {
  const roles = ["developer", "vvb", "code_admin", "registry", "sandbox"] as const;
  for (const role of roles) {
    const id = deterministicId("key", `${seed}:${role}`);
    const token = `cdop_${role.replace(/_/g, "").slice(0, 8).padEnd(8, "x")}.${Buffer.from(
      deterministicId("key", `${seed}:${role}:secret`) +
        deterministicId("key", `${seed}:${role}:secret2`),
    )
      .toString("hex")
      .slice(0, 64)}`;
    await db
      .insertInto("api_key")
      .values({ id, key_hash: hashKey(token), role, label: `demo ${role} key (seed ${seed})` })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          key_hash: hashKey(token),
          role,
          label: `demo ${role} key (seed ${seed})`,
          revoked_at: null,
        }),
      )
      .execute();
    log(`demo API key [${role}]: ${token}`);
  }
}

export async function seedIfEmpty(db: Database, opts: SeedRunOptions): Promise<void> {
  const row = await sql<{ n: number }>`select count(*)::int as n from cdop.project`.execute(db);
  if ((row.rows[0]?.n ?? 0) > 0) return;
  (opts.log ?? (() => undefined))("database is empty; seeding the demo dataset");
  await runSeed(db, { ...opts, reset: false });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const seed = flag("--seed") ?? process.env.CDOP_SEED ?? "2026";
  const counts = parseCounts(flag("--counts"));
  if (args.includes("--dry-run")) {
    const ds = generateDataset({ seed, counts: counts ?? DEFAULT_COUNTS });
    const violations = checkInvariants(ds);
    console.log(
      JSON.stringify(
        {
          projects: ds.projects.length,
          organisations: ds.organisations.length,
          accounts: ds.accounts.length,
          blocks: ds.projects.reduce((s, p) => s + p.blocks.length, 0),
          violations,
        },
        null,
        2,
      ),
    );
    process.exit(violations.length ? 1 : 0);
  }
  const pool = createPool(url, 4);
  const db = createDb(pool);
  runSeed(db, {
    seed,
    counts,
    reset: args.includes("--reset") || !args.includes("--upsert"),
    log: (m) => console.log(m),
  })
    .then(async () => {
      await pool.end();
    })
    .catch(async (err: unknown) => {
      console.error((err as Error).message);
      await pool.end();
      process.exit(1);
    });
}
