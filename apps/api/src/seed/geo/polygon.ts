/**
 * Deterministic star-convex site polygons: 8–14 vertices around a centroid, with radii
 * scaled iteratively until the geodesic area matches the requested hectares. Pure JS:
 * the spherical-excess area formula below is the Chamberlain & Duquette form turf uses.
 */
import type { Rng } from "../prng.js";

/** WGS84 mean earth radius (metres), as used by turf.js for geodesic area. */
const EARTH_RADIUS_M = 6_371_008.8;

export type Position = [lon: number, lat: number];

export interface SitePolygon {
  feature: {
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: { type: "Polygon"; coordinates: Position[][] };
  };
  bbox: [number, number, number, number];
  centroid: Position;
  areaHa: number;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Geodesic area of a closed ring (first == last) in square metres. */
export function ringAreaM2(ring: readonly Position[]): number {
  const n = ring.length - 1; // closing vertex repeats the first
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const lower = ring[i] as Position;
    const middle = ring[(i + 1) % n] as Position;
    const upper = ring[(i + 2) % n] as Position;
    total += (rad(upper[0]) - rad(lower[0])) * Math.sin(rad(middle[1]));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function ringAreaHa(ring: readonly Position[]): number {
  return ringAreaM2(ring) / 10_000;
}

export function polygonAreaHa(coordinates: Position[][]): number {
  const [outer, ...holes] = coordinates;
  if (!outer) return 0;
  return ringAreaHa(outer) - holes.reduce((s, h) => s + ringAreaHa(h), 0);
}

export function bboxOf(ring: readonly Position[]): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/**
 * Build a star-convex polygon of `areaHa` hectares around `centre`. Radii are drawn once
 * (0.55–1.0 of the nominal radius) so the shape is fixed; only the scale converges.
 */
export function sitePolygon(
  rng: Rng,
  tag: string,
  centre: Position,
  areaHa: number,
  vertices?: number,
): SitePolygon {
  const n = vertices ?? rng.int(`${tag}:n`, 8, 14);
  const [cLon, cLat] = centre;
  const angles: number[] = [];
  const radii: number[] = [];
  for (let i = 0; i < n; i++) {
    angles.push(
      (2 * Math.PI * i) / n + (rng.float(`${tag}:a${i}`, -0.18, 0.18) * (2 * Math.PI)) / n,
    );
    radii.push(rng.float(`${tag}:r${i}`, 0.55, 1.0));
  }
  const metresPerDegLat = 111_320;
  const metresPerDegLon = 111_320 * Math.cos(rad(cLat));

  const build = (scale: number): Position[] => {
    const ring: Position[] = [];
    for (let i = 0; i < n; i++) {
      const r = (radii[i] as number) * scale;
      const lon = cLon + (r * Math.cos(angles[i] as number)) / metresPerDegLon;
      const lat = cLat + (r * Math.sin(angles[i] as number)) / metresPerDegLat;
      ring.push([round6(lon), round6(lat)]);
    }
    ring.push([...(ring[0] as Position)] as Position);
    return ring;
  };

  // A regular polygon of unit radius has area ~ (n/2)·sin(2π/n); start from that and
  // correct multiplicatively; a handful of passes lands well inside 2%.
  const targetM2 = areaHa * 10_000;
  let scale = Math.sqrt(targetM2 / ((n / 2) * Math.sin((2 * Math.PI) / n) * 0.62));
  let ring = build(scale);
  for (let pass = 0; pass < 6; pass++) {
    const got = ringAreaM2(ring);
    if (got <= 0) break;
    const ratio = Math.sqrt(targetM2 / got);
    if (Math.abs(ratio - 1) < 0.002) break;
    scale *= ratio;
    ring = build(scale);
  }

  return {
    feature: {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [ring] },
    },
    bbox: bboxOf(ring),
    centroid: [round6(cLon), round6(cLat)],
    areaHa: Math.round(ringAreaHa(ring) * 100) / 100,
  };
}
