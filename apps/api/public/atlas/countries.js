// Approximate centroids for placing registry accounts, which carry a country code but no
// coordinates. ISO 3166-1 alpha-3 -> [alpha-2, lon, lat]. A code missing here is still listed;
// it just has no marker on the map.
const CENTROIDS = {
  ARE: ["AE", 54.0, 24.0],
  ARG: ["AR", -64.0, -36.0],
  AUS: ["AU", 134.5, -25.7],
  AUT: ["AT", 14.6, 47.6],
  BEL: ["BE", 4.5, 50.6],
  BGD: ["BD", 90.3, 23.7],
  BOL: ["BO", -64.7, -16.3],
  BRA: ["BR", -52.0, -10.5],
  CAN: ["CA", -100.0, 56.0],
  CHE: ["CH", 8.2, 46.8],
  CHL: ["CL", -71.5, -35.7],
  CHN: ["CN", 104.2, 35.9],
  CIV: ["CI", -5.5, 7.5],
  CMR: ["CM", 12.4, 5.7],
  COD: ["CD", 23.6, -2.9],
  COL: ["CO", -73.1, 4.1],
  CRI: ["CR", -84.0, 9.8],
  DEU: ["DE", 10.4, 51.2],
  DNK: ["DK", 9.5, 56.0],
  ECU: ["EC", -78.2, -1.6],
  EGY: ["EG", 30.8, 26.8],
  ESP: ["ES", -3.7, 40.2],
  ETH: ["ET", 39.6, 9.1],
  FIN: ["FI", 26.0, 63.5],
  FJI: ["FJ", 178.0, -17.8],
  FRA: ["FR", 2.4, 46.6],
  GBR: ["GB", -2.4, 53.6],
  GHA: ["GH", -1.0, 7.9],
  GTM: ["GT", -90.3, 15.7],
  GUY: ["GY", -58.9, 4.9],
  HND: ["HN", -86.6, 14.8],
  IDN: ["ID", 113.9, -0.8],
  IND: ["IN", 79.0, 22.0],
  IRL: ["IE", -8.0, 53.3],
  ITA: ["IT", 12.6, 42.8],
  JPN: ["JP", 138.3, 36.2],
  KEN: ["KE", 37.9, 0.2],
  KHM: ["KH", 104.9, 12.6],
  KOR: ["KR", 127.8, 36.4],
  LAO: ["LA", 102.5, 19.9],
  LBR: ["LR", -9.4, 6.4],
  LKA: ["LK", 80.7, 7.9],
  MAR: ["MA", -7.1, 31.8],
  MDG: ["MG", 46.9, -19.4],
  MEX: ["MX", -102.5, 23.6],
  MMR: ["MM", 96.0, 21.9],
  MOZ: ["MZ", 35.5, -17.5],
  MWI: ["MW", 34.3, -13.2],
  MYS: ["MY", 109.5, 3.5],
  NGA: ["NG", 8.7, 9.1],
  NIC: ["NI", -85.2, 12.9],
  NLD: ["NL", 5.3, 52.1],
  NOR: ["NO", 9.0, 61.0],
  NPL: ["NP", 84.1, 28.4],
  NZL: ["NZ", 172.5, -41.5],
  PAK: ["PK", 69.3, 30.4],
  PAN: ["PA", -80.1, 8.5],
  PER: ["PE", -75.0, -9.2],
  PHL: ["PH", 122.0, 12.9],
  PNG: ["PG", 145.0, -6.3],
  POL: ["PL", 19.1, 52.0],
  PRT: ["PT", -8.2, 39.6],
  PRY: ["PY", -58.4, -23.4],
  RWA: ["RW", 29.9, -1.9],
  SAU: ["SA", 45.1, 23.9],
  SEN: ["SN", -14.5, 14.5],
  SGP: ["SG", 103.8, 1.35],
  SLE: ["SL", -11.8, 8.5],
  SUR: ["SR", -56.0, 4.0],
  SWE: ["SE", 16.0, 62.0],
  THA: ["TH", 101.0, 15.9],
  TUR: ["TR", 35.2, 39.0],
  TZA: ["TZ", 34.9, -6.4],
  UGA: ["UG", 32.3, 1.4],
  URY: ["UY", -55.8, -32.5],
  USA: ["US", -98.5, 39.5],
  VNM: ["VN", 105.8, 16.2],
  ZAF: ["ZA", 24.7, -29.0],
  ZMB: ["ZM", 27.8, -13.1],
  ZWE: ["ZW", 29.2, -19.0],
};

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return undefined;
  }
})();

/** [lon, lat] for an alpha-3 code, or undefined. */
export function countryCentroid(code) {
  const c = code && CENTROIDS[code];
  return c ? [c[1], c[2]] : undefined;
}

/** English short name for an alpha-3 code, falling back to the code. */
export function countryName(code, fallback) {
  if (!code) return fallback ?? "No country";
  const c = CENTROIDS[code];
  if (c && regionNames) {
    try {
      return regionNames.of(c[0]) ?? fallback ?? code;
    } catch {
      /* fall through */
    }
  }
  return fallback ?? code;
}
