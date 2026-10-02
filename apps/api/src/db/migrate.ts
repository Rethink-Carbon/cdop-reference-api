/**
 * Minimal SQL migration runner: applies supabase/migrations/*.sql in order inside transactions,
 * records checksums in cdop.schema_migrations, refuses to run when the Supabase CLI owns the
 * database (supabase_migrations.schema_migrations exists) to avoid double application.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export interface MigrateOptions {
  connectionString: string;
  migrationsDir?: string;
  log?: (msg: string) => void;
}

export function defaultMigrationsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/db → repo root (dev) or /app (docker, where supabase/ is copied next to dist/)
  const candidates = [
    path.resolve(here, "../../../../supabase/migrations"),
    path.resolve(here, "../../supabase/migrations"),
    path.resolve(process.cwd(), "supabase/migrations"),
  ];
  return candidates[0] as string;
}

async function resolveDir(preferred: string | undefined): Promise<string> {
  const { access } = await import("node:fs/promises");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    preferred,
    path.resolve(here, "../../../../supabase/migrations"),
    path.resolve(here, "../../supabase/migrations"),
    path.resolve(process.cwd(), "supabase/migrations"),
  ].filter((c): c is string => !!c);
  for (const c of candidates) {
    try {
      await access(c);
      return c;
    } catch {
      /* try next */
    }
  }
  throw new Error(`migrations directory not found (tried ${candidates.join(", ")})`);
}

export async function migrate(
  opts: MigrateOptions,
): Promise<{ applied: string[]; skipped: string[] }> {
  const log = opts.log ?? (() => undefined);
  const dir = await resolveDir(opts.migrationsDir);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const client = new pg.Client({ connectionString: opts.connectionString });
  await client.connect();
  const applied: string[] = [];
  const skipped: string[] = [];
  try {
    const cliOwned = await client.query(
      "select 1 from information_schema.tables where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'",
    );
    if (cliOwned.rowCount) {
      throw new Error(
        "This database is managed by the Supabase CLI (supabase_migrations.schema_migrations exists). Use `supabase db push` instead of pnpm db:migrate.",
      );
    }
    await client.query("create schema if not exists cdop");
    await client.query(
      "create table if not exists cdop.schema_migrations (version text primary key, checksum text not null, applied_at timestamptz not null default now())",
    );
    const done = new Map<string, string>(
      (
        await client.query<{ version: string; checksum: string }>(
          "select version, checksum from cdop.schema_migrations",
        )
      ).rows.map((r) => [r.version, r.checksum]),
    );
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const body = await readFile(path.join(dir, file), "utf8");
      const checksum = createHash("sha256").update(body).digest("hex");
      const existing = done.get(version);
      if (existing) {
        if (existing !== checksum) {
          throw new Error(`migration ${file} was modified after being applied (checksum mismatch)`);
        }
        skipped.push(version);
        continue;
      }
      log(`applying ${file}`);
      await client.query("begin");
      try {
        await client.query(body);
        await client.query(
          "insert into cdop.schema_migrations (version, checksum) values ($1, $2)",
          [version, checksum],
        );
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw new Error(`migration ${file} failed: ${(err as Error).message}`, { cause: err });
      }
      applied.push(version);
    }
  } finally {
    await client.end();
  }
  return { applied, skipped };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  migrate({ connectionString: url, log: (m) => console.log(m) })
    .then((r) => {
      console.log(`applied ${r.applied.length}, already applied ${r.skipped.length}`);
    })
    .catch((err: unknown) => {
      console.error((err as Error).message);
      process.exit(1);
    });
}
