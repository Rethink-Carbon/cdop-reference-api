import { z } from "zod";

const boolish = z
  .union([z.boolean(), z.string()])
  .transform((v) =>
    typeof v === "boolean" ? v : ["1", "true", "yes", "on"].includes(v.toLowerCase()),
  );

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_LISTEN_URL: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SEED_ON_START: boolish.default(false),
  CDOP_SEED: z.string().default("2026"),
  ADMIN_API_KEY: z.string().optional(),
  AFFORDANCES_FOR_ANONYMOUS: z.enum(["all", "none"]).default("all"),
  CORS_ORIGINS: z.string().default("*"),
  RATE_LIMIT_ANON_RPM: z.coerce.number().int().min(1).default(120),
  SIM_ENABLED: boolish.default(false),
  SIM_TICK_SECONDS: z.coerce.number().int().min(5).default(60),
  SIM_ACTIONS_PER_TICK: z.coerce.number().int().min(1).default(3),
  WEBHOOK_DELIVERY_ENABLED: boolish.default(true),
  // Public Mapbox token (pk.…) for the /atlas map. Unset, /atlas shows its charts and tables only.
  MAPBOX_API_KEY: z.string().optional(),
  // An HTTPS origin only: safe to insert into HTML and a CSP source list.
  RYBBIT_ORIGIN: z
    .string()
    .regex(/^https:\/\/[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/)
    .url()
    .optional(),
  RYBBIT_SITE_ID: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) if (v !== undefined && v !== "") cleaned[k] = v;
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}
