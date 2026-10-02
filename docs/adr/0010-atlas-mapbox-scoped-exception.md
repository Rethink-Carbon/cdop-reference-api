# ADR 0010: The /atlas explorer uses Mapbox, as the one scoped exception to "no third-party calls"

Status: accepted (2 October 2026). Amends ADR 0008 for `/atlas` only; `/docs`, `/explorer` and the API itself keep ADR 0008's rules unchanged.

## Context

Rethink Carbon wants a visual explorer for the TWG demo: every project and registry account on a map, drill-throughs into a project's status history, issuances, units and documents, and a couple of charts. A map needs a basemap, and Rethink Carbon chose Mapbox and holds a token.

A Mapbox basemap cannot be self-hosted. Styles, sprites, glyphs and tiles come from `api.mapbox.com` and `*.tiles.mapbox.com`, and Mapbox counts map loads through `events.mapbox.com`. That conflicts with ADR 0008's rule that the bundled pages call nothing but this origin. Rethink Carbon accepted the exception for this page, and said that loading outside scripts on it is acceptable.

Mapbox GL JS v2 and later is not open source. It is under the Mapbox Web SDK licence, usable only with a Mapbox account. This repository and its public image are MIT.

## Decision

- `/atlas/` is a static page served by the API: plain ES modules and CSS in `apps/api/public/atlas/`, no build step, no dependency added to the lockfile. It is a HAL client of the public API. It starts at `/v2`, follows links, pages collections with `next`, and lists the calls behind each view so a reader can open any of them in HAL Explorer. It uses no endpoint a third-party client could not use.
- The map loads Mapbox GL JS from Mapbox's CDN at an exact version, with a Subresource Integrity hash on the script and the stylesheet (`MAPBOX_GL` in `src/routes/atlas.ts`). The browser refuses any other bytes, which answers ADR 0008's objection to an unpinned CDN script. Loading it from Mapbox rather than shipping it means the MIT image never redistributes the Mapbox SDK.
- The token comes from `MAPBOX_API_KEY` and is written into the page as a `<meta>` tag, so it must be a public token (`pk.`). The API ignores any other value and logs a warning, so a secret token pasted by mistake never reaches a browser. The token should carry URL restrictions in the Mapbox account (the hosted origin and `http://localhost:3000`).
- `/atlas/*` gets its own Content-Security-Policy. With a token it adds exactly what Mapbox GL JS needs: `script-src` and `style-src` `https://api.mapbox.com`; `img-src` `blob:` and `https://api.mapbox.com`; `connect-src` `https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com`; `worker-src blob:` and `child-src blob:` for the workers the CDN build creates. Without a token the policy is ADR 0008's self-only policy and the page omits the Mapbox tags; the charts, lists and drill-throughs all work and the map area says why it is empty.
- The page sends `Referrer-Policy: strict-origin-when-cross-origin` when it has a token, because Mapbox checks a token's URL restrictions against the `Referer`. Cross-origin requests carry the origin only. Without a token it keeps `no-referrer`.
- Performance metrics collection is switched off (`performanceMetricsCollection: false`). Map-load events still go to `events.mapbox.com`; Mapbox bills by them.
- Charts are hand-built SVG in `charts.js`, so no charting library is loaded from anywhere. Their palettes were checked for colour-vision separation and contrast in light and dark mode.

## Consequences

- The README's "no third-party calls" claim now names one page and the three Mapbox hosts it may reach. The test suite checks that the atlas policy names only Mapbox origins, that it adds them only when a public token is set, that every external tag carries an SRI hash, that a secret token never appears in the page, and that `/docs` and `/explorer` stay self-only.
- Visitors to `/atlas` are visible to Mapbox: their IP address, this origin as referrer, and their map loads. The README says so, and the page shows Mapbox's attribution.
- Forks run without a token by default. `docker compose up` gives them the atlas without a map until they set `MAPBOX_API_KEY`.
- Upgrading Mapbox GL JS means changing the version in `MAPBOX_GL` and recomputing both hashes (`curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`), then checking the browser console on `/atlas` for CSP errors.
- The map uses the Mercator projection. Under Natural Earth, Mapbox's `fitBounds` placed fitted points outside the canvas.
- Building the atlas found a paging defect in the API: cursors carried timestamps at millisecond precision while Postgres keeps microseconds, so `/v2/units` and `/v2/issuances` stopped after their first page. Timestamp sort keys now sort and compare at millisecond precision (`sortKey` in `src/http/pagination.ts`), with a regression test.
- Considered and rejected: self-hosting MapLibre GL with a country-outline basemap (keeps ADR 0008 intact, but no streets or imagery, and the Mapbox token goes unused); bundling `mapbox-gl` from npm and serving it from this origin (the image would redistribute a non-MIT SDK, and the tiles would still come from Mapbox).
