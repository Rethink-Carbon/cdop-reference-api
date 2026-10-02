import { serve } from "@hono/node-server";
import pino from "pino";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { schemaVersionLabel } from "@cdop/schemas";
import { loadEnv } from "./env.js";
import { createDb, createPool } from "./db/kysely.js";
import { migrate } from "./db/migrate.js";
import { createApp } from "./app.js";
import { createLinker, type AppDeps } from "./http/context.js";
import { seedIfEmpty } from "./seed/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(here, "../package.json"), "utf8")) as {
  version: string;
};

async function main(): Promise<void> {
  const env = loadEnv();
  const log = pino({
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty", options: { colorize: true } } }
      : {}),
  });
  const pool = createPool(env.DATABASE_URL);
  const db = createDb(pool);
  const migrated = await migrate({ connectionString: env.DATABASE_URL, log: (m) => log.info(m) });
  log.info({ applied: migrated.applied.length }, "migrations checked");
  if (env.SEED_ON_START) await seedIfEmpty(db, { seed: env.CDOP_SEED, log: (m) => log.info(m) });
  const deps: AppDeps = {
    env,
    db,
    log,
    linker: createLinker(env),
    schemaVersion: schemaVersionLabel(),
    apiVersion: pkg.version,
    startedAt: new Date(),
  };
  const app = createApp(deps);
  const server = serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" }, (info) => {
    log.info({ port: info.port, baseUrl: env.PUBLIC_BASE_URL }, "CDOP reference API listening");
  });
  const shutdown = () => {
    log.info("shutting down");
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
