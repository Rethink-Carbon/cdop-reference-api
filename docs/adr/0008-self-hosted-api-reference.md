# ADR 0008: Self-hosted API reference, no third-party calls

Status: accepted (20 September 2026). Supersedes the choice of Scalar in the implementation plan.

## Context

`/docs` first used `@scalar/hono-api-reference`. That package is a thin wrapper: the page it serves makes each visitor's browser download the real UI from `cdn.jsdelivr.net`, unpinned, at view time. The UI defaults `telemetry` to `true` and carries Scalar cloud features (Ask AI, Share, Deploy, Generate MCP). None of that code was in the lockfile or the image.

Rethink Carbon's clients are registries, developers and verifiers. A reference implementation that loads unreviewed third-party code, or reports to a vendor, is a finding in their security review and a poor example for implementers.

Adding a Content-Security-Policy then showed that the vendored HAL Explorer also fetched its themes from `bootswatch.com` at run time. A search of its HTML had not found this, because the URL is built in JavaScript.

## Decision

- `/docs` serves Swagger UI from the `swagger-ui-dist` npm dependency, pinned by the lockfile, with our own `index.html` and an external `init.js` so no inline script is needed. `validatorUrl: null`. Models are collapsed by default because the embedded CDOP schemas are large.
- `/explorer` keeps HAL Explorer. The API rewrites the theme URL prefix to `/explorer/themes/` when it serves the bundle and answers those requests itself. It also drops the inline `onload` handler from the bundle's stylesheet link.
- `/docs/*` and `/explorer/*` send a CSP of `default-src 'self'` with `script-src 'self'` and `connect-src 'self'`, plus `Referrer-Policy: no-referrer`. `style-src` allows `'unsafe-inline'` because both UIs set style attributes.
- `@scarf/scarf` (install-time analytics, a dependency of `swagger-ui-dist`) is denied in `pnpm-workspace.yaml`.

## Consequences

- The claim "this service calls nothing but itself" is enforced by the browser and checked by a test, not asserted.
- Theme switching in HAL Explorer has no visible effect.
- The serve-time rewrite depends on a string in a minified bundle. If a HAL Explorer upgrade changes it, the rewrite stops matching and the CSP blocks the request, so the failure is a plain theme, not a leak. The test fails at the same time.
- Swagger UI is plainer than Scalar. Redoc, vendored the same way, is the fallback if its handling of the large schemas proves a problem in use. Measured here: expanding an operation that returns a CDOP document produced no main-thread task over 50 ms.
- Considered and rejected: self-hosting Scalar's bundle (this version has no switch for Ask AI, and the bundle keeps the code paths that call Scalar), hosting the docs on Vercel (adds a third party, fixes nothing), and n8n (a workflow engine, not a renderer).
