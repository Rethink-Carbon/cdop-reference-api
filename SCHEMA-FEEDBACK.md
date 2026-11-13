# CDOP schema feedback register

This file is the numbered record of every point where the CDOP schema could not be implemented as published, was ambiguous, needed an extension, or left an API concern unspecified. It is the deliverable the Technical Working Group asked for alongside the reference API: "document any gaps, ambiguities or decisions that could affect schema development".

The register is served by the API at `/rels/feedback` and to MCP clients as the `cdop://feedback` resource.

## How the register works

**Implementation snapshot.** Original observations and the "What the reference API does" sections are written against the vendored schema at upstream commit `eff6ca3d634fc4032d9873cc2c423487c8f34a1b` (16 September 2026), schema version 2.0. File paths are relative to `packages/cdop-schemas/`. Field ids are the `x-cdop-field-id` values from the schema. Dated rechecks preserve the evidence at each review. The 20 October audit did not change the pins. On 13 November the published pin and projection were upgraded to v2.1.0 (`363b194`); the Round 2 pin remains unchanged. Original observations below are historical unless a newer recheck says otherwise.

**Round 2 drafts.** Entries `CDOP-FB-030` onwards cover the three Round 2 "fast track" draft pods (Registry Metadata, Validation Metadata, Verification Metadata). They are not on `main`: they are vendored from the upstream `R2P-FT-Testing` branch at commit `39ac5351e8ca7ecdbc91bbb733188ea226bc21cb` (13 October 2026), pinned in `UPSTREAM-ROUND2.json` and served with `X-CDOP-Schema-Version: round2-draft+39ac535`. Their file paths are relative to `packages/cdop-schemas/schemas/round2/`. Many repeat points Rethink Carbon sent Sebastian Weeks on 1 September 2026 against the 27 August drafts; those are marked `raised upstream`. Earlier fixes include the malformed validation identifier key (historically recorded as `_id`, also described as `"validation _id"` in the earlier introduction; see `CDOP-FB-001`), the enumerated lists now present in the JSON for validation stages, stage status, sectoral scopes, claim type, unit of measure and audit status, and the upper-case enum values (`CARBON_REMOVAL`), now sentence case.

**Numbering.** Entries are `CDOP-FB-nnn`, sequential, never reused, never deleted. `CDOP-FB-001` is the historical item Rethink Carbon reported before this repository existed; new entries follow it. Entries change status; they do not disappear.

**Categories.**

| Category    | Meaning                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `defect`    | The published JSON is wrong: a mangled key, a typo in an enum, a `required` list no document can satisfy. |
| `ambiguity` | The schema admits more than one reading, or two parts of it disagree.                                     |
| `extension` | The API needed something the schema cannot express, and added it outside the schema.                      |
| `api-gap`   | A concern that belongs to an API profile, not to a document schema.                                       |

**Status vocabulary.** `open, not yet raised upstream`, `raised upstream`, `accepted upstream`, `fixed upstream`, `fixed at source (awaiting regenerated JSON)`, `withdrawn`.

**Adding an entry.** Take the next number. Fill in every section below (file and field path, category, observation with evidence, impact, what the reference API does, proposal, status). Quote the schema or example JSON verbatim where you can. If you want the discussion to start before the entry goes upstream, open a GitHub issue with the `CDOP schema feedback` template at `.github/ISSUE_TEMPLATE/schema-feedback.yml`; it has the same sections. Link the issue from the entry once it exists. Every deviation the API makes from the schema must have an entry here; the pull request template asks for it.

