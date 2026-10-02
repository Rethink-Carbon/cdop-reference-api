/**
 * Deterministic randomness for the synthetic dataset. Every value is addressed by a tag, so
 * adding a new field never reshuffles existing values and reseeding reproduces the dataset.
 * (Ported from the Rethink platform's hash-derived jitter approach; no Math.random anywhere.)
 */

export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for synthetic data. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(private readonly root: string) {}

  /** A fresh generator for `tag`, independent of every other tag. */
  for(tag: string): () => number {
    return mulberry32(fnv1a(`${this.root}:${tag}`));
  }

  /** Uniform [0, 1). */
  unit(tag: string): number {
    return this.for(tag)();
  }

  /** Uniform float in [min, max). */
  float(tag: string, min: number, max: number): number {
    return min + this.unit(tag) * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(tag: string, min: number, max: number): number {
    return min + Math.floor(this.unit(tag) * (max - min + 1));
  }

  bool(tag: string, probability = 0.5): boolean {
    return this.unit(tag) < probability;
  }

  pick<T>(tag: string, items: readonly T[]): T {
    if (items.length === 0) throw new Error(`pick(${tag}) from empty list`);
    return items[Math.floor(this.unit(tag) * items.length)] as T;
  }

  /** Weighted pick: entries [value, weight]. */
  weighted<T>(tag: string, entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.unit(tag) * total;
    for (const [value, w] of entries) {
      r -= w;
      if (r <= 0) return value;
    }
    return entries[entries.length - 1]?.[0] as T;
  }

  /** Approximately normal via sum of 12 uniforms. */
  normal(tag: string, mean = 0, sd = 1): number {
    const g = this.for(tag);
    let s = 0;
    for (let i = 0; i < 12; i++) s += g();
    return mean + (s - 6) * sd;
  }

  /** Log-normal with given median and sigma (in log space), clamped. */
  logNormal(tag: string, median: number, sigma: number, min?: number, max?: number): number {
    const v = median * Math.exp(this.normal(`${tag}:ln`, 0, sigma));
    return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  }

  /** Right-skewed small count (review "more information" loops): mean ≈ `mean`, capped. */
  skewedCount(tag: string, mean: number, cap = 3): number {
    const g = this.for(tag);
    const lambda = mean;
    // Poisson via inversion is fine for small lambda.
    let l = Math.exp(-lambda);
    let k = 0;
    let p = g();
    while (p > l && k < cap) {
      k += 1;
      p *= g();
      l = Math.exp(-lambda);
      if (p <= l) break;
    }
    return Math.min(k, cap);
  }

  /** Deterministic shuffle. */
  shuffle<T>(tag: string, items: readonly T[]): T[] {
    const g = this.for(tag);
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(g() * (i + 1));
      const a = out[i] as T;
      out[i] = out[j] as T;
      out[j] = a;
    }
    return out;
  }

  sample<T>(tag: string, items: readonly T[], n: number): T[] {
    return this.shuffle(tag, items).slice(0, n);
  }
}
