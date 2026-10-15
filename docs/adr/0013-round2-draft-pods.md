# ADR 0013: Round 2 draft pods, vendored and pinned apart from CDOP v2.0

Status: accepted (15 October 2026). Extends ADR 0003 (vendored schemas).

## Context

The TWG's Round 2 "fast track" pods, Registry Metadata, Validation Metadata and Verification Metadata, were circulated to testers by Sebastian Weeks (RMI) on 27 August 2026, with examples on 2 September. Rethink Carbon sent feedback on 1 September. The drafts were briefly on upstream `main` and were deleted before the v2.0 publication (`eff6ca3`). They now live only on the unmerged `R2P-FT-Testing` branch, last updated 13 October 2026 (`39ac535`), which also regenerates `Full_List`, `Project_Approach_Details` and `Estimations` from a workbook that predates `main`'s 1 September changes.

The TWG wants to see the pods working against data, and this API already holds the validation and verification events they describe.

## Decision

- Vendor only the three new schema files and their three examples, byte for byte, from `R2P-FT-Testing` at `39ac535`, into `packages/cdop-schemas/schemas/round2/` and `examples/round2/`. Pin them in a second file, `UPSTREAM-ROUND2.json`, with `round: 2`, `status: "draft"` and an `include` list, so `pnpm cdop:verify` checks their hashes and `pnpm cdop:sync --round2` and `pnpm cdop:drift --round2` follow the branch.
- Do not take the branch's `Full_List`, `Project_Approach_Details` or `Estimations`. The published pods stay at `eff6ca3`, and the Round 2 fields do not enter the Full List document.
- Add the pods as `registry-metadata`, `validation-metadata` and `verification-metadata`, with `POD_ROUND` marking them round 2. Each has its own builder (`apps/api/src/domain/projection/round2.ts`), because they are not subsets of Full List.
- Label them as drafts wherever they appear: `X-CDOP-Schema-Version: round2-draft+39ac535` on their documents, schema files and validation results; `round` and `status` in `/v2/schemas`; link titles ending "(Round 2 draft)"; `components.schemas.cdop.round2.*` in OpenAPI; the MCP tool descriptions.
- Verification Metadata describes one verification event, so on a project it is the latest completed verification, or the one named by `verification_id`, and the project offers no such link (and the route answers 404) when there is none.
- Gaps follow the existing rule: every validation failure must be explained by a register entry. Entries `CDOP-FB-030` to `CDOP-FB-041` cover the drafts, and the conformance suite sweeps the three pods for every seeded project.

## Consequences

- The TWG can test the drafts against 370 projects today without waiting for a merge, and the published v2.0 behaviour is unchanged.
- When the branch moves, `pnpm cdop:drift --round2` shows it; re-vendoring is a reviewed pull request, as for `main`.
- When the pods reach `main`, they move to `schemas/v2/` under `UPSTREAM.json`, `POD_ROUND` becomes 1 for them, the draft labels go, and the Full List projection takes their fields.
- If the branch is deleted without merging, the pin still records the commit, and the vendored files keep working.