**Evidence.** Original snippets below are copied from the vendored files. The 20 October upstream recheck uses the exact commits linked in [Upstream watch](#upstream-watch), independently of those vendored files. Run `pnpm cdop:lint` to see the mechanical findings, and `pnpm test --filter @cdop/schemas` for the assertions that pin the defects.

## Summary

| Id          | Category  | Location                                                                                             | Title                                                                                                              | Status after 20 October recheck  |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| CDOP-FB-001 | defect    | `validation`                                                                                         | Identifier key on the validation record (historical, fixed upstream)                                               | fixed upstream                   |
| CDOP-FB-002 | defect    | `project."crediting period"`, `cobenefits.cobenefit_target[]`                                        | Property names containing spaces                                                                                   | fixed; adopted v2.1.0            |
| CDOP-FB-003 | defect    | `unit.credit_blockblock_start`                                                                       | Mangled key, required, while `block_end` sits in `credit_block[]`                                                  | fixed; adopted v2.1.0            |
| CDOP-FB-004 | defect    | `examples/v2/*.json`                                                                                 | Published examples do not validate against the published schemas                                                   | fixed in v2.1.0                  |
| CDOP-FB-005 | defect    | `Full_List.required`                                                                                 | Mechanically derived `required` overconstrains project documents                                                   | open, not yet raised upstream    |
| CDOP-FB-006 | defect    | `crediting_program.standard[].standard_name`                                                         | Enum typo `Verificed Carbon Standard (VCS)` is the wire contract                                                   | fixed in v2.1.0                  |
| CDOP-FB-007 | defect    | `x-cdop-mutability`, `x-cdop-public-private`, `x-cdop-data-source`, `x-cdop-pre-issuance-inclusion`  | Annotation values inconsistent in casing, spelling and column                                                      | open, not yet raised upstream    |
| CDOP-FB-008 | defect    | `project.activity_type`                                                                              | Described as an enumeration but ships with no list                                                                 | open, not yet raised upstream    |
| CDOP-FB-009 | defect    | `agreement.project_financing_stage`                                                                  | Enum typos (`Pre-feasability`, `Feasability`) and duplication of `project_status`                                  | open, not yet raised upstream    |
| CDOP-FB-010 | ambiguity | `project.project_id`, `project_identifier`, `current_registry_project_id`                            | Three overlapping project identifiers and an unspecified country-keyed URN                                         | proposal implemented             |
| CDOP-FB-011 | ambiguity | `validation_id`, `estimation_id`, `previous_project_registration_id`                                 | Integer identifiers                                                                                                | open, not yet raised upstream    |
| CDOP-FB-012 | ambiguity | `unit.status[].status`                                                                               | Three unit-status vocabularies; states, hold reasons and events mixed                                              | proposal implemented             |
| CDOP-FB-013 | ambiguity | `project.status[].project_status`                                                                    | Funnel stages, Article 6 authorisation and activity in one enum                                                    | proposal implemented             |
| CDOP-FB-014 | ambiguity | `issuance.issuance[].issuance_status`                                                                | Precondition (`Verified`) mixed with process states                                                                | proposal implemented             |
| CDOP-FB-015 | ambiguity | `project.status[]`, `unit.status[]`, `estimations.status[]`                                          | Status records carry no timestamp, actor or sequence                                                               | proposal implemented             |
| CDOP-FB-016 | ambiguity | `estimations.*`, `validation.*`, `unit.*`                                                            | Parallel arrays without keys; scalars beside arrays                                                                | open, not yet raised upstream    |
| CDOP-FB-017 | ambiguity | `geolocation_file.location[]`                                                                        | No file link, geometry or project reference; vector and raster, acquisition and lifecycle mixed                    | open, not yet raised upstream    |
| CDOP-FB-018 | ambiguity | all pods                                                                                             | Only `format: date` is used; no `uri`, `email` or `date-time`                                                      | open, not yet raised upstream    |
| CDOP-FB-019 | ambiguity | `unit.owner_account_id`, `unit.expected_carbon_credit_price`                                         | Required and Private; no account entity                                                                            | open, not yet raised upstream    |
| CDOP-FB-020 | ambiguity | `project.compliance_market_id`                                                                       | Required with `minItems: 1` although "if applicable"                                                               | fixed in v2.1.0                  |
| CDOP-FB-021 | ambiguity | `crediting_program`, `carbon_crediting_standard`, `registry`                                         | Three overlapping "standard" concepts; field 242 has a different path in Full List and Labels & Certifications     | partly fixed in v2.1.0           |
| CDOP-FB-022 | ambiguity | `methodology.versions[].methodology`                                                                 | A 496-value enum with embedded program prefixes                                                                    | open, not yet raised upstream    |
| CDOP-FB-023 | ambiguity | `project.buffer_pool[]`                                                                              | Buffer totals without dates; the buffer is a ledger                                                                | open, not yet raised upstream    |
| CDOP-FB-024 | ambiguity | `project.project_risk`                                                                               | JSON stored in a string                                                                                            | open, not yet raised upstream    |
| CDOP-FB-025 | ambiguity | `unit.descriptor[].type`                                                                             | Lacks WCU and PCU while including PIU; `"VER, CER"` is two values                                                  | open, not yet raised upstream    |
| CDOP-FB-026 | ambiguity | all pods                                                                                             | `additionalProperties: true` everywhere, so misspelled keys validate                                               | open, not yet raised upstream    |
| CDOP-FB-027 | api-gap   | n/a                                                                                                  | No `modified_at`, version, deletion, pagination, change-feed or link conventions                                   | open, not yet raised upstream    |
| CDOP-FB-028 | defect    | `crediting_program.crediting_program[].crediting_program_name`, `methodology.versions[].methodology` | The UK codes are in the standard enum but missing from the program and methodology enums                           | open, not yet raised upstream    |
| CDOP-FB-029 | defect    | `unit.unit_level[]`                                                                                  | Every unit label must be an accreditation and a compliance eligibility at once; CORSIA phases are spelled two ways | open, not yet raised upstream    |
| CDOP-FB-030 | defect    | Round 2 field ids 261 to 325                                                                         | Two Round 2 branches give the same field ids to different fields                                                   | open, not yet raised upstream    |
| CDOP-FB-031 | ambiguity | `Registry_Metadata`, `Validation_Metadata`                                                           | No project identifier: the records cannot be joined to their project                                               | partly addressed in new draft    |
| CDOP-FB-032 | ambiguity | `registry.identification[]`, `registry.program[]`                                                    | Integer registry and program ids, and free-text names where Round 1 has enums                                      | addressed in Registry draft      |
| CDOP-FB-033 | ambiguity | `registry.original[]`, `creation_date`, `update_date`                                                | Registry history arrays and dates are underspecified                                                               | partly addressed in new draft    |
| CDOP-FB-034 | ambiguity | `validation.*[]`, `verification.*[]`                                                                 | Sibling arrays with no key to their validation or verification event                                               | partly addressed in new draft    |
| CDOP-FB-035 | ambiguity | `validation.date[]`, `validation_body.details[]`, `verification.*`                                   | Required values that registries do not publish, or that do not exist yet                                           | open; draft rechecked            |
| CDOP-FB-036 | ambiguity | `project.validation_status`, `project.validation_stage[]`                                            | Validation status modelled three ways                                                                              | raised upstream                  |
| CDOP-FB-037 | ambiguity | `validation.crediting_period[]`, `validation_type`, report links                                     | Round 2 restates Round 1 fields under new ids, names and vocabularies                                              | raised upstream                  |
| CDOP-FB-038 | defect    | `validation_body.details[].validation_body_sectoral_scopes`                                          | The sectoral scope list is the CDM list: no scope for REDD+, IFM, wetlands, peat or biochar                        | open, not yet raised upstream    |
| CDOP-FB-039 | ambiguity | `verification.verification_credential_issuer_id`                                                     | A decentralised identifier is required on every verification                                                       | addressed in Verification drafts |
| CDOP-FB-040 | ambiguity | `verification.quantity[]`, `verification.deductions[]`                                               | Verified quantity: unit, uncertainty basis and period are ambiguous                                                | partly addressed in new draft    |
| CDOP-FB-041 | defect    | Round 2 annotations                                                                                  | Round 2 drops annotations Round 1 carries, and one cardinality contradicts `required`                              | raised upstream                  |

## November implementation and draft review

**13 November 2026.** The reference API now vendors [v2.1.0](https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol/releases/tag/v2.1.0) at `363b1944f949eb45b5dd5a22aed576621a27678b`. FB-002/003 fixes are adopted; FB-004, 006 and 020 are fixed; FB-021's field-path inconsistency is fixed while its broader modelling question remains. All twelve published examples pass. This is a targeted update, not a new audit of every outstanding entry.

The [worked proposal](docs/twg-proposal.md) implements FB-010 and FB-012–015 for review, with versioned JSON and validation results in `examples/proposals/0.1.0/`. It is available through the API, Atlas and HAL Explorer. These proposals remain unapproved upstream.

The [Registry/Verification review](docs/reviews/round2-2026-11-13.md) tests Sebastian's October 26 and November 6 attachments. It distinguishes draft improvements from remaining failures and includes a VAE recommendation. The API still serves the separately pinned October 13 Round 2 schemas. No conclusion here means that a newer attachment has replaced that served contract.

## Upstream watch — historical audit of 20 October 2026

**Checked 20 October 2026. All 41 entries reviewed: 001, 002 and 003 are fixed upstream; 004 to 041 remain unresolved.** The 001 correction was already in the September JSON; the 16 October regeneration fixes 002 and 003. The latest upstream JSON is still the v2.0 schema family; there is no tagged release. These conclusions concern published files on `main` or the explicitly identified Round 2 drafts, rather than a new numbered release.

### Sources and method

| Source                                   | Audited commit                                                                                                                                                                  | Position                                                                                                                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Published `main`                         | [`1845bd025b2f60f54cab86823f3a2b8326da55de`](https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol/tree/1845bd025b2f60f54cab86823f3a2b8326da55de) (16 October) | Includes [PR 44](https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol/pull/44), the generator normalisation fix, and generated schemas from [`f3f5378`](https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol/commit/f3f5378). |
| Round 2 fast track, `R2P-FT-Testing`     | [`711a6f112dc6cf6ea257a67e7849885f2ca154c8`](https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol/tree/711a6f112dc6cf6ea257a67e7849885f2ca154c8) (15 October) | Unmerged. The three metadata schemas and their examples are byte-for-byte identical to the vendored `39ac535` versions. Only Full List JSON changed since that pin: it fixes 003.                                                                                 |
| Round 2 standard track, `R2P-ST-Testing` | [`9fec252fe686e0a615a20390fc2e008358902c45`](https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol/tree/9fec252fe686e0a615a20390fc2e008358902c45) (8 October)  | Unmerged and unchanged since the previous watch. Contains Additionality.                                                                                                                                                                                          |

The audit compared all twelve published schemas, all eleven published examples, the generator and workflow with the pinned `eff6ca3` snapshot, then inspected each entry's fields, types, enums, required lists and annotations. Only `Full_List.schema.json` and `Co_Benefits.schema.json` changed on `main`; every published example is unchanged. The diff is available [between the implementation snapshot and audited main](https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol/compare/eff6ca3d634fc4032d9873cc2c423487c8f34a1b...1845bd025b2f60f54cab86823f3a2b8326da55de). All schema property names now pass `^[a-z][a-z0-9_]*$` on `main`, and field ids 152 and 161 have consistent paths. Field 242 still has two paths (021).

Every available example was validated against its own branch's schema with Ajv 2020-12, `allErrors: true`, `ajv-formats`, and the same annotation vocabulary as the reference API. This is a fresh upstream example check, not a rerun of the API's synthetic dataset conformance sweep. Historical dataset counts and platform behaviour below have not been remeasured. For 012 the unchanged schema vocabulary was checked; external wiki and CAD Trust vocabularies were not independently re-audited. The audit checks whether recorded concerns remain, rather than asserting that every proposed modelling change is a confirmed schema defect.

### Published example validation

| Example on audited `main` | Result          | Evidence                                                                                                                                                                                                |
| ------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full_list.json`          | Fail: 7 errors  | Missing `agreement`, `cobenefits` and `project.compliance_market_id`; `project.declaring_entity_name` and two mitigation quantities are also missing; `/unit/status` has the wrong type.                |
| `unit_description.json`   | Fail: 1 error   | `/unit/status` must be an array.                                                                                                                                                                        |
| `co_benefits.json`        | Fail: 27 errors | Values outside SDG, co-benefit, unit and monitoring-frequency enums.                                                                                                                                    |
| `project_finance.json`    | Fail: 17 errors | Values outside financing, community-benefit, counterparty, agreement, insurance, collateral and financing-stage enums.                                                                                  |
| The other seven examples  | Pass            | Location Details, Project Approach & Details, Disclosures, Issuances, Crediting Period, Estimations, Durability & Permanence. Permissive additional properties still hide some wrong shapes (004, 026). |

The generation workflow still does not validate the examples. The upstream `scripts/validate.py` utility exists, but is not invoked by that workflow. On standard track, `full_list.json` and `additionality.json` pass; co-benefits, finance and unit description still fail. On fast track, all three new metadata examples pass, while Full List and Location Details still fail against that branch's stale location schema; co-benefits, finance and unit description also fail.

### Remaining branch concerns

1. **Field id collision (030).** The two Round 2 branches still assign 56 ids within 261 to 325 to different fields. Neither branch has merged, and no pull request is open for either. The two open upstream pull requests are unrelated (#17 and #20).
2. **Fast track needs rebasing and regeneration.** It has 17 fewer `main` commits and 30 branch-only commits. Its generated files retain the pre-1 September Labels & Certifications entity name and the one-value `country_subdivision_code` enum. It also lacks the 16 October fixes for 002. The API continues to vendor only its three new pods and examples.
3. **Additionality requires every field in each group.** The alternative-test concern and repeated names from the previous watch remain. This draft is not vendored by the reference API.
4. **Breaking validation changes (036, 037).** Fast track still replaces the four Round 1 `validation_type` values with two new values and makes `project.validation_status` required. That requires an explicit migration decision.
5. **Per-verification buffer deduction (023).** Fast track provides a reporting-period buffer deduction, but the original aggregate `project.buffer_pool[]` still lacks dates or ledger references.

**Corrections to the register's wording.** Review also found two overstatements, corrected below without treating them as upstream fixes: 005 does not make every possible project document invalid, and `credit_block[]` can contain several blocks; 028's program and methodology sections are not in the Project Approach & Details top-level `required` list, although supplying the actual UK names still fails their enums. In 019, expected price is required by the cardinality annotation, not the JSON `required` list. All three concerns remain in the narrower form stated in their rechecks.

---

## CDOP-FB-001: Identifier key on the validation record (historical)

|                   |                                                    |
| ----------------- | -------------------------------------------------- |
| File / field path | `validation` (pre-release v2 draft), the `_id` key |
| Category          | defect                                             |
| Status            | fixed upstream                                     |

**Recheck (20 October 2026).** Fixed upstream. Published `main` uses `validation_id` at fields 154 and 170, with no malformed `_id` property. This was already true in the September implementation snapshot. The unmerged Validation Metadata pod also uses `validation_id` (287). Close the naming defect; integer typing remains 011.

**Observation.** Rethink Carbon reported the `validation` identifier key (`_id`) in its Round 2 feedback on 1 September 2026, before the v2.0 JSON was published. Sebastian Weeks (RMI, TWG) confirmed by email on 2 September 2026 that it had been fixed in the source Excel workbook. The details are in that feedback document and are not reproduced here.

**Impact.** None on the vendored v2.0 files, which carry `validation_id` (field ids 154 and 170). The integer typing of that key is a separate item, `CDOP-FB-011`.

**What the reference API does.** Nothing specific. The entry exists so the register numbering starts from the first item Rethink raised.

**Proposal.** Retain the corrected `validation_id` key. The naming defect is closed as of the 20 October recheck; identifier typing remains a separate proposal in CDOP-FB-011.

---

## CDOP-FB-002: Property names containing spaces

|                   |                                                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `schemas/v2/Full_List.schema.json`: `project."crediting period"[]` (field 161); `schemas/v2/Co_Benefits.schema.json` and `Full_List.schema.json`: `cobenefits.cobenefit_target[]."overview_of_the_projects_approach_to_ track_and_quantify"` |
| Category          | defect                                                                                                                                                                                                                                       |
| Status            | fixed; adopted v2.1.0                                                                                                                                                                                                                        |

**Recheck (13 November 2026).** The clean crediting-period and co-benefit keys are now vendored and used by the projection. Historical workaround text below describes the September snapshot.

**Recheck (20 October 2026).** Fixed upstream by the 16 October regeneration. In Full List, field 161 is now `project.crediting_period[].current_crediting_period_duration`, with no separate `"crediting period"` group. Field 181 is `overview_of_the_projects_approach_to_track_and_quantify` in both Full List and Co-Benefits. The generator normalises field paths and keys. Crediting Period already uses the clean duration path; its flat example remains misleading (004). The vendored API files still contain the old keys.

**Observation.** Two property names contain a space. The first duplicates an existing snake_case group: `project` has both `crediting_period[]` (fields 158 to 160) and `"crediting period"[]` (field 161). The generator's own field path preserves the space:

```json
"crediting period": {
  "type": "array",
  "items": {
    "type": "object",
    "additionalProperties": true,
    "properties": {
      "current_crediting_period_duration": {
        "type": "integer",
        "x-cdop-field-id": 161,
        "x-cdop-field-path": "project.crediting period[].current_crediting_period_duration"
      }
    },
    "required": []
  }
}
```

The second is a key with an embedded space inside a snake_case name:

```json
"x-cdop-field-path": "cobenefits.cobenefit_target[].overview_of_the_projects_approach_to_ track_and_quantify"
```

`Crediting_Period.schema.json` does not carry the spaced group at all; its `project` has only `crediting_period`. The upstream example `crediting_period.json` puts `current_crediting_period_duration` directly on `project`, matching neither schema.

**Impact.** Spaces are valid in JSON property names, but require quoted or mapped access in many client languages, and some code generators reject or rename such keys. Two groups for one concept invite divergent documents.

**What the reference API does.** The spaced `"crediting period"` group is never emitted. The duration is carried by the API's own crediting-period data (`duration_years`). In `cdop/co-benefits` and `cdop/full-list` documents the co-benefit key is emitted exactly as the schema spells it, embedded space included, so the document validates. `pnpm cdop:lint` reports both under rule `key-format`.

**Proposal.** Merge field 161 into `crediting_period[]` and rename the co-benefit key to `overview_of_the_projects_approach_to_track_and_quantify`. Add a generator check that every property name matches `^[a-z][a-z0-9_]*$`.

---

## CDOP-FB-003: `unit.credit_blockblock_start` is mangled and required

|                   |                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| File / field path | `schemas/v2/Full_List.schema.json`: `unit.credit_blockblock_start` (field 152), `unit.credit_block[]` |
| Category          | defect                                                                                                |
| Status            | fixed; adopted v2.1.0                                                                                 |

**Recheck (13 November 2026).** The projection now uses `credit_block[].block_start`. The malformed `credit_blockblock_start` output has been removed.

**Recheck (20 October 2026).** Fixed upstream by the 16 October regeneration. Full List field 152 is now `unit.credit_block[].block_start`, required beside `block_end` and `quantity`; `credit_blockblock_start` is absent from both properties and `unit.required`. Both Round 2 branches also have the corrected block path. The reference API still uses its pinned September schema and workaround.

**Observation.** In Full List the credit block's `block_start` has escaped from `credit_block[]` onto the `unit` object under a concatenated name, and it is required there:

```json
"unit": {
  "type": "object",
  "required": ["credit_blockblock_start", "owner_account_id"],
  "properties": {
    "credit_block": { "type": "array", "items": { "properties": { "quantity": {}, "block_end": {} } } },
    "credit_blockblock_start": {
      "type": "integer",
      "description": "Number indicating the first unit within a credit block",
      "x-cdop-field-id": 152,
      "x-cdop-field-path": "unit.credit_block[]block_start"
    }
  }
}
```

The field path `unit.credit_block[]block_start` is missing the dot, which is the root cause. `Unit_Description.schema.json` is correct: `credit_block[]` items require `block_end`, `block_start` and `quantity`, and there is no `credit_blockblock_start`.

**Impact.** A Full List document cannot describe a block range without a mangled key, and a Unit Description document and a Full List document disagree about where `block_start` lives.

**What the reference API does.** Emits `credit_block[]` with `block_start`, `block_end` and `quantity` in every unit document, and also emits `credit_blockblock_start` (equal to the block's start) in Full List so the document validates. The HAL unit resource exposes only the clean fields. `pnpm cdop:lint` flags it under `key-mangled`.

**Proposal.** Fix the path in the source workbook (`unit.credit_block[].block_start`), regenerate, and drop `credit_blockblock_start` from `required`.

---

## CDOP-FB-004: Published examples do not validate against the published schemas

|                   |                                                                                                                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `examples/v2/full_list.json`, `unit_description.json`, `co_benefits.json`, `project_finance.json` against the matching schemas (four of the eleven examples fail; seven pass, but `additionalProperties: true` hides wrong shapes in some, see CDOP-FB-026) |
| Category          | defect                                                                                                                                                                                                                                                      |
| Status            | fixed in v2.1.0                                                                                                                                                                                                                                             |

**Recheck (13 November 2026).** All twelve published examples validate against their corresponding v2.1.0 schemas, including the new Labels & Certifications example. The schema package tests require this, and upstream now runs example validation. Newer Round 2 attachment issues are recorded separately in the November review.

**Recheck (20 October 2026).** Still present. Fresh validation of published `main` gives the same four failing examples: Full List (7 errors), Unit Description (1), Co-Benefits (27), Project Finance (17). The other seven pass, with the same permissive-shape caveat. Examples are unchanged, and the generation workflow still does not invoke example validation.

**Observation.** The examples use flat scalars and parallel arrays where the schemas define arrays of objects. `unit_description.json`:

```json
"unit": {
  "metric": "tCO2e",
  "owner_account_id": "VCS-ACC-00183722",
  "serial_number": "8339-449183249-449183748-VCS-VCU-4721-VCS-KEN-14-2023-01012023-31122023-0",
  "status": "Retired",
  "status_reason": [],
  "type": "VCU",
  "quantity": 500,
  "block_start": 449183249,
  "block_end": 449183748
}
```

The schema defines `status[]` (objects with `status`, `status_reason`, `is_current`), `reference[]` (`serial_number`), `descriptor[]` (`metric`, `type`) and `credit_block[]`; Ajv reports `/unit/status must be array`. `full_list.json` fails on missing `agreement`, `cobenefits` and `project.compliance_market_id`, all required by the generated schema. `co_benefits.json` uses SDG strings and free-text `cobenefits_type` values that are not in the enum lists. `project_finance.json` uses `financing_options` values outside the enum. `estimations.json` and `crediting_period.json` use flat parallel arrays and a scalar `validation_id` where the schema has `vintage_mitigation[]`, `monitoring[]` and `validation.validation[]`, yet they validate: the mismatched keys are simply ignored because every object allows additional properties. That silent pass is the same problem from the other side.

**Impact.** Implementers who start from the examples build the wrong shape. There is no upstream test that would catch this.

**What the reference API does.** `packages/cdop-schemas/test/schemas.test.ts` asserts that exactly these four examples fail validation and that the other seven pass, so the defect is visible in CI and the register stays honest when upstream fixes an example. `POST /v2/validate?schema=<pod>` reproduces the Ajv errors for anyone who submits an upstream example. Documents produced by the API validate, with the exceptions recorded in this register.

**Proposal.** Add a validation step to the upstream generation pipeline that runs every example against its schema. Regenerate the examples from a single conformant source.

---

## CDOP-FB-005: Mechanically derived `Full_List.required` overconstrains project documents

|                   |                                                                             |
| ----------------- | --------------------------------------------------------------------------- |
| File / field path | `schemas/v2/Full_List.schema.json`: top-level `required`; `unit`, `vintage` |
| Category          | defect                                                                      |
| Status            | open, not yet raised upstream                                               |

**Recheck (20 October 2026).** Still present, with narrower wording. The nine top-level required entities are unchanged, including financial agreement, co-benefit, unit and vintage sections even when a project has no such data. `unit` and `vintage` remain single objects. This constrains project documents; it does not make every possible document invalid, and `credit_block[]` itself can carry multiple blocks. Fast track adds three more required entities and a single verification object.

**Observation.** The top level of Full List requires nine entities:

```json
"required": ["agreement", "cobenefits", "estimations", "geolocation_file", "project", "project_stakeholder", "unit", "validation", "vintage"]
```

The list appears to be derived from "has a nested required field" rather than from cardinality: `agreement` is required because `agreement_type` is; `cobenefits` because two of its fields are; `unit` and `vintage` because their fields are. `unit` and `vintage` are single objects, not arrays:

```json
"vintage": { "type": "object", "properties": { "vintage": { "type": "string", "format": "date" } }, "required": ["vintage"] }
```

So a valid Full List must contain unit and vintage objects, an agreement with an agreement type, and non-empty SDG and assessment-method lists. A project with no financial agreement cannot omit that section. Several credit blocks can be carried inside `unit.credit_block[]`, but the schema does not provide an array of independently associated unit/vintage records (see CDOP-FB-016).

**Impact.** Full List forces sections that do not apply to every project and leaves the association of multiple units and vintages unclear. A per-unit document is easier to interpret, but the mandatory agreement and co-benefit sections still constrain it.

**What the reference API does.** Sections with no data are omitted by default, which makes the default Full List fail upstream `required` for most projects; the API says so in the conformance report rather than fabricating data. `?strict=1` emits empty-but-valid placeholders where the schema allows one and sets `X-CDOP-Conformance` to explain each placeholder. The `unit` and `vintage` sections are emitted only in per-unit documents (`/v2/units/{id}/cdop/full-list`) or when `?unit_id=` is given on the project document. `pnpm cdop:lint` reports the derivation under `required-derived`.

**Proposal.** Derive `required` from `x-cdop-cardinality` (`1..1` and `1..*`) at each level, never from nested requireds. Make `unit` and `vintage` arrays, or remove them from the project-level document and keep them in Unit Description.

---

## CDOP-FB-006: Enum typo `Verificed Carbon Standard (VCS)`

|                   |                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `schemas/v2/Full_List.schema.json` and `Project_Approach_Details.schema.json`: `crediting_program.standard[].standard_name` (field 46) |
| Category          | defect                                                                                                                                 |
| Status            | fixed in v2.1.0                                                                                                                        |

**Recheck (13 November 2026).** The published enum now spells `Verified Carbon Standard (VCS)` correctly. The seed vocabulary and projection use that spelling.

**Recheck (20 October 2026).** Still present. Both Full List and Project Approach & Details retain the exact enum value `Verificed Carbon Standard (VCS)`. Key normalisation did not correct enum spellings.

**Observation.**

```json
"standard_name": {
  "enum": ["American Carbon Registry (ACR) Standard", "ART-TREES Standard", "…", "Puro Standard", "Verificed Carbon Standard (VCS)", "Woodland Carbon Code"]
}
```

The upstream example `project_approach_and_details.json` uses the misspelt value, which confirms it is the wire contract today.

**Impact.** Every implementer must ship the typo. Fixing it later is a breaking change for documents already produced.

**What the reference API does.** Emits the value verbatim in CDOP documents so they validate. The `standard` table holds the exact CDOP string as `cdop_name` and a clean `short_code` for display.

**Proposal.** Correct the value to `Verified Carbon Standard (VCS)` in the next minor release and state in the release notes that validators should accept both spellings for one version.

---

## CDOP-FB-007: `x-cdop-*` annotation values are inconsistent

|                   |                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| File / field path | all pods: `x-cdop-mutability`, `x-cdop-public-private`, `x-cdop-data-source`, `x-cdop-pre-issuance-inclusion` |
| Category          | defect                                                                                                        |
| Status            | open, not yet raised upstream                                                                                 |

**Recheck (20 October 2026).** Still present. Annotation counts are unchanged: 23 `Public` values under mutability, 9 `Immutable` and 14 `Mutable` values under public/private, mixed casing, 15 data-source spellings, and no `x-cdop-required-optional`. The generator fix normalises property paths, not these annotations.

**Observation.** Counting distinct values across `schemas/v2/*.json`:

| Annotation                      | Values seen (count)                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `x-cdop-mutability`             | `Immutable` (115), `Mutable` (200), `immutable` (86), `mutable` (96), `Public` (23)                   |
| `x-cdop-public-private`         | `Public` (379), `Private` (32), `public` (44), `private` (42), `Immutable` (9), `Mutable` (14)        |
| `x-cdop-pre-issuance-inclusion` | `Yes` (280), `yes` (172), `No` (68)                                                                   |
| `x-cdop-data-source`            | 15 spellings, including `project developer` (208), `Project developer` (90), `Project Developer` (30) |

`Public` under mutability and `Immutable`/`Mutable` under public-private show two columns swapped for some rows. The `x-cdop-required-optional` annotation does not appear in v2.0 at all.

**Impact.** Tooling cannot filter on these annotations without normalising. The mutability annotation, which Rethink asked to have restored, is unreliable where it is present.

**What the reference API does.** Registers all nine `x-cdop-*` keywords as an Ajv vocabulary so validation ignores their values. The field registry stores them as published. `pnpm cdop:lint` reports every value that is spelled more than one way under `annotation-casing`.

**Proposal.** Define each annotation as an enum in the generator (`immutable | mutable`, `public | private`, `yes | no`) and fail generation on any other value. Restore `x-cdop-required-optional` or state that `required` replaces it.

---

## CDOP-FB-008: `project.activity_type` has no enumeration

|                   |                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| File / field path | `schemas/v2/Full_List.schema.json`: `project.activity_type` (field 61); `schemas/v2/unmatched_enum_fields.csv` |
| Category          | defect                                                                                                         |
| Status            | open, not yet raised upstream                                                                                  |

**Recheck (20 October 2026).** Still present. `project.activity_type` is a string without an enum, and `unmatched_enum_fields.csv` still lists `project,activity_type`.

**Observation.** The field is a plain string whose description says "specify which type of project the activity is", and the generator's own report lists it as an enum it could not resolve:

```
associated_entity,field_name
project,activity_type
```

**Impact.** Two implementations will use two vocabularies.

**What the reference API does.** Stores and emits free text (`project.activity_type`).

**Proposal.** Publish the list (or reuse `mitigation[].project_type`), or remove the CSV from the release so the field is documented as free text.

---

## CDOP-FB-009: `agreement.project_financing_stage` typos and duplication

|                   |                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| File / field path | `schemas/v2/Full_List.schema.json` and `Project_Finance.schema.json`: `agreement.project_financing_stage` (field 230) |
| Category          | defect                                                                                                                |
| Status            | open, not yet raised upstream                                                                                         |

**Recheck (20 October 2026).** Still present. Full List and Project Finance still use `Pre-feasability` and `Feasability`; the separate project-status enum uses the correct spellings. The duplicated vocabulary is unchanged.

**Observation.**

```json
"project_financing_stage": {
  "enum": ["Origination", "Pre-feasability", "Feasability", "Project design drafting", "Project design finalization", "Listed", "Validation", "Validated", "Registered", "Approved", "Authorized", "Verified and issuing"]
}
```

The list is the first twelve values of `project.status[].project_status` (field 66), with two misspellings (`Pre-feasibility` and `Feasibility` upstream).

**Impact.** The same concept has two spellings in one document. A financing stage that lags or leads the project status is not expressible without inconsistency.

**What the reference API does.** Stores `financing_stage` as text and emits it verbatim.

**Proposal.** Fix the spelling. Better, reference the `project_status` enum rather than copying it, or replace the field with a date-stamped status record on the agreement.

---

## CDOP-FB-010: Three overlapping project identifiers and an unspecified URN

|                   |                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `project.project_id_type` (55), `project.project_id` (56), `project.project_identifier` (87), `project.current_registry_project_id` (139); `issuance.issuance[].batch_identifier` (93) |
| Category          | ambiguity                                                                                                                                                                              |
| Status            | proposal implemented                                                                                                                                                                   |

**Recheck (13 November 2026).** Proposal 0.1.0 uses a registry-independent UUID and separate registry/native identifiers. The registry-transfer fixture preserves the UUID. Assignment authority and cross-issuer deduplication remain open; this is an experimental implementation, not an upstream fix.

**Recheck (20 October 2026).** Still present. All three overlapping project identifier fields and `project_id_type` remain. No `pattern` or authority rule was added for `project_identifier` or `batch_identifier`; examples still use country-keyed `cdop:KEN:...` values.

**Observation.** The schema carries three identifiers for one project:

```json
"project_id_type":             { "description": "The type of project id (e.g., registry id, universally unique identifier id)" },
"project_id":                  { "description": "The project's identification code." },
"project_identifier":          { "description": "Global unique identifier for the project" },
"current_registry_project_id": { "description": "Identifier used to track the project in the current registry." }
```

The examples show a URN for the global identifier and a batch suffix for issuances, keyed by country:

```json
"project_identifier": "cdop:KEN:VCS-4721"
"batch_identifier":   "cdop:KEN:VCS-4721:B1"
```

No grammar for the URN is published. A country is not an identifier authority: one registry issues ids across many countries, and a project can move registries but not countries.

**Impact.** Two systems will mint different global identifiers for the same project, which defeats the purpose of a global identifier.

**What the reference API does.** Treats `project_identifier` as a URN with the grammar `cdop:<registry-slug>:<native-id>[:<batch>]`, where the registry slug is the authority (table `cdop.registry`, one slug per CDOP registry name). `current_registry_project_id` is the native id. `project_id`/`project_id_type` mirror the native id with type `current registry project id`. Any URN resolves at `/v2/identifiers/{urn}` with a 303 to the project or issuance. See `docs/api-profile.md`.

**Proposal.** Specify the URN grammar and its authority in the schema (a `pattern` on field 87), define `batch_identifier` in terms of it, and collapse `project_id`/`project_id_type` into `current_registry_project_id`.

---

## CDOP-FB-011: Integer identifiers

|                   |                                                                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `validation.validation[].validation_id` (154), `validation.event[].validation_id` (170), `estimations.estimation_event[].estimation_id` (162), `registry.previous[].previous_project_registration_id` (132) |
| Category          | ambiguity                                                                                                                                                                                                   |
| Status            | open, not yet raised upstream                                                                                                                                                                               |

**Recheck (20 October 2026).** Still present. Fields 132, 154, 162 and 170 remain integers. Fast track still adds integer registry, original-registry, program and validation-event identifiers; its verification identifier is a string.

**Observation.** Four identifier fields are typed `integer`:

```json
"validation_id": { "type": "integer", "x-cdop-field-id": 154, "x-cdop-cardinality": "1..1" }
```

The examples use `1`. Nothing says whether the integer is global, per project, or per document.

**Impact.** Registry identifiers are strings in practice (`VCS-4721`, `WCC-…`). An integer cannot carry a registry's native id, and an unscoped small integer cannot join two documents.

**What the reference API does.** All API identifiers are strings (opaque prefixed ULIDs such as `val_…`, `est_…`). In schema-pure documents the API emits the record's per-project `sequence` (an integer, starting at 1) for these fields so the document validates; the string id is in the HAL resource and its links. `pnpm cdop:lint` reports them under `identifier-integer`.

**Proposal.** Type every identifier as `string`. Where a link between records is intended, name the target (`validation_id` on a crediting period should reference `validation.event[].validation_id`).

---

## CDOP-FB-012: Three unit-status vocabularies

|                   |                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| File / field path | `unit.status[].status` (146); the CDOP wiki unit state machine; the CAD Trust unit status picklist |
| Category          | ambiguity                                                                                          |
| Status            | proposal implemented                                                                               |

**Recheck (13 November 2026).** Proposal 0.1.0 uses seven canonical unit states and separate reasons, with ordered from/to history. The vocabulary remains for TWG review.

**Recheck (20 October 2026).** Still present in the schema. The seven-value unit-status enum, including `Pending Transfer`, `Accepted Pending Payment` and `Deposited Released`, is unchanged. No state/reason/event separation was added. External wiki and CAD Trust lists were not independently rechecked in this audit.

**Observation.** The schema enum:

```json
"status": { "enum": ["Retired", "Active", "Cancelled", "On Hold", "Pending Transfer", "Accepted Pending Payment", "Deposited Released"] }
```

`Pending Transfer` and `Accepted Pending Payment` are reasons for a hold, not states. `Transferred` (used by the wiki) is an event, not a state. `Deposited Released` names two different buffer-pool states. The CDOP wiki state machine and the CAD Trust picklist use different lists again.

**Impact.** A consumer cannot tell whether a block is transferable from its status alone, and cannot reconcile a registry feed with a CAD Trust feed.

**What the reference API does.** Keeps a canonical machine of seven states, `pending`, `active`, `on_hold`, `buffer`, `retired`, `cancelled`, `expired`, plus `state_reason` (`pending_transfer`, `accepted_pending_payment`, `registry_hold`, `conversion`, and so on). The CDOP value is a projection (`cdopUnitStatus()` in `apps/api/src/domain/lifecycle/units.ts`) and the registry's native status is kept alongside. The CAD Trust cross-walk is published with the machine. See `docs/api-profile.md`.

**Proposal.** Separate states from reasons and events: a short `status` enum, a `status_reason` enum, and an event log. Split `Deposited Released` into a buffer state and a release event.

---

## CDOP-FB-013: `project_status` conflates funnel stages, authorisation and activity

|                   |                                        |
| ----------------- | -------------------------------------- |
| File / field path | `project.status[].project_status` (66) |
| Category          | ambiguity                              |
| Status            | proposal implemented                   |

**Recheck (13 November 2026).** Proposal 0.1.0 exposes the API’s eight lifecycle stages separately from native status, hold and unreported authorization. This is a candidate vocabulary, not a claim of TWG agreement.

**Recheck (20 October 2026).** Still present. The same 17 project-status values mix development stages, authorisation and activity. There is no separate lifecycle/authorisation model in the published schemas.

**Observation.** The enum has 17 values:

```json
"enum": ["Origination", "Pre-feasibility", "Feasibility", "Project design drafting", "Project design finalization", "Listed", "Validation", "Validated", "Registered", "Approved", "Authorized", "Verified and issuing", "Completed", "Withdrawn", "De-registered", "Inactive", "Rejected"]
```

Five are developer-side funnel stages before a registry is involved. `Approved` and `Authorized` describe Article 6 host-country steps, which are orthogonal to the registry lifecycle. `Inactive` is an activity flag. The order `Validated` then `Registered` matches Verra, but the UK codes register first and validate later.

**Impact.** The same project is reported at different points of the enum by different registries, and comparisons across registries are wrong.

**What the reference API does.** Every project carries three values. `registry_status {code, vocabulary}` is the native code. The CDOP `status` record is projected from it. `lifecycle_stage` is a normalised enum of eight values: `draft, listed, registered, validated, verified, retired, withdrawn, rejected`. `is_on_hold` is an orthogonal flag. The mapping tables for CDOP's 17 values, CAD Trust's 9, and the WCC and Peatland Code native codes are in `docs/api-profile.md` and served at `/v2/state-machines/project`.

**Proposal.** Adopt a small normalised lifecycle enum in the schema, keep the registry's native code beside it, and move Article 6 authorisation and activity into their own fields.

---

## CDOP-FB-014: `issuance_status` mixes a precondition with process states

|                   |                                             |
| ----------------- | ------------------------------------------- |
| File / field path | `issuance.issuance[].issuance_status` (101) |
| Category          | ambiguity                                   |
| Status            | proposal implemented                        |

**Recheck (13 November 2026).** Proposal 0.1.0 separates five issuance process states from verification. A completed ex-post/conversion issuance requires a reference to a completed verification. The ambiguous legacy `Verified` issuance value is rejected in this proposal.

**Recheck (20 October 2026).** Still present. The six issuance-status values still include `Verified`; no `verification_id` reference was added to the issuance object. The published example still uses `Verified` for dated issuances.

**Observation.**

```json
"issuance_status": { "enum": ["Verified", "Pending Issuance", "Issuing", "Pre-issuance", "Failed", "Complete"] }
```

`Verified` describes the verification that precedes an issuance, not the issuance itself. The upstream example marks completed, dated issuances as `"issuance_status": "Verified"`, so it is being used to mean `Complete`.

**Impact.** Two implementers will read `Verified` differently.

**What the reference API does.** Models the issuance machine as `Pre-issuance → Pending Issuance → Issuing → Complete | Failed`. Verification is the precondition: an issuance links to its `verification_event`. The API never emits `Verified` as an issuance status.

**Proposal.** Remove `Verified` from the enum and add a `verification_id` reference on the issuance record.

---

## CDOP-FB-015: Status records carry no timestamp, actor or sequence

|                   |                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `project.status[]` (66 to 68), `unit.status[]` (146 to 148), `estimations.status[]` (164 to 166), `agreement.funding_details[]` |
| Category          | ambiguity                                                                                                                       |
| Status            | proposal implemented                                                                                                            |

**Recheck (13 November 2026).** Proposal 0.1.0 includes event IDs, sequence, effective and recorded timestamps, actor, action, reason, from/to states and one current record, with semantic regression tests. Estimation and every other history type are not yet covered.

**Recheck (20 October 2026).** Still present. Project, unit and estimation status objects still contain only the status, reason and `is_current` fields. No timestamp, actor or sequence was added. Fast track verification status has the same history limitations.

**Observation.** A status record is three fields:

```json
"properties": { "project_status": {}, "project_status_reason": {}, "is_current": {} },
"required": ["is_current", "project_status"]
```

There is no `effective_at`, no `recorded_at`, no actor and no sequence number. The history is a bag, not a log. The same is true for unit and estimation status.

**Impact.** A consumer cannot order the history, cannot compute time-in-state, cannot detect a late correction, and cannot say who made the change.

**What the reference API does.** Every status record in the API has `sequence`, `effective_at` (business time), `recorded_at` (system time), `actor_kind`, `actor_account_id`, `action`, `intent`, `reason` and `event_id`. `/v2/projects/{id}/status-history` returns them newest first. Each append emits a CloudEvent `org.cdop.<entity>.status.changed`. Only `status`, `status_reason` and `is_current` are emitted in schema-pure documents.

**Proposal.** Add `effective_at` (`date-time`), `recorded_at` (`date-time`), `actor` and `sequence` to every status record, and define that `is_current` is derived from the latest `effective_at`.

---

## CDOP-FB-016: Parallel arrays without keys; scalars beside arrays

|                   |                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `estimations.estimation_event[]`, `estimations.vintage_mitigation[]`, `estimations.monitoring[]`, `estimations.estimation_event[].estimated_issuance_date[]`; `validation.validation_body_name`/`validation_date`/`validation_report` vs `validation.validation[]`/`validation.event[]`; `unit.descriptor[]`, `unit.reference[]`, `unit.status[]`, `unit.credit_block[]`, `unit.retirement[]` |
| Category          | ambiguity                                                                                                                                                                                                                                                                                                                                                                                     |
| Status            | open, not yet raised upstream                                                                                                                                                                                                                                                                                                                                                                 |

**Recheck (20 October 2026).** Still present. Estimation vintage, monitoring and event arrays remain separate, validation still mixes scalar fields with event arrays, and the unit still has five separate groups. Fixing the placement of `block_start` in 003 does not join these records.

**Observation.** Per-vintage estimation data is split across three arrays that correlate only by position:

```json
"vintage_mitigation": { "items": { "properties": { "vintage_year": {}, "estimated_vintage_emissions_mitigation": {} } } },
"monitoring":         { "items": { "properties": { "estimated_monitoring_period_start_date": {}, "estimated_monitoring_period_end_date": {} } } },
"estimation_event":   { "items": { "properties": { "estimation_id": {}, "estimation_event_date": {}, "estimated_issuance_date": { "type": "array" } } } }
```

`validation` has scalars (`validation_body_name` 84, `validation_date` 85, `validation_report` 86) beside two arrays (`validation[]` 154 to 157, `event[]` 170 to 171) with no key joining a body to an event. A single unit is spread over five one-element arrays (`descriptor`, `reference`, `status`, `credit_block`, `retirement`).

**Impact.** Arrays of different lengths are undetectable by the schema. A single unit document needs five arrays to say one thing.

**What the reference API does.** Stores one row per vintage (`estimation_vintage`, keyed by estimation and `vintage_start_on`) with all per-vintage values together, and one row per validation event. A unit resource is one credit block with scalar fields. In schema-pure documents the API emits the parallel arrays in the same order, and one-element arrays for a single unit.

**Proposal.** One object per vintage (`vintages[]` with year, mitigation, monitoring period, expected issuance date). Nest the validation scalars into `validation.event[]`. Flatten the unit arrays into scalars, with `status[]` the only history array.

---

## CDOP-FB-017: `geolocation_file` has no link, geometry or project reference

|                   |                                          |
| ----------------- | ---------------------------------------- |
| File / field path | `geolocation_file.location[]` (34 to 43) |
| Category          | ambiguity                                |
| Status            | open, not yet raised upstream            |

**Recheck (20 October 2026).** Still present. The location-file record still has no content URL, hash, inline geometry or project id. Its status/area/geometry enums are unchanged, and creation/edit/deletion strings still have no date-time format.

**Observation.** The record describes a file without a way to fetch it:

```json
"required": ["file_created_on", "file_format", "file_name", "file_status", "validity_start_date"],
"file_format":   { "enum": ["GeoJSON", "KML", "Shapefile"] },
"file_status":   { "enum": ["ACTIVE", "ARCHIVED", "ACQUIRED", "CANCELLED", "FAILED", "PLANNED", "POTENTIAL", "REJECTED"] },
"file_created_on": { "type": "string", "description": "Time stamp for when file was created" },
"area_type":     { "enum": ["Project Area", "Reference Area", "…", "Canopy Cover Height", "Biomass"] },
"geometry_type": { "enum": ["Polygon", "MultiPolygon"] }
```

There is no URL, hash or inline geometry, and no field naming the project (the pod relies on document context). `file_status` mixes lifecycle (`ACTIVE`, `ARCHIVED`) with acquisition (`ACQUIRED`, `PLANNED`, `POTENTIAL`). `area_type` includes raster products (`Canopy Cover Height`, `Biomass`) while `file_format` and `geometry_type` are vector-only. The "time stamp" fields have no `format`.

**Impact.** A consumer cannot obtain the boundary, which is the one thing most of them want from this section.

**What the reference API does.** Each `geolocation_file` row holds a real GeoJSON Feature (`geojson jsonb`, EPSG:4326), a bounding box, `area_ha` and a SHA-256. `/v2/projects/{id}/geolocation-files/{gid}/content` serves it as `application/geo+json`; the HAL resource links to it. The status enum is kept as published.

**Proposal.** Add `file_url` (`format: uri`), `content_hash`, `crs`, and optionally inline `geometry`. Split `file_status` into a lifecycle status and an acquisition status. Give raster products their own record type.

---

## CDOP-FB-018: Only `format: date` is used

|                   |                               |
| ----------------- | ----------------------------- |
| File / field path | all pods                      |
| Category          | ambiguity                     |
| Status            | open, not yet raised upstream |

**Recheck (20 October 2026).** Still present. Across all twelve published schemas, the only `format` is still `date` (56 occurrences); there are no `uri`, `email` or `date-time` formats. The Round 2 link fields are unchanged too.

**Observation.** Across the twelve schema files the only `format` value is `date` (56 occurrences). Fields that are plainly links, emails or timestamps are untyped strings, for example `project.project_design_document_link`, `project.current_registry_project_link`, `project.documents[].other_project_documentation_link`, `project.audits[].verification_report_url`, `issuance.issuance[].issuance_url`, `methodology.versions[].document`, `project_stakeholder.project_developer_website`, `project_stakeholder.project_developer_email`, and `geolocation_file.location[].file_created_on` ("Time stamp for when file was created").

**Impact.** Validators cannot catch a relative path in a link field or a date where a timestamp is expected.

**What the reference API does.** Emits absolute URLs and RFC 3339 timestamps in those fields. The API's own OpenAPI description types its fields with `uri`, `email`, `date` and `date-time`. `pnpm cdop:lint` reports the untyped fields under `missing-uri-format` and `missing-date-format`.

**Proposal.** Add `format: uri` to every `*_link`, `*_url`, `website` and `document` field, `format: email` to email fields, and `format: date-time` to the `*_on` timestamp fields in `geolocation_file`.

---

## CDOP-FB-019: Required and Private; no account entity

|                   |                                                                          |
| ----------------- | ------------------------------------------------------------------------ |
| File / field path | `unit.owner_account_id` (141), `unit.expected_carbon_credit_price` (206) |
| Category          | ambiguity                                                                |
| Status            | open, not yet raised upstream                                            |

**Recheck (20 October 2026).** Still present. `owner_account_id` is still JSON-required and Private, and no account entity was added. Expected price is Private and annotated `1..1`, but is not in `unit.required`; distinguish that annotation inconsistency from the enforceable owner-account requirement.

**Observation.** `owner_account_id` is required on `unit` in both Full List and Unit Description, and is marked Private:

```json
"owner_account_id": { "type": "string", "x-cdop-cardinality": "1..1", "x-cdop-mutability": "mutable", "x-cdop-public-private": "Private" }
```

`expected_carbon_credit_price` has cardinality `1..1` and is Private. No entity in the schema describes an account (who can hold units, on which registry, of what type).

**Impact.** A public unit document that omits private fields cannot validate. The concept the identifier points at does not exist in the protocol.

**What the reference API does.** Adds a registry account entity, `cdop.account`. It carries the registry, organisation, native account id, an account type from `project_developer` to `buffer_pool`, status, parent account, and `holdings_public` and `retirements_public` flags. Accounts are served at `/v2/accounts` (M2) and linked from every unit block as `cdop:owner-account`. The API emits the opaque account id in `owner_account_id`.

**Proposal.** Introduce required tiers (`x-cdop-required-tier`) so a Private field is never in the public `required` set, and add an `account` entity to the schema. See `docs/api-profile.md`.

---

## CDOP-FB-020: `compliance_market_id` required with `minItems: 1`

|                   |                                      |
| ----------------- | ------------------------------------ |
| File / field path | `project.compliance_market_id` (243) |
| Category          | ambiguity                            |
| Status            | fixed in v2.1.0                      |

**Recheck (13 November 2026).** `compliance_market_id` is optional. The API omits empty optional membership arrays; voluntary-market projects are no longer invalid solely because they lack compliance membership.

**Recheck (20 October 2026).** Still present. `compliance_market_id` remains in `project.required`, with `minItems: 1` and cardinality `1..*`, despite the description saying "if applicable". Neither draft relaxes this requirement.

**Observation.**

```json
"compliance_market_id": {
  "type": "array",
  "items": { "type": "string", "description": "The project's ID within the compliance scheme, if applicable.", "x-cdop-cardinality": "1..*" },
  "minItems": 1
}
```

`project.required` includes it. The description says "if applicable"; the schema says always.

**Impact.** Every voluntary-market project must invent a compliance id to produce a valid document.

**What the reference API does.** Emits `"compliance_market_id": []` when there is no compliance id, which fails the upstream `minItems: 1`. An empty list says "none" more plainly than a missing key. Strict mode cannot fabricate a valid placeholder without inventing an id, so `X-CDOP-Conformance` cites this entry (`ref=CDOP-FB-020`) instead. This one field is why no `full-list` or `labels-certifications` document validates for a voluntary-market project.

**Proposal.** Cardinality `0..*` and remove it from `required`.

---

## CDOP-FB-021: Three overlapping "standard" concepts

|                   |                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `crediting_program.crediting_program[]` (44 to 45), `crediting_program.standard[]` (46 to 47), `registry.current_registry` (83); field 242 at `carbon_crediting_standard.carbon_standard_level_accreditation` in `schemas/v2/Full_List.schema.json` and at `crediting_program.carbon_standard_level_accreditation` in `schemas/v2/Labels_Certifications.schema.json` |
| Category          | ambiguity                                                                                                                                                                                                                                                                                                                                                            |
| Status            | partly fixed in v2.1.0                                                                                                                                                                                                                                                                                                                                               |

**Recheck (13 November 2026).** Field 242 now consistently belongs to `crediting_program.carbon_standard_level_accreditation`, and the projection follows it. The broader distinction between program, standard and registry remains open.

**Recheck (20 October 2026).** Still present. Field 242 remains under `carbon_crediting_standard` in Full List and `crediting_program` in Labels & Certifications. It is now the only published field id with multiple paths: 152 and 161 were fixed in 003 and 002. The registry/program/standard vocabularies remain separate without a relationship table. Fast track still uses the older entity name in both files.

**Observation.** Programs (43 names), standards (19 names) and registries (35 names) are three flat enums with no stated relation, and a fourth entity, `carbon_crediting_standard`, contains a single field:

```json
"carbon_crediting_standard": { "type": "object", "properties": { "carbon_standard_level_accreditation": { "x-cdop-field-id": 242 } } }
```

Nothing says that `Woodland Carbon Code` (standard) is administered under a program and hosted on the UK Land Carbon Registry, or that Verra is both a program and a registry.

**Field 242 has two paths.** Upstream commit `2ec8c2b` (1 September 2026) renamed the Labels & Certifications entity from `carbon_crediting_standard` to `crediting_program` and left Full List as it was. At the pinned commit the field has the same id, enum and other annotations in both files, but a different parent. In `Full_List.schema.json`:

```json
"carbon_crediting_standard": { "type": "object", "properties": { "carbon_standard_level_accreditation": { "x-cdop-field-id": 242, "x-cdop-field-path": "carbon_crediting_standard.carbon_standard_level_accreditation" } } }
```

In `Labels_Certifications.schema.json`:

```json
"crediting_program": { "type": "object", "properties": { "carbon_standard_level_accreditation": { "x-cdop-field-id": 242, "x-cdop-field-path": "crediting_program.carbon_standard_level_accreditation" } } }
```

So `crediting_program` now means two things: in Full List it holds the program, standard and standard version fields (44 to 49); in Labels & Certifications it holds only the accreditation. Across the twelve files, 242 is one of three field ids with more than one `x-cdop-field-path`. The other two, 152 and 161, are the mangled keys in CDOP-FB-003 and CDOP-FB-002; 242 is the only one where both paths are well formed.

**Impact.** Consumers cannot join documents across the three lists, and the fourth entity is a naming trap. The split makes the trap concrete: a consumer that reads field 242 by path finds it in one document type and not the other, and a producer that builds a pod as a subset of Full List drops it with no validation error, because the field is `0..1` and in no `required` list.

**What the reference API does.** Keeps normative tables with foreign keys: `registry`, `crediting_program`, `standard` (with its program and registry), `standard_version`. They are served at `/v2/reference/*` and exposed per project as the `cdop:registry` and `cdop:crediting-program` facets.

Pods are built as the Full List pruned to the keys each pod's schema declares (`buildPodDocument` in `apps/api/src/domain/projection/cdop.ts`). Pruning alone would drop field 242 from Labels & Certifications, because the Full List carries it under a key that pod does not declare. So after pruning, any field the pod declares at a different path from Full List is matched by `x-cdop-field-id` and copied to the pod's path. Each document follows its own schema: `cdop/full-list` carries `"carbon_crediting_standard": { "carbon_standard_level_accreditation": "ICVCM" }` and `cdop/labels-certifications` carries `"crediting_program": { "carbon_standard_level_accreditation": "ICVCM" }`. The step skips paths that cross an array, so fields 152 and 161 stay as CDOP-FB-002 and CDOP-FB-003 describe, and it does nothing once upstream gives each field one path. A conformance test checks that the two documents agree for every seeded project, since schema validation cannot catch the loss.

**Proposal.** Publish one reference table relating registry, program and standard (with slugs), reference it from the enums, and rename `carbon_crediting_standard` to what it holds (standard-level accreditation) or fold it into `labels`. Whichever name is chosen, give field 242 one path in every file. The smallest change is to apply the 1 September rename to Full List too, which puts the accreditation under `crediting_program` beside fields 44 to 49 and retires `carbon_crediting_standard`. A generator check that each `x-cdop-field-id` has exactly one `x-cdop-field-path` across all files would catch this class of drift, and would also have caught CDOP-FB-002 and CDOP-FB-003.

---

## CDOP-FB-022: `methodology` is a 496-value enum with embedded prefixes

|                   |                                           |
| ----------------- | ----------------------------------------- |
| File / field path | `methodology.versions[].methodology` (50) |
| Category          | ambiguity                                 |
| Status            | open, not yet raised upstream             |

**Recheck (20 October 2026).** Still present. The methodology field remains a 496-value string enum with embedded program prefixes and a separate free-text version. No external reference-list model was added.

**Observation.** The enum has 496 strings such as `ACR - Afforestation and Reforestation of Degraded Lands` and `VCS - VM0033`. The program is embedded in the string with a `-` separator, and the version is a separate free-text field.

**Impact.** Every new or renamed methodology is a schema release. Matching a registry's methodology code requires parsing the string.

**What the reference API does.** Keeps `methodology` (exact CDOP name, `code`, `title`, `standard_id`) and `methodology_version` (`version`, `document_url`, `effective_on`, `is_current`) tables and emits the CDOP string verbatim. Served per project as `cdop:methodologies`.

**Proposal.** A structured object `{ program, code, title, version, document }` and a methodology reference list maintained outside the schema release cycle.

---

## CDOP-FB-023: `buffer_pool[]` totals without dates

|                   |                                      |
| ----------------- | ------------------------------------ |
| File / field path | `project.buffer_pool[]` (196 to 199) |
| Category          | ambiguity                            |
| Status            | open, not yet raised upstream        |

**Recheck (20 October 2026).** Still present. `project.buffer_pool[]` still has only four required aggregate integers, with no date or issuance reference. Fast track has a per-verification buffer deduction, but does not resolve the aggregate history ambiguity.

**Observation.** The record is four required integers, all lifetime aggregates:

```json
"required": ["buffer_pool_deposits", "buffer_pool_release", "buffer_pool_reversal_coverage", "buffer_pool_reversal_non_coverage"]
```

No `as_of` date, no per-issuance breakdown, and the array can hold several rows with nothing to distinguish them.

**Impact.** Two snapshots of the same project cannot be ordered or reconciled. Reversal coverage cannot be tied to the event that caused it.

**What the reference API does.** Keeps a buffer-pool ledger (`buffer_pool_entry`: kind `deposit`, `release`, `reversal_coverage`, `reversal_non_coverage`, `cancellation`; quantity; `occurred_on`; the block and verification involved) and a `buffer_pool_balance` view that produces the four CDOP totals. Served as the `cdop:buffer-pool` facet.

**Proposal.** Either make `buffer_pool[]` a dated ledger of entries, or keep the totals and add `as_of` and `issuance_id`.

---

## CDOP-FB-024: `project_risk` is JSON in a string

|                   |                               |
| ----------------- | ----------------------------- |
| File / field path | `project.project_risk` (200)  |
| Category          | ambiguity                     |
| Status            | open, not yet raised upstream |

**Recheck (20 October 2026).** Still present. `project_risk` is still a string explicitly described as a JSON dictionary stored as a string; the example is unchanged.

**Observation.** The field is typed `string` and its description says "Implemented as a JSON format dictionary and stored as a string". The example `durability_permanence.json` contains an escaped JSON document of about 4 KB inside the string.

**Impact.** Validators cannot inspect it, and every consumer must parse twice.

**What the reference API does.** Stores the value as a `jsonb` object, exposes it as an object in the HAL resource, and encodes it as a JSON string in schema-pure documents so they validate.

**Proposal.** `type: object` with the five recommended top-level keys as optional properties, and `additionalProperties: true` inside them for experimentation.

---

## CDOP-FB-025: `unit.descriptor[].type` lacks WCU and PCU; `"VER, CER"` is two values

|                   |                                |
| ----------------- | ------------------------------ |
| File / field path | `unit.descriptor[].type` (149) |
| Category          | ambiguity                      |
| Status            | open, not yet raised upstream  |

**Recheck (20 October 2026).** Still present. The 15-value unit-type enum includes PIU but neither WCU nor PCU, and retains the joined values `VER, CER` and `A6.4 ER, MCU`.

**Observation.**

```json
"type": { "enum": ["ERT", "TREES Credit", "VCC", "CRT", "CER", "CFC", "ACC", "VER, CER", "Isometric credit", "JCM", "A6.4 ER, MCU", "PVC", "CORC", "VCU", "PIU"] }
```

`PIU` (the UK codes' pending unit) is present but the verified units it converts into, `WCU` (Woodland Carbon Unit) and `PCU` (Peatland Carbon Unit), are not. `"VER, CER"` and `"A6.4 ER, MCU"` each list two unit types in one value.

**Impact.** A verified UK unit cannot be described. A consumer cannot filter Gold Standard units by type.

**What the reference API does.** The ledger stores the registry's own unit type (`PIU`, `WCU`, `PCU`, `VCU`, and so on) and emits it verbatim; for WCU and PCU the conformance report flags the enum failure. The decision on how to project WCU and PCU is pending the TWG's answer.

**Proposal.** Add `WCU` and `PCU`, split the comma-joined values, and allow more than one `descriptor[]` entry where a program issues several unit types.

---

## CDOP-FB-026: `additionalProperties: true` everywhere

|                   |                               |
| ----------------- | ----------------------------- |
| File / field path | all pods (141 occurrences)    |
| Category          | ambiguity                     |
| Status            | open, not yet raised upstream |

**Recheck (20 October 2026).** Still present. Every object on published `main` still sets `additionalProperties: true`. The current count is 140, down from 141 because 002 merged the duplicate crediting-period group. There is no strict profile or extension-key convention. The draft counts remain 159 (standard track) and 187 (fast track).

**Observation.** Every object in every pod sets `additionalProperties: true`. A document with `projet_name` instead of `project_name` validates as long as the required keys are present.

**Impact.** Validation catches missing required keys and enum values, but not typos, extensions that collide with future fields, or stale field names after a rename.

**What the reference API does.** Validates against the schemas as published. The field registry (`/v2/reference`, MCP `explain_schema`) lists every known path so a client can check its keys. A strict validation profile is proposed, not built.

**Proposal.** Publish a strict profile of each pod (`additionalProperties: false`, or `unevaluatedProperties: false`) alongside the permissive one, and reserve an `x-` or `ext_` prefix for extensions.

---

## CDOP-FB-027: No API conventions

|                   |                               |
| ----------------- | ----------------------------- |
| File / field path | n/a                           |
| Category          | api-gap                       |
| Status            | open, not yet raised upstream |

**Recheck (20 October 2026).** Still present as an API-profile gap. The upstream document schemas, README and API-relevant documentation have not changed since the implementation snapshot. No synchronisation, pagination, change-feed or companion API profile was added.

**Observation.** The schema describes documents. It says nothing about `modified_at`, versions, ETags, deletion semantics, pagination, change feeds, link formats, error formats or authentication. Two conformant CDOP servers could be impossible to synchronise with the same client.

**Impact.** Interoperability stops at the document boundary.

**What the reference API does.** Implements a profile and documents it in `docs/api-profile.md`. It covers string identifiers and the URN grammar, `created_at`/`modified_at`/`version` with ETags, cursor pagination and `modified_since`. It also covers CloudEvents with `org.cdop.<entity>.status.changed` for every status append, HAL links with documented relations, and RFC 9457 problems.

**Proposal.** Adopt a "CDOP API profile" companion specification maintained with the schema. The document in this repository is offered as the starting draft.

---

## CDOP-FB-028: The UK codes are missing from the program and methodology enums

|                   |                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `crediting_program.crediting_program[].crediting_program_name` (44), `crediting_program.standard[].standard_name` (46), `methodology.versions[].methodology` (50) |
| Category          | defect                                                                                                                                                            |
| Status            | open, not yet raised upstream                                                                                                                                     |

**Recheck (20 October 2026).** Still present. The standard enum still includes both UK codes, the program enum has no Woodland Carbon Code entry, and the 496-value methodology enum has neither UK calculator. Correction: the program and methodology sections are optional in Project Approach & Details. A producer may omit them, but supplying the real UK values still fails enum validation. Historical synthetic-project failure counts were not rerun.

**Observation.** The standard enum (19 values) includes both UK codes:

```json
"standard_name": { "enum": ["…", "Peatland Code", "…", "Woodland Carbon Code"] }
```

The crediting program enum (43 values) has a program for one of them only. It lists `IUCN UK Peatland Programme` and nothing under which the Woodland Carbon Code sits. The methodology enum (496 values) has no entry for either code: no value matches the Woodland Carbon Code carbon calculation spreadsheet or the Peatland Code emissions calculator.

**Impact.** A Woodland Carbon Code project can name its standard but not its program. No UK project can name its methodology. `crediting_program` and `methodology` are optional sections of Project Approach & Details, but supplying the actual UK program and methodology values fails its enum validation and Full List validation. Omitting those values avoids the enum error while losing the information. Found by the conformance sweep: 300 of 300 UK projects fail, 200 of 200 projects under the other five standards pass.

**What the reference API does.** Emits the real names (`Woodland Carbon Code`; `WCC - Carbon Calculation Spreadsheet`; `Peatland Code - Emissions Calculator`) and lets the document fail. It does not substitute a nearby enum value, because that would misstate the project. `X-CDOP-Conformance` cites this entry. The names follow the enum's own `<program prefix> - <title>` pattern so they can be adopted as they stand.

**Proposal.** Add `Woodland Carbon Code` to the crediting program enum (or state which program administers it) and add the two methodology values. More generally, see CDOP-FB-021 and CDOP-FB-022: a reference table relating registry, program, standard and methodology would make this class of gap visible when the list is edited.

---

## CDOP-FB-029: `unit_level[]` requires an accreditation and a compliance eligibility on every entry

|                   |                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| File / field path | `unit.unit_level[]` (253 to 260), `carbon_crediting_standard.carbon_standard_level_accreditation` (242) |
| Category          | defect                                                                                                  |
| Status            | open, not yet raised upstream                                                                           |

**Recheck (20 October 2026).** Still present. Every `unit_level[]` entry still requires all eight accreditation and compliance fields, and accreditation still has only `CCP` as its allowed value. Standard-level CORSIA values say `approved`; unit-level values say `scope`. No split or optional expiry was introduced.

**Observation.** Each `unit_level[]` entry requires all eight of its fields:

```json
"required": ["unit_level_accreditation", "unit_level_accreditation_expiry_date", "unit_level_accreditation_id", "unit_level_accreditation_start_date", "unit_level_accreditation_website", "unit_level_compliance_approval_date", "unit_level_compliance_eligibility", "unit_level_compliance_potential_eligibility"]
```

`unit_level_accreditation` is a one-value enum, `["CCP"]`. So an entry must be a CCP accreditation and a compliance eligibility and a potential compliance eligibility, all at once. `project.project_level[]` has the same shape but requires only four of its fields, so the two levels disagree.

The same CORSIA phases are also spelled differently at the two levels:

```json
"carbon_standard_level_accreditation":  ["…", "CORSIA First Phase approved (2024-2026)", "…"]
"unit_level_compliance_eligibility":    ["…", "CORSIA First Phase scope (2024-2026)", "…"]
```

**Impact.** A unit that is CORSIA eligible but not CCP labelled cannot be described without claiming a CCP label it does not hold. A CCP-labelled unit with no compliance use cannot be described without inventing an eligibility. An accreditation with no expiry cannot be described at all. A client joining standard-level and unit-level CORSIA values on the string will find no matches.

**What the reference API does.** Emits one entry per label with only the half that applies: the accreditation fields for an accreditation (`CCP`), the eligibility fields for a compliance label (the CORSIA phases). Such an entry fails `required`, and `X-CDOP-Conformance` cites this entry. The API will not fill the other half, because a fabricated CCP label on a unit is a false quality claim, not a harmless placeholder. It maps the label's standard-level CORSIA wording to the unit-level wording on output.

**Proposal.** Split the entry into two arrays (`unit_level_accreditation[]`, `unit_level_compliance[]`), or require only the discriminating field of each half. Make expiry optional. Use one spelling for the CORSIA phases at every level.

---

## CDOP-FB-030: Two Round 2 branches give the same field ids to different fields

|                   |                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | Round 2 drafts: `Registry_Metadata`, `Validation_Metadata`, `Verification_Metadata` (261 to 330); `Additionality` on `R2P-ST-Testing` |
| Category          | defect                                                                                                                                |
| Status            | open, not yet raised upstream                                                                                                         |

**Recheck (20 October 2026).** Still present on the unmerged drafts. A fresh cross-branch field-id comparison finds the same 56 collisions within ids 261 to 325. For example, 261 means financial additionality cost breakdown on standard track and registry identifier on fast track. This has not yet become a collision on published `main`.

**Observation.** The fast track pods on `R2P-FT-Testing` number their fields from 261 (`registry_identifier`) to 330 (`is_current`). The Additionality draft on `R2P-ST-Testing` also numbers from 261 (`financial_additionality_project_cost_breakdown`). 56 ids, 261 to 325, name a different field on each branch.

**Impact.** A field id exists to identify one field across pods, files and versions. Merging both branches would give 56 ids two meanings, and a client keyed on ids (as this API's relocation of field 242 is, see CDOP-FB-021) would join unrelated fields.

**What the reference API does.** Vendors only the fast track pods, so its field registry has one field per id. It does not vendor the Additionality draft.

**Proposal.** Allocate field ids centrally in the source workbook before a pod is drafted, and add a generator check that fails when one id names two paths.

---

## CDOP-FB-031: No project identifier in Registry Metadata or Validation Metadata

|                   |                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------- |
| File / field path | `Registry_Metadata.schema.json` (261 to 270), `Validation_Metadata.schema.json` (271 to 306) |
| Category          | ambiguity                                                                                    |
| Status            | partly addressed in new draft                                                                |

**Recheck (13 November 2026).** The October 26 Registry attachment adds `project_registry_history.project_identifier`. This addresses the Registry join concern; the Validation Metadata part has not been re-reviewed. Clarify that joins use the persistent global project identifier.

**Recheck (20 October 2026).** Still present on fast track. Registry Metadata and Validation Metadata are byte-for-byte unchanged from the vendored versions; neither contains a project identifier. Verification Metadata still has `verification_project_id`.

**Observation.** Neither schema has a project identifier. `Validation_Metadata` has a `project` entity, but it holds only `validation_stage[]`, `date[]` and `validation_status`. `Verification_Metadata` does carry one, `verification.verification_project_id` (310).

**Impact.** A Registry Metadata or Validation Metadata document received on its own cannot be joined to the project it describes. Inside a Full List the context supplies it; as a standalone pod document nothing does.

**What the reference API does.** Serves each document at `/v2/projects/{id}/cdop/{pod}` with a `Link: <…/v2/projects/{id}>; rel="up"` header, so the join is carried by HTTP, not by the document.

**Proposal.** Add `project_identifier` (the CDOP URN, see CDOP-FB-010) to both pods, as Verification Metadata already does.

---

## CDOP-FB-032: Integer registry and program ids, and free-text names where Round 1 has enums

|                   |                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `registry.identification[]` (261, 262), `registry.original[]` (264, 265), `registry.program[]` (267, 268) in `Registry_Metadata` |
| Category          | ambiguity                                                                                                                        |
| Status            | addressed in Registry draft                                                                                                      |

**Recheck (13 November 2026).** The October 26 Registry attachment uses string identifiers and controlled names. WCC is still absent from the program-name enum (related FB-028). The API still serves the older October pin.

**Recheck (20 October 2026).** Still present on fast track. Registry, original-registry and program identifiers remain integers; all three corresponding names remain free text rather than the existing Round 1 controlled vocabularies.

**Observation.** The three identifiers are integers and the names are free text:

```json
"registry_identifier": { "type": "integer", "x-cdop-field-id": 261, "x-cdop-cardinality": "1..1" }
"registry_name": { "type": "string", "x-cdop-field-id": 262, "x-cdop-cardinality": "1..1" }
```

Round 1 already has vocabularies for both concepts: `registry.current_registry` (83) is a 35-value enum and `crediting_program_name` (44) a 43-value enum. Round 2 uses neither.

**Impact.** Registry-assigned identifiers are strings in practice (`VCS-4721`), and an unscoped integer cannot carry them. With free-text names, one adopter writes `Verra` and another `Verra VCS`, and the documents do not join. The same registry gets a controlled name in one pod and a free one in the next.

**What the reference API does.** Emits the registry and program names from its vocabulary, which matches the Round 1 enums. For the integer ids it emits the 1-based position of the registry or program in its own vocabulary, as it does for other integer ids (CDOP-FB-011). The slug (`verra`, `ukl`) is in the project resource's `registry` and `crediting_program` objects.

**Proposal.** Type every identifier as a string. Reuse the Round 1 registry and program enums for `registry_name`, `original_registry_name` and `program_name`, or publish one registry and program reference list both rounds use.

---

## CDOP-FB-033: Registry history arrays and dates are underspecified

|                   |                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| File / field path | `registry.identification[]`, `registry.original[]`, `registry.program[]`, `creation_date` (269), `update_date` (270) |
| Category          | ambiguity                                                                                                            |
| Status            | partly addressed in new draft                                                                                        |

**Recheck (13 November 2026).** The October 26 Registry attachment includes registration/exit dates, current markers and an update timestamp. Status history remains a sibling array without an explicit registration join or ordered audit fields. Cardinality and chronology need agreed semantic rules.

**Recheck (20 October 2026).** Still present on fast track. Identification, original registry and program remain arrays, original is still required, the descriptions remain shared/ambiguous, and creation/update are still date-only fields. No transfer-history or timestamp model was added.

**Observation.** `identification`, `original` and `program` are arrays, and `original` is required. Fields 261 to 263 share one description ("Describes the current registry, that contains the information about the project, and units"), and the program descriptions read "the proejct is following for the implementationunits". `creation_date` is "Date that the project was first registered"; `update_date` is typed `format: date`.

**Impact.** The arrays could mean several current registries at once or a transfer history; with no dates or order, neither reading works. Most projects never change registry, so the required `original` block repeats `identification`. "First registered" could mean first listing, registration on the original registry, or registration on the current one, and registries record these as separate dates months apart. A date-only `update_date` cannot serve as a synchronisation watermark: two changes on one day are indistinguishable.

**What the reference API does.** Emits one entry in each array. `original` repeats the current registry, because no project in the dataset has changed registry. `creation_date` is the registration date, else the first listing date. `update_date` is the date part of the project's `modified_at`; the full timestamp is on the HAL resource.

**Proposal.** Make `identification` and `program` single objects. Make `original` optional, meaning "only if different from the current registry", or turn it into a dated history. Name the dates for the events they record (`listed_on`, `registered_on`), and make `update_date` `format: date-time`. Give each field its own description.

---

## CDOP-FB-034: Sibling arrays with no key to their validation or verification event

|                   |                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `validation.date[]`, `validation.report[]`, `validation.stage[]`, `validation.validation_event[]`, `validation_body.details[]`; the arrays inside `verification` |
| Category          | ambiguity                                                                                                                                                        |
| Status            | partly addressed in new draft                                                                                                                                    |

**Recheck (13 November 2026).** Both November 6 Verification alternatives keep each event’s details, quantity and reports together. That addresses the Verification parallel-array problem; the Validation part has not been re-reviewed. VAE is the recommended event-first option for the reference API.

**Recheck (20 October 2026).** Still present on fast track. Validation dates, reports, stages, event and body details remain separate arrays without joining ids. Verification details, reporting, quantity, standard, deductions and status remain sibling arrays without a discriminator.

**Observation.** Validation Metadata splits one validation event across five sibling arrays. Only `validation_event[]` carries `validation_id`; `date[]`, `report[]`, `stage[]` and `validation_body.details[]` carry nothing that says which event they belong to. Verification Metadata does the same inside one verification: `details[]`, `reporting[]`, `quantity[]`, `standard[]`, `deductions[]` and `status[]` are arrays with no key.

**Impact.** This is CDOP-FB-016 again. As soon as a project has two validations, a reader cannot tell which report, which dates and which body belong to which event. Verification Metadata describes one verification, so its arrays have no stated meaning: two `quantity[]` entries could be two units of measure, two periods, or a correction.

**What the reference API does.** Emits one `date[]` and one `report[]` entry per validation event, in the same order as `validation_event[]`, so position is the only key. It emits one entry in each Verification Metadata array. The conformance suite asserts the alignment.

**Proposal.** Nest the dates, report, stages and body inside each `validation_event[]` entry. In Verification Metadata, make the single-valued groups objects.

---

## CDOP-FB-035: Required values that registries do not publish, or that do not exist yet

|                   |                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `validation.date[]` (277 to 279), `validation.validation_event[]` (296, 298, 299), `validation_body.details[]` (292, 294, 295), `verification.reporting[].verification_date` (314), `verification.quantity[].verified_quantity` (315) |
| Category          | ambiguity                                                                                                                                                                                                                             |
| Status            | open; draft rechecked                                                                                                                                                                                                                 |

**Recheck (13 November 2026).** Both November 6 Verification alternatives still require verification date, verified quantity and report URL for an in-progress event. Removing those outcome fields fails three required checks in each alternative. Make completed outcomes conditional.

**Recheck (20 October 2026).** Still present on fast track. Required requested/planned/expiry dates and validator/body-team details are unchanged; planned validations still require outcome dates, and in-progress verifications still require a date and quantity. No conditional requirements were introduced. Historical dataset counts were not rerun.

**Observation.** Each `validation.date[]` entry requires the requested, planned and expiry dates. Each body requires `validator_name`, `validation_body_selection` ("Describe how the validation body was selected") and `validation_body_team_members_and_roles`, the last marked Public and asking for `FIRST NAME - LAST NAME, ROLE` in one string. A validation event requires `validation_date` and both period dates even when `validation_is_planned` is `true`. A verification requires `verification_date` and `verified_quantity`, although its status may be `Pending review (Audit currently in progress)`.

**Impact.** Registries publish the validation body, the report and the decision date. They do not publish who was on the audit team, how the body was chosen, or when the validation was requested, so a feed built from public registry data cannot satisfy the schema. Named individuals in a required Public field is a data protection problem for UK and EU adopters. A planned validation has no outcome date yet, and a verification in progress has no verified quantity. On the full dataset of 370 projects, every one of the 279 projects with a validation fails Validation Metadata on this entry (232 lack an expiry date; all lack the three body fields).

**What the reference API does.** Emits what the source data holds: requested is the submission date, planned is the site-visit start, expiry is the validation deadline where the registry sets one (the Woodland Carbon Code's three-year window). It reports the rest as missing, and `X-CDOP-Conformance` cites this entry. `?strict=1` fills the three body text fields with `Not published`, flagged in the header. It never fills a date or a quantity. It never invents a validator's name.

**Proposal.** Keep a small required core (event id, type, date, body name) and make everything else optional. Make the team an optional array of `{ name, role }` objects, and reconsider marking it Public. Make the outcome fields of an event conditional on its status.

---

## CDOP-FB-036: Validation status modelled three ways

|                   |                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `project.validation_status` (305), `project.validation_stage[].current_validation_stage_status` (275), `validation.stage[].validation_stages[]` (304) |
| Category          | ambiguity                                                                                                                                             |
| Status            | raised upstream                                                                                                                                       |

**Recheck (20 October 2026).** Still present on fast track. Required boolean validation status, stage status and stages reached coexist unchanged, alongside the Round 1 project status. No single event-status vocabulary was introduced.

**Observation.** A required boolean `project.validation_status` ("Indicate whether the project has been validated"), a three-value stage status (`Not started`, `In progress`, `Completed`) on the current stage, and a list of the stages reached.

**Impact.** The boolean cannot say what matters in practice: under validation, changes requested, rejected, expired. A rejected validation is `Completed` at its last stage, with `validation_status: false`, which reads the same as one not yet started. Round 1's `project_status` (CDOP-FB-013) is a fourth place validation state appears.

**What the reference API does.** Derives all three from one validation status per event (`planned`, `submitted`, `in_review`, `changes_requested`, `completed`, `rejected`, `expired`, `withdrawn`), which the HAL resource exposes.

**Proposal.** One validation status enum per event, with values such as `not started`, `in progress`, `changes requested`, `validated`, `rejected`, `expired`, and drop the boolean.

---

## CDOP-FB-037: Round 2 restates Round 1 fields under new ids, names and vocabularies

|                   |                                                                                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `validation.crediting_period[]` (271 to 273), `validation.validation_event[].validation_type` (288), `validation_body.details[].validation_body_name` (291), `verification.verification_report_url[]` (319), `verification.reporting[].verification_date` (314) |
| Category          | ambiguity                                                                                                                                                                                                                                                       |
| Status            | raised upstream                                                                                                                                                                                                                                                 |

**Recheck (20 October 2026).** Still present on fast track. Duplicate crediting-period/body/report/date concepts retain separate ids and shapes. Its two-value `validation_type` enum still disagrees with the four-value published Round 1 enum, including within the draft Full List.

**Observation.** Round 2 repeats concepts Round 1 already defines:

| Round 2                                                                 | Round 1                                                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `validation.crediting_period[].current_crediting_period_*` (271 to 273) | `validation.validation[].current_crediting_period_*` (155 to 157), same key names                        |
| `validation_type`: `Project validation`, `Program validation`           | `validation.event[].validation_type`: four other values, such as `Validation of Project Design Document` |
| `validation_body.details[].validation_body_name` (291)                  | `validation.validation_body_name` (84)                                                                   |
| `verification_report_url[]` (319), `1..*`                               | `project.audits[].verification_report_url` (91), `1..1`                                                  |
| `verification_date` (314)                                               | `issuance.issuance[].date_of_verification` (96)                                                          |
| `verification_buffer_pool_deduction_quantity` (327)                     | `project.buffer_pool[]` (Durability & Permanence)                                                        |

**Impact.** The same fact gets two field ids, two shapes and, for `validation_type`, two incompatible vocabularies under one key name. When two pods disagree, nothing says which is authoritative. On `R2P-FT-Testing` the new `validation_type` enum also replaces the Round 1 one in Full List, which would break every existing Full List document.

**What the reference API does.** Emits both from the same records, so they agree here. Every validation in the dataset is of a project, so Round 2 `validation_type` is always `Project validation`; Round 1 keeps its own values.

**Proposal.** Reference the Round 1 field instead of restating it, or state which pod owns each concept. Keep one `validation_type` vocabulary. A cross-pod field registry (one row per concept, with its id and every path it appears at) would catch this class of drift.

---

## CDOP-FB-038: The sectoral scope list is the CDM list: no scope for REDD+, IFM, wetlands, peat or biochar

|                   |                                                                     |
| ----------------- | ------------------------------------------------------------------- |
| File / field path | `validation_body.details[].validation_body_sectoral_scopes[]` (293) |
| Category          | defect                                                              |
| Status            | open, not yet raised upstream                                       |

**Recheck (20 October 2026).** Still present on fast track. The required, non-empty sectoral-scope enum is unchanged: the same 15 CDM-named scopes, with only afforestation/reforestation and agriculture for land use. No additional scope or program-specific scope reference was added. This audit confirms the unchanged vocabulary; historical project coverage counts were not rerun.

**Observation.** The enum is the 15 sectoral scopes of the Clean Development Mechanism, from `1. Energy industries (renewable - / non-renewable sources)` to `15. Agriculture`. The only land-use scopes are `14. Afforestation and reforestation` and `15. Agriculture`. The field is required, with at least one value.

**Impact.** A validation body accredited for REDD+, improved forest management, tidal wetland or peatland restoration, or biochar has no scope to name. These are scopes that the voluntary standards accredit for (Verra's AFOLU scope covers all the land-use ones). On the full dataset, 130 of 279 validated projects cannot state a scope: VCS REDD+ and blue carbon, ACR improved forest management, Peatland Code and Puro biochar projects.

**What the reference API does.** Maps afforestation, reforestation and agroforestry methodologies to scope 14 and agricultural land management to scope 15. For the rest it emits no scope rather than a wrong one, and `X-CDOP-Conformance` cites this entry.

**Proposal.** Use the scopes the voluntary programs accredit for (for example Verra's sectoral scopes, which include AFOLU), or let the field reference the program's own scope list.

---

## CDOP-FB-039: A decentralised identifier is required on every verification

|                   |                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `verification.verification_credential_issuer_id` (320), `verification_cryptographic_proof_type` (321), `verification_digital_signature_payload` (322) |
| Category          | ambiguity                                                                                                                                             |
| Status            | addressed in Verification drafts                                                                                                                      |

**Recheck (13 November 2026).** Both November 6 Verification alternatives accept records without the DID, proof type and digital signature payload. These fields are now optional. The older served Round 2 pin still requires the DID.

**Recheck (20 October 2026).** Still present on fast track. `verification_credential_issuer_id` remains an unconditionally required string described as a DID, while proof type and signature payload remain optional. No optional credential group was introduced.

**Observation.**

```json
"verification_credential_issuer_id": { "type": "string", "x-cdop-field-id": 320, "x-cdop-cardinality": "1..1" }
```

It is described as "The decentralized identifier (DID) of the entity issuing the digital verification token", and it is required. The proof type and signature payload beside it are optional.

**Impact.** Almost no registry or validation and verification body issues verifiable credentials today, so every conventional verification record fails. On the full dataset, all 135 projects with a verification fail Verification Metadata on this field.

**What the reference API does.** Reports the field missing, and `X-CDOP-Conformance` cites this entry. `?strict=1` fills it with `Not published`, flagged in the header, and the document then validates for every completed verification. It does not invent a DID.

**Proposal.** Group the three fields into one optional `digital_credential` object.

---

## CDOP-FB-040: Verified quantity: unit, uncertainty basis and period are ambiguous

|                   |                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `verification.quantity[]` (315, 316), `verification.deductions[]` (323 to 327), `verification.details[].verification_claim_type` (309) |
| Category          | ambiguity                                                                                                                              |
| Status            | partly addressed in new draft                                                                                                          |

**Recheck (13 November 2026).** The November 6 alternatives place quantity and period within each verification event, but accept negative quantity and leave uncertainty basis unclear. `tCO2` is rejected by the current unit enum. See the reproducible probes and draft reply.

**Recheck (20 October 2026).** Still present on fast track. The unit-of-measure list, untyped percentage-or-absolute uncertainty description, deduction-unit ambiguity and missing cumulative verified quantity remain unchanged.

**Observation.** `verification_quantity_uom` mixes dimensions (`tCO2e`, `kgCO2e`, `MWh`, `m3_biogas`, `ha`, `kg_plastic`) with nothing tying it to `verification_claim_type`, and has no `tCO2`. The leakage and buffer deduction quantities do not state their unit. `verification_uncertainty_deduction_margin` is "Percentage or absolute deduction applied for this specific reporting period for uncertainty". `verified_quantity` is for the reporting period; nothing records the cumulative total, although the Issuances pod distinguishes batch and cumulative volumes.

**Impact.** A reader cannot interpret an uncertainty margin of `5` without knowing whether it is 5 % or 5 tonnes. In ex-ante markets such as the Woodland Carbon Code, buyers ask how much of the predicted volume has been verified to date, which needs the cumulative figure.

**What the reference API does.** Always sends the uncertainty margin as a percentage of the gross verified quantity, and states the deductions in the unit of `verified_quantity`. `verified_quantity` is net of leakage, buffer and uncertainty deductions. The database keeps a cumulative verified quantity per verification, which the verification resource will expose (milestone M2).

**Proposal.** Pick one basis for the uncertainty margin (percentage) or add a basis field. State that deductions share the unit of the verified quantity. Add a cumulative verified quantity, as Issuances has a cumulative issued volume.

---

## CDOP-FB-041: Round 2 drops annotations Round 1 carries, and one cardinality contradicts `required`

|                   |                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| File / field path | every Round 2 field; `verification.status[].is_current` (330); `verification_audit_checkpoint_status` (328) |
| Category          | defect                                                                                                      |
| Status            | raised upstream                                                                                             |

**Recheck (20 October 2026).** Still present on fast track. Mutability annotations remain absent throughout the three metadata pods; Verification Metadata still lacks source/public-private/pre-issuance annotations. `verification.status[].is_current` is still JSON-required but annotated `0..1`, and audit-status definitions remain embedded in enum values.

**Observation.** No Round 2 field carries `x-cdop-mutability`. Verification Metadata fields also carry no `x-cdop-data-source`, `x-cdop-public-private` or `x-cdop-pre-issuance-inclusion`, which Registry and Validation Metadata do. `is_current` is required but annotated optional:

```json
"is_current": { "type": "boolean", "x-cdop-field-id": 330, "x-cdop-cardinality": "0..1" }
```

with `"required": ["is_current"]` on its object. The audit status description still lists `PASS, PASS_WITH_RESERVATIONS, FAIL`, while the enum values are now `Pass (Fully compliant with zero reserves)` and so on, each value carrying its own definition in brackets.

**Impact.** Mutability is what a client needs to know before caching a registry or status field. A reader cannot tell whether verification data is public. The cardinality annotation and the `required` list disagree, so one of them is wrong. Codes that embed their definitions break when the wording is edited.

**What the reference API does.** Nothing to work around: it validates against `required` and ignores the annotations. `pnpm cdop:lint` covers the Round 2 files with the same checks as Round 1.

**Proposal.** A shared style guide for all pods, enforced by the lint step proposed in CDOP-FB-007: every field carries the same annotation set, cardinality is generated from `required` (or the reverse), and enum values are short codes with definitions in a separate column.
