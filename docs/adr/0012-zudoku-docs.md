# ADR 0012: Zudoku documentation site at /docs

Status: accepted (14 October 2026). Supersedes ADR 0009, which served Scalar at `/docs`. ADR 0008's no-third-party rule and HAL Explorer decisions stand.

## Context

`/docs` (Scalar, ADR 0009) rendered the OpenAPI document well, but the guides (the HATEOAS tour, the API profile, the projection map, the MCP guide and the schema feedback register) existed only in the repository. A visitor to the hosted demo got a reference and no narrative. Zudoku (by Zuplo, MIT) builds Markdown guides and an OpenAPI reference with a playground into one static site with search. A trial at `/portal` worked, and Rethink Carbon chose to replace Scalar with it rather than run two renderers.

## Decision

- `apps/docs` is a Zudoku project, pinned to an exact version. `scripts/prepare.mjs` copies the guides from `docs/` and `SCHEMA-FEEDBACK.md` into `pages/guides/` at build time, so `docs/` stays the only source. The reference is built from the committed `apps/api/openapi/openapi.json`. `scripts/licenses.mjs` writes `/docs/licenses.txt` after the build.
- A build-time processor adds the `/mcp` endpoint with `x-mcp-server`, so the reference shows its URL and install steps for Claude, ChatGPT, Cursor and VS Code, as Scalar's "Connect MCP" did. The API's own OpenAPI document still leaves `/mcp` out, as it is not a REST route.
- `zudoku build` prerenders every page to HTML and builds a Pagefind search index. The Docker build runs it and copies the output, without source maps, into `public/docs`.
- The API serves the site at `/docs` (`src/routes/docs.ts`), compressed, under ADR 0008's CSP with two differences. Each page's `script-src` lists the SHA-256 hashes of that page's three inline scripts (theme, router hydration data and query cache), so other inline script stays blocked. It also allows `'wasm-unsafe-eval'`, which Pagefind's WebAssembly needs; that does not allow JavaScript `eval`.
- The build writes the placeholder origin `https://api-origin.cdop.invalid` wherever a page needs this API's absolute URL: the playground's server, the MCP endpoint, and links from the API description to pages outside `/docs` (a root-relative link would be routed inside the site and get `/docs` in front). The API replaces it with `PUBLIC_BASE_URL` as it serves the pages, so one image serves the hosted demo, `docker compose` and the tests.

## Audit, as ADR 0009 did for Scalar

- Build telemetry: the CLI includes PostHog, but the published 0.93.0 build has no capture key, so it sends nothing. The build sets `ZUDOKU_DO_NOT_TRACK=1` in case a later release adds one.
- Fonts are bundled (`@fontsource`) and served from this origin. Zudoku loads Google Fonts only if a theme names one; none is named.
- Zudoku's HTML template hard-codes `<link rel="preconnect" href="https://cdn.zudoku.dev/">` on every page. No CSP directive covers a preconnect, so each visit would open a connection to Zuplo's CDN. The API removes the tag, and a test checks it.
- The default favicon is on `cdn.zudoku.dev`; the build ships the API's own.
- The "powered by Zudoku" badge (`site.showPoweredBy: false`) and the "open in ChatGPT or Claude" menu (`aiAssistants: false`) are switched off in configuration.
- The playground calls the API with `fetch` from the browser, with no proxy.
- Features that would call other hosts (Inkeep or Algolia search, GraphiQL from esm.sh, Zuplo API keys, the identity providers, footer icons from cdn.simpleicons.org) are not configured, and the CSP blocks them if one is switched on by mistake.
- The build strips the bundled libraries' licence comments, which Scalar's bundle had kept, so `/docs/licenses.txt` lists every package in the site's production dependency tree with its licence text. `THIRD-PARTY-NOTICES.md` carries Zudoku's own notice.

## Consequences

- The guides, the reference, the playground and search are in one place, and search covers both the guides and the API.
- The site navigates with the History API, so `analytics.js` now counts page views on `pushState`, and a click between two `/docs` pages is no longer reported as a link to another resource.
- A page makes about 115 to 135 requests, because the code is split per component and per highlighted language, where Scalar was one 4.6 MB file (1.3 MB gzipped). Hashed assets are cached for a year, so repeat visits fetch little.
- Markdown links that start with `/` stay inside `/docs`. Links out to `/explorer`, `/atlas/` or `/v2` are written as plain `<a>` tags in MDX.
- Zudoku is pre-1.0 and publishes often. Upgrading means reading its changelog for new outbound features, listing the hosts named in the build output, checking that the serve-time changes still apply (the tests fail if the preconnect or placeholder survive), updating the version in `THIRD-PARTY-NOTICES.md` (a test checks it), and checking the browser console on `/docs` for CSP errors.
- The lockfile gains about 120 direct build dependencies (React 19, Vite, Radix, Shiki, Pagefind). The image ships only the static output, about 11 MB.
