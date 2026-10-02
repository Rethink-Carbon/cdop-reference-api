import type { Rng } from "./prng.js";

const DAY = 86_400_000;

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY);
}

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

export function addYears(d: Date, years: number): Date {
  const out = new Date(d.getTime());
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Move to the next weekday (Mon–Fri) if `d` falls on a weekend. */
export function toWeekday(d: Date): Date {
  const day = d.getUTCDay();
  if (day === 6) return addDays(d, 2);
  if (day === 0) return addDays(d, 1);
  return d;
}

/** Same calendar day, business hours 08:12–17:48 UTC, minutes/seconds jittered by tag. */
export function atBusinessHours(rng: Rng, tag: string, d: Date): Date {
  const day = toWeekday(startOfDayUtc(d));
  const minutes = rng.int(`${tag}:bh`, 8 * 60 + 12, 17 * 60 + 48);
  const seconds = rng.int(`${tag}:bs`, 0, 59);
  return new Date(day.getTime() + minutes * 60_000 + seconds * 1000);
}

/** A weekday business-hours instant `days` (jittered ±jitter) after `from`. */
export function businessDaysAfter(
  rng: Rng,
  tag: string,
  from: Date,
  days: number,
  jitter = 0,
): Date {
  const delta = jitter > 0 ? days + rng.int(`${tag}:jit`, -jitter, jitter) : days;
  return atBusinessHours(rng, tag, addDays(from, Math.max(0, delta)));
}

export function clampBefore(d: Date, limit: Date): Date {
  return d.getTime() > limit.getTime() ? limit : d;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

export function yearsBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (365.25 * DAY);
}
