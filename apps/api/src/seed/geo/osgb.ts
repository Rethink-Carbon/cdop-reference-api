/**
 * Ordnance Survey grid references (100 m precision, e.g. "NH 668 031") from WGS84
 * coordinates via the `geodesy` package, which handles the WGS84 → OSGB36 datum shift
 * and the Transverse Mercator projection.
 */
import { LatLon } from "geodesy/osgridref.js";

/** Rough extent of the National Grid; Northern Ireland uses the Irish grid and is excluded. */
const GB_BOUNDS = { minLat: 49.7, maxLat: 61.0, minLon: -8.7, maxLon: 1.9 };

/**
 * @types/geodesy declares its base classes with extensionless relative imports, which
 * NodeNext cannot resolve, so the `LatLon` constructor arrives untyped. This is the
 * runtime shape we actually use.
 */
type OsLatLonCtor = new (
  lat: number,
  lon: number,
) => { toOsGrid(): { toString(digits?: number): string } };
const OsLatLon = LatLon as unknown as OsLatLonCtor;

/** 100 m grid reference, or undefined outside National Grid coverage. */
export function osgbGridReference(lat: number, lon: number): string | undefined {
  if (
    lat < GB_BOUNDS.minLat ||
    lat > GB_BOUNDS.maxLat ||
    lon < GB_BOUNDS.minLon ||
    lon > GB_BOUNDS.maxLon
  )
    return undefined;
  try {
    return new OsLatLon(lat, lon).toOsGrid().toString(6);
  } catch {
    return undefined;
  }
}
