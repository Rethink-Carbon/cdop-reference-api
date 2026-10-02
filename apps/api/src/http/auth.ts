import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../app-env.js";
import type { AppDeps, Caller, Role } from "./context.js";
import { ProblemError } from "./problems.js";

const TOKEN_RE = /^cdop_([a-z0-9]{8})\.([0-9a-f]{64})$/;

export function hashKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newApiKey(): { token: string; keyId: string; hash: string } {
  const keyId = randomBytes(6)
    .toString("base64url")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toLowerCase()
    .padEnd(8, "0");
  const token = `cdop_${keyId}.${randomBytes(32).toString("hex")}`;
  return { token, keyId, hash: hashKey(token) };
}

/** Resolves the caller from a bearer token (API key table or the bootstrap admin key). Anonymous = public. */
export function callerMiddleware(deps: AppDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header("authorization");
    let caller: Caller = { role: "public" };
    if (header?.toLowerCase().startsWith("bearer ")) {
      const token = header.slice(7).trim();
      const admin = deps.env.ADMIN_API_KEY;
      if (
        admin &&
        token.length === admin.length &&
        timingSafeEqual(Buffer.from(token), Buffer.from(admin))
      ) {
        caller = { role: "admin", label: "bootstrap admin key" };
      } else if (TOKEN_RE.test(token)) {
        const row = await deps.db
          .selectFrom("api_key")
          .select(["id", "role", "label", "account_id", "revoked_at"])
          .where("key_hash", "=", hashKey(token))
          .executeTakeFirst();
        if (!row || row.revoked_at)
          throw new ProblemError("unauthenticated", "The API key is unknown or revoked");
        caller = {
          role: row.role as Role,
          apiKeyId: row.id,
          label: row.label,
          ...(row.account_id ? { accountId: row.account_id } : {}),
        };
        void deps.db
          .updateTable("api_key")
          .set({ last_used_at: new Date() })
          .where("id", "=", row.id)
          .execute()
          .catch(() => undefined);
      } else {
        throw new ProblemError(
          "unauthenticated",
          "Malformed bearer token; expected cdop_<keyid>.<64 hex>",
        );
      }
    }
    c.set("caller", caller);
    await next();
  };
}

export function requireRole(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const caller = c.get("caller");
    if (caller.role === "public")
      throw new ProblemError("unauthenticated", "This action requires an API key");
    if (!roles.includes(caller.role) && caller.role !== "admin")
      throw new ProblemError(
        "role-not-permitted",
        `Role ${caller.role} may not perform this action`,
        { allowed_roles: roles },
      );
    await next();
  };
}
