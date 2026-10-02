/**
 * API key CLI.
 *   pnpm keys:new                                                  a fresh token for ADMIN_API_KEY
 *   pnpm keys:new --role <role> --label <text> [--account <id>]   store a key and print its token
 * The token goes to stdout and everything else to stderr, so the output can be piped. Only the
 * token's sha256 is stored, so a stored key's token is shown once and cannot be recovered.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Database } from "./kysely.js";
import { createDb, createPool } from "./kysely.js";
import { newId } from "../domain/ids.js";
import { newApiKey } from "../http/auth.js";
import type { Role } from "../http/context.js";

/** Roles a stored key can carry (the api_key.role check constraint); "public" is the anonymous caller. */
export const KEY_ROLES = [
  "developer",
  "vvb",
  "code_admin",
  "registry",
  "admin",
  "sandbox",
] as const satisfies readonly Role[];
export type KeyRole = (typeof KEY_ROLES)[number];

export function isKeyRole(value: string): value is KeyRole {
  return (KEY_ROLES as readonly string[]).includes(value);
}

export interface CreateKeyOptions {
  role: KeyRole;
  label: string;
  accountId?: string | undefined;
}

/** Stores a new key (hash only) and returns its id and token. */
export async function createApiKey(
  db: Database,
  opts: CreateKeyOptions,
): Promise<{ id: string; token: string }> {
  const { token, hash } = newApiKey();
  const id = newId("key");
  await db
    .insertInto("api_key")
    .values({
      id,
      key_hash: hash,
      role: opts.role,
      label: opts.label,
      account_id: opts.accountId ?? null,
    })
    .execute();
  return { id, token };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const role = flag("--role");
  const label = flag("--label");
  if (role === undefined) {
    // The bootstrap admin key is compared with ADMIN_API_KEY directly and never stored.
    console.error("bootstrap admin key for ADMIN_API_KEY (not stored):");
    console.log(newApiKey().token);
    process.exit(0);
  }
  if (!isKeyRole(role) || !label) {
    console.error(
      `usage: pnpm keys:new [--role <${KEY_ROLES.join("|")}> --label <text> [--account <id>]]`,
    );
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const pool = createPool(url, 1);
  createApiKey(createDb(pool), { role, label, accountId: flag("--account") })
    .then(async ({ id, token }) => {
      console.error(`stored ${role} key ${id} ("${label}"); the token is shown once:`);
      console.log(token);
      await pool.end();
    })
    .catch(async (err: unknown) => {
      console.error((err as Error).message);
      await pool.end();
      process.exit(1);
    });
}
