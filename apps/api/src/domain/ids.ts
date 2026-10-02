import { createHash, randomBytes } from "node:crypto";

/** Crockford base32 alphabet used by ULID (no I, L, O, U). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const ID_PREFIXES = {
  project: "prj",
  unit: "unt",
  issuance: "iss",
  validation: "val",
  verification: "vrf",
  estimation: "est",
  estimationVintage: "esv",
  agreement: "agr",
  geolocationFile: "gis",
  document: "doc",
  account: "acc",
  organisation: "org",
  milestone: "mst",
  event: "evt",
  webhook: "whk",
  webhookDelivery: "whd",
  transfer: "trf",
  retirement: "ret",
  cancellation: "cnl",
  bufferEntry: "bpe",
  statusRecord: "psh",
  unitStatusRecord: "ush",
  location: "loc",
  mitigation: "mit",
  stakeholder: "stk",
  creditingPeriod: "crp",
  cobenefitTarget: "cbt",
  cobenefitImpact: "cbi",
  label: "lbl",
  apiKey: "key",
  registryHistory: "rgh",
  projectLabel: "plb",
  offtake: "oft",
  insurance: "ins",
  funding: "fnd",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

function encode(bytes: Uint8Array, length: number): string {
  // Interpret bytes as a big integer and encode base32 (Crockford), left-padded to `length`.
  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);
  let out = "";
  for (let i = 0; i < length; i++) {
    out = ALPHABET[Number(value & 31n)] + out;
    value >>= 5n;
  }
  return out;
}

function timePart(ms: number): string {
  let value = BigInt(ms);
  let out = "";
  for (let i = 0; i < 10; i++) {
    out = ALPHABET[Number(value & 31n)] + out;
    value >>= 5n;
  }
  return out;
}

/** Fresh ULID-shaped id: 10 time chars + 16 random chars. */
export function newId(prefix: IdPrefix, now = Date.now()): string {
  return `${prefix}_${timePart(now)}${encode(randomBytes(10), 16)}`;
}

/**
 * Deterministic ULID-shaped id derived from a seed string: the time component is fixed so
 * seeded ids sort by their tag rather than by wall clock, and reseeding reproduces them.
 */
export function deterministicId(prefix: IdPrefix, tag: string, at?: Date): string {
  const digest = createHash("sha256").update(`${prefix}:${tag}`).digest();
  const time = at ? timePart(at.getTime()) : encode(digest.subarray(10, 20), 10);
  return `${prefix}_${time}${encode(digest.subarray(0, 10), 16)}`;
}

const ID_RE = /^([a-z]{3})_([0-9A-HJKMNP-TV-Z]{26})$/;

export function parseId(value: string): { prefix: string; body: string } | undefined {
  const m = ID_RE.exec(value);
  return m ? { prefix: m[1] as string, body: m[2] as string } : undefined;
}

export function isId(prefix: IdPrefix, value: string): boolean {
  return parseId(value)?.prefix === prefix;
}

/** CDOP URN: cdop:<registry-slug>:<native-project-id>[:<batch>] */
export interface CdopUrn {
  registry: string;
  nativeProjectId: string;
  batch?: string;
}

export function buildUrn(registry: string, nativeProjectId: string, batch?: string): string {
  const base = `cdop:${registry}:${nativeProjectId}`;
  return batch ? `${base}:${batch}` : base;
}

export function parseUrn(value: string): CdopUrn | undefined {
  const parts = value.split(":");
  if (parts.length < 3 || parts.length > 4 || parts[0] !== "cdop") return undefined;
  const [, registry, nativeProjectId, batch] = parts;
  if (!registry || !nativeProjectId) return undefined;
  const urn: CdopUrn = { registry, nativeProjectId };
  if (batch) urn.batch = batch;
  return urn;
}
