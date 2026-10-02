/**
 * Builds apps/api/openapi/openapi.json: the live OpenAPI 3.1 document plus the vendored CDOP
 * schemas merged verbatim into components.schemas as `cdop.v2.<Pod>`.
 *   pnpm openapi:build        write the artefact
 *   pnpm openapi:check        fail if the artefact is stale
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { POD_NAMES, SCHEMA_FILES, loadSchema, schemaVersionLabel } from "@cdop/schemas";
import { createApp } from "../src/app.js";
import { openApiConfig } from "../src/http/openapi.js";
import { loadEnv } from "../src/env.js";
import { createLinker, type AppDeps } from "../src/http/context.js";
import type { DB } from "../src/db/types.generated.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../openapi/openapi.json");
const pkg = JSON.parse(readFileSync(path.resolve(here, "../package.json"), "utf8")) as {
  version: string;
};

const env = loadEnv({
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://unused:unused@localhost:1/unused",
  PUBLIC_BASE_URL: "https://cdop.rethinkcarbon.co.uk",
});
const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({ connectionString: env.DATABASE_URL, max: 1 }),
  }),
});
const deps: AppDeps = {
  env,
  db,
  log: pino({ level: "silent" }),
  linker: createLinker(env),
  schemaVersion: schemaVersionLabel(),
  apiVersion: pkg.version,
  startedAt: new Date(),
};
const app = createApp(deps);
const doc = app.getOpenAPI31Document(openApiConfig(deps)) as {
  components?: { schemas?: Record<string, unknown> };
};
doc.components ??= {};
doc.components.schemas ??= {};
for (const pod of POD_NAMES) {
  const schema = { ...loadSchema(pod) } as Record<string, unknown>;
  delete schema.$schema;
  delete schema.$id;
  doc.components.schemas[`cdop.v2.${SCHEMA_FILES[pod].replace(".schema.json", "")}`] = schema;
}
const text = JSON.stringify(doc, null, 2) + "\n";
if (process.argv.includes("--check")) {
  const current = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (current !== text) {
    console.error("openapi.json is stale — run `pnpm openapi:build` and commit the result");
    process.exit(1);
  }
  console.log("openapi.json is up to date");
} else {
  writeFileSync(out, text);
  console.log(`wrote ${out} (${Object.keys(doc.components.schemas).length} component schemas)`);
}
await db.destroy();
