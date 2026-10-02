# ADR 0009: Scalar for /docs, self-hosted and held to ADR 0008's rules

Status: accepted (2 October 2026). Supersedes the `/docs` renderer chosen in ADR 0008; ADR 0008's Content-Security-Policy, HAL Explorer and no-third-party rules stand.

## Context

Rethink Carbon wants `/docs` to showcase the API, and Scalar presents the large CDOP documents better than Swagger UI. ADR 0008 replaced Scalar for three reasons: the wrapper made every visitor download an unpinned bundle from a public CDN, telemetry defaulted to on, and the bundle had no switch for its AI features. It rejected self-hosting the bundle for the last two reasons.

`@scalar/api-reference` 1.72 changes the third: its configuration now has `agent.disabled`. Its browser build, `dist/browser/standalone.js`, is a single self-contained file.

## Decision

- `/docs` serves `standalone.js` from `@scalar/api-reference`, pinned to an exact version as a dev dependency, so it is in the lockfile and `pnpm audit`. Locally and in CI the API reads it from `node_modules`. The Dockerfile copies only that file into `public/scalar/`, so the package's 27 runtime dependencies stay out of the image.
- The API serves the bundle at `/docs/scalar.js` without its source map reference, gzipped when the client accepts it (4.4 MB, about 1.3 MB on the wire), read and compressed once per process.
- `init.js` turns off everything that would leave the origin: `withDefaultFonts: false` (fonts.scalar.com), `telemetry: false`, `agent: { disabled: true }` (the hosted AI agent), and `hideClientButton: true` (a link that hands the spec URL to client.scalar.com). `showDeveloperTools: "never"`. The in-page "Test Request" client stays; it calls this origin.
- `mcp` advertises the API's own `/mcp` endpoint. Scalar renders it as "Connect MCP" with install deep links for VS Code and Cursor; nothing is sent to Scalar.
- ADR 0008's CSP is unchanged: `default-src 'self'`, `script-src 'self'`, `connect-src 'self'`. `vue-demi`'s install script is denied in `pnpm-workspace.yaml`; only the prebuilt bundle is used.
- The version is chosen to satisfy pnpm's minimum release age, with no `minimumReleaseAgeExclude` entries.

## Consequences

- The bundle still contains code paths that call Scalar's services (a request proxy, a registry, an API). Configuration switches them off and the CSP blocks them if a future version switches one back on, so a regression shows up as a console CSP error, not a call. The test suite checks the four settings in `init.js`.
- "Powered by Scalar" links to scalar.com remain, as plain attribution links. Following one is a navigation the visitor chooses, not a request the page makes.
- Measured with the 300 KB Full List schema embedded: opening the "CDOP document for a project" operation ran one 60 ms main-thread task (12 ms of it blocking). ADR 0008 measured no task over 50 ms for Swagger UI. Redoc, vendored the same way, remains the fallback if this proves a problem in use.
- Upgrading Scalar means re-reading its configuration schema for renamed or new outbound features before bumping the pin, then checking the browser console on `/docs` for CSP errors.
