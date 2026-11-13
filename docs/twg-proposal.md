# TWG proposal 0.1.0

This is Rethink Carbon's worked proposal for the 16 November 2026 TWG review, following the 20 October discussion. It covers CDOP-FB-010 and CDOP-FB-012–015. The published baseline is CDOP **2.1.0**, upstream commit `363b194`. Proposal documents carry `rethink-proposal-0.1.0` and `status: proposal`; they are a focused identity and lifecycle model, not a replacement Full List or an approved CDOP release.

## Walk through the demo

1. Open `/atlas`, select a project, and open its **CDOP documents** tab.
2. Change **Document version** from **Published CDOP** to **Rethink proposal 0.1.0**. Read its validation result, identity, lifecycle, hold flag and status history.
3. Follow **Explore proposal links**, **Proposal JSON** or **Proposal schema** to inspect the same data through the API. Switch back to Published CDOP to compare the existing pod documents.
4. Open `/v2/proposals/0.1.0` for the proposal's scope and worked WCC, Peatland Code, VCS and registry-transfer examples. Each standard example includes the published Full List and its conformance result alongside the proposed document and its result.

The static examples are generated without a database and checked into `examples/proposals/0.1.0/`. Project routes load the same aggregate used by the published API. All data in the examples is synthetic. The registry transfer is hypothetical; it does not assert that a particular standard permits transfers.

## Decisions to review

| Feedback | Implemented proposal                                                                                                                              | Decision still needed                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FB-010   | One project UUID, separate `registry_id` and `registry_project_id`; all related records reference the UUID. The transfer example preserves it.    | Who assigns the identity, how imports preserve it, and how duplicate identities from independent issuers are reconciled.                                              |
| FB-012   | Seven unit states: pending, active, on_hold, buffer, retired, cancelled, expired. Reasons remain separate.                                        | Agree canonical states and the lossless mapping from each registry; buffer allocation may ultimately deserve its own dimension.                                       |
| FB-013   | Eight existing API lifecycle stages, alongside native status, hold flag and explicitly unreported authorization.                                  | Agree the common lifecycle and whether retirement belongs at project level. The demo is an eight-stage candidate, not a claim that the meeting agreed the vocabulary. |
| FB-014   | Five issuance process states. Completed ex-post and conversion issuances reference a completed verification; `Verified` is not an issuance state. | Agree preconditions by issuance kind, including validation requirements for ex-ante credits and buffer issuance.                                                      |
| FB-015   | Event ID, sequence, effective and recorded timestamps, actor, action, reason, from/to states and current marker.                                  | Agree correction/backdating semantics, retention and access to actor identity.                                                                                        |

The lifecycle values are `draft`, `listed`, `registered`, `validated`, `verified`, `retired`, `withdrawn`, `rejected`. The model retains the registry's original code and vocabulary. `authorization.status: not_reported` records the absence of source data; it does not infer Article 6 authorization from lifecycle or hold status.

For this demo, UUIDv5 is assigned in a fixed Rethink namespace using the immutable internal project ID. Registry names and native identifiers are not inputs. This makes the seeded examples reproducible and survives a transfer of the same record. Recreating the project with a new internal ID produces a new UUID: production importers must retain the assigned global ID, and cross-issuer identity reconciliation remains unresolved. The demo's v5-only schema is not a recommendation to prohibit other UUID versions.

History is ordered by per-entity sequence, not effective time, to allow backdated business events. `recorded_at` comes from the stored audit row. In generated fixtures it equals `effective_at`, matching the seed writer. The validator checks contiguous sequences, from/to continuity, a single final current marker, agreement with the current state, unique record/event IDs, and references between project, verification, validation, issuance and unit records. It also rejects reversed monitoring periods and completed ex-post issuances without a completed verification. This is a complete-history demo; partial histories would need an explicit starting sequence and predecessor contract.

## API and fixtures

| Endpoint                                                          | Result                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| `GET /v2/proposals`                                               | Available proposal versions                           |
| `GET /v2/proposals/0.1.0`                                         | Scope, feedback IDs, baseline and example links       |
| `GET /v2/proposals/0.1.0/schema`                                  | JSON Schema 2020-12                                   |
| `GET /v2/proposals/0.1.0/examples/{wcc,pc,vcs,registry-transfer}` | Worked examples with validation results               |
| `GET /v2/projects/{id}/proposals/0.1.0`                           | HAL wrapper, proposed document and validation         |
| `GET /v2/projects/{id}/proposals/0.1.0/document`                  | Raw proposal JSON                                     |
| `POST /v2/proposals/0.1.0/validate`                               | Schema and cross-record validation: `{valid, errors}` |

The raw document is the input to the validator; do not submit the HAL wrapper or example wrapper. A well-formed invalid document returns HTTP 200 with `valid: false`; malformed JSON returns 422. Project representations preserve proposal/schema/conformance headers on conditional 304 responses.

```bash
pnpm proposals:export     # regenerate the five JSON fixtures
pnpm proposals:check      # fail on fixture drift, also run in CI
pnpm --filter @cdop/api test
```

The HTTP suite requires a migrated, seeded database through `DATABASE_URL`; it skips those tests if none is reachable.

Tests cover all seven standards, independent Ajv validation of the exported schema, transfer identity, corrupted histories/references, and database-backed HTTP discovery and cache revalidation. JSON Schema validates shape; the companion validator handles cross-record relationships that JSON Schema cannot express.

## Upstream generator handoff

The exported fixtures and regression cases are concrete input for discussion with Dylan. A useful next upstream change is to test generated examples against each generated schema, detect example keys outside declared schema paths, check one canonical path per field ID, and add semantic tests for history and reference integrity. The 2.1.0 release already adds upstream example validation; contribute the extra cases to that workflow rather than duplicate it.

The reference API still serves the separately pinned October Round 2 pods (`round2-draft+39ac535`). The October 26 Registry and November 6 Verification attachments were reviewed separately; their findings are in `docs/reviews/round2-2026-11-13.md`. They have not silently replaced the served drafts. No real or anonymized project corpus has been imported as part of this work.
