/** Small helpers shared by the generator modules. */

/**
 * Drop `undefined` members so object literals satisfy `exactOptionalPropertyTypes`
 * without a conditional spread per optional field.
 */
export function prune<T extends object>(value: { [K in keyof T]: T[K] | undefined }): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = v;
  return out as T;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Zero-padded decimal string (native registry ids, serial fragments). */
export function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** ddMMyyyy as the UK Land Carbon Registry prints vintage dates inside serials. */
export function ddMMyyyy(d: Date): string {
  return `${pad(d.getUTCDate(), 2)}${pad(d.getUTCMonth() + 1, 2)}${d.getUTCFullYear()}`;
}

export function lastOf<T>(items: readonly T[]): T {
  const last = items[items.length - 1];
  if (last === undefined) throw new Error("lastOf(): empty list");
  return last;
}

export function maxDate(...dates: Array<Date | undefined>): Date | undefined {
  let best: Date | undefined;
  for (const d of dates) if (d && (!best || d.getTime() > best.getTime())) best = d;
  return best;
}
