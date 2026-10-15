# CDOP schema feedback register

This file is the numbered record of every point where the CDOP v2.0 schema could not be implemented as published, was ambiguous, needed an extension, or left an API concern unspecified. It is the deliverable the Technical Working Group asked for alongside the reference API: "document any gaps, ambiguities or decisions that could affect schema development".

The register is served by the API at `/rels/feedback` and to MCP clients as the `cdop://feedback` resource.

## How the register works

**Snapshot.** Entries are written against the vendored schema at upstream commit `eff6ca3d634fc4032d9873cc2c423487c8f34a1b` (16 September 2026), schema version 2.0. File paths are relative to `packages/cdop-schemas/`. Field ids are the `x-cdop-field-id` values from the schema.

**Round 2 drafts.** Entries `CDOP-FB-030` onwards cover the three Round 2 "fast track" draft pods (Registry Metadata, Validation Metadata, Verification Metadata). They are not on `main`: they are vendored from the upstream `R2P-FT-Testing` branch at commit `39ac5351e8ca7ecdbc91bbb733188ea226bc21cb` (13 October 2026), pinned in `UPSTREAM-ROUND2.json` and served with `X-CDOP-Schema-Version: round2-draft+39ac535`. Their file paths are relative to `packages/cdop-schemas/schemas/round2/`. Many repeat points Rethink Carbon sent Sebastian Weeks on 1 September 2026 against the 27 August drafts; those are marked `raised upstream`. Fixed since then, and not entered: the space in `"validation _id"` (see `CDOP-FB-001`), the enumerated lists now present in the JSON for validation stages, stage status, sectoral scopes, claim type, unit of measure and audit status, and the upper-case enum values (`CARBON_REMOVAL`), now sentence case.

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

**Evidence.** Snippets below are copied from the vendored files. Run `pnpm cdop:lint` to see the mechanical findings, and `pnpm test --filter @cdop/schemas` for the assertions that pin the defects.

## Summary

| Id          | Category  | Location                                                                                             | Title                                                                                                              |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| CDOP-FB-001 | defect    | `validation`                                                                                         | Identifier key on the validation record (historical, fixed at source)                                              |
| CDOP-FB-002 | defect    | `project."crediting period"`, `cobenefits.cobenefit_target[]`                                        | Property names containing spaces                                                                                   |
| CDOP-FB-003 | defect    | `unit.credit_blockblock_start`                                                                       | Mangled key, required, while `block_end` sits in `credit_block[]`                                                  |
| CDOP-FB-004 | defect    | `examples/v2/*.json`                                                                                 | Published examples do not validate against the published schemas                                                   |
| CDOP-FB-005 | defect    | `Full_List.required`                                                                                 | Mechanically derived `required` makes every project document invalid                                               |
| CDOP-FB-006 | defect    | `crediting_program.standard[].standard_name`                                                         | Enum typo `Verificed Carbon Standard (VCS)` is the wire contract                                                   |
| CDOP-FB-007 | defect    | `x-cdop-mutability`, `x-cdop-public-private`, `x-cdop-data-source`, `x-cdop-pre-issuance-inclusion`  | Annotation values inconsistent in casing, spelling and column                                                      |
| CDOP-FB-008 | defect    | `project.activity_type`                                                                              | Described as an enumeration but ships with no list                                                                 |
| CDOP-FB-009 | defect    | `agreement.project_financing_stage`                                                                  | Enum typos (`Pre-feasability`, `Feasability`) and duplication of `project_status`                                  |
| CDOP-FB-010 | ambiguity | `project.project_id`, `project_identifier`, `current_registry_project_id`                            | Three overlapping project identifiers and an unspecified country-keyed URN                                         |
| CDOP-FB-011 | ambiguity | `validation_id`, `estimation_id`, `previous_project_registration_id`                                 | Integer identifiers                                                                                                |
| CDOP-FB-012 | ambiguity | `unit.status[].status`                                                                               | Three unit-status vocabularies; states, hold reasons and events mixed                                              |
| CDOP-FB-013 | ambiguity | `project.status[].project_status`                                                                    | Funnel stages, Article 6 authorisation and activity in one enum                                                    |
| CDOP-FB-014 | ambiguity | `issuance.issuance[].issuance_status`                                                                | Precondition (`Verified`) mixed with process states                                                                |
| CDOP-FB-015 | ambiguity | `project.status[]`, `unit.status[]`, `estimations.status[]`                                          | Status records carry no timestamp, actor or sequence                                                               |
| CDOP-FB-016 | ambiguity | `estimations.*`, `validation.*`, `unit.*`                                                            | Parallel arrays without keys; scalars beside arrays                                                                |
| CDOP-FB-017 | ambiguity | `geolocation_file.location[]`                                                                        | No file link, geometry or project reference; vector and raster, acquisition and lifecycle mixed                    |
| CDOP-FB-018 | ambiguity | all pods                                                                                             | Only `format: date` is used; no `uri`, `email` or `date-time`                                                      |
| CDOP-FB-019 | ambiguity | `unit.owner_account_id`, `unit.expected_carbon_credit_price`                                         | Required and Private; no account entity                                                                            |
| CDOP-FB-020 | ambiguity | `project.compliance_market_id`                                                                       | Required with `minItems: 1` although "if applicable"                                                               |
| CDOP-FB-021 | ambiguity | `crediting_program`, `carbon_crediting_standard`, `registry`                                         | Three overlapping "standard" concepts; field 242 has a different path in Full List and Labels & Certifications     |
| CDOP-FB-022 | ambiguity | `methodology.versions[].methodology`                                                                 | A 496-value enum with embedded program prefixes                                                                    |
| CDOP-FB-023 | ambiguity | `project.buffer_pool[]`                                                                              | Buffer totals without dates; the buffer is a ledger                                                                |
| CDOP-FB-024 | ambiguity | `project.project_risk`                                                                               | JSON stored in a string                                                                                            |
| CDOP-FB-025 | ambiguity | `unit.descriptor[].type`                                                                             | Lacks WCU and PCU while including PIU; `"VER, CER"` is two values                                                  |
| CDOP-FB-026 | ambiguity | all pods                                                                                             | `additionalProperties: true` everywhere, so misspelled keys validate                                               |
| CDOP-FB-027 | api-gap   | n/a                                                                                                  | No `modified_at`, version, deletion, pagination, change-feed or link conventions                                   |
| CDOP-FB-028 | defect    | `crediting_program.crediting_program[].crediting_program_name`, `methodology.versions[].methodology` | The UK codes are in the standard enum but missing from the program and methodology enums                           |
| CDOP-FB-029 | defect    | `unit.unit_level[]`                                                                                  | Every unit label must be an accreditation and a compliance eligibility at once; CORSIA phases are spelled two ways |
| CDOP-FB-030 | defect    | Round 2 field ids 261 to 325                                                                         | Two Round 2 branches give the same field ids to different fields                                                   |
| CDOP-FB-031 | ambiguity | `Registry_Metadata`, `Validation_Metadata`                                                           | No project identifier: the records cannot be joined to their project                                               |
| CDOP-FB-032 | ambiguity | `registry.identification[]`, `registry.program[]`                                                    | Integer registry and program ids, and free-text names where Round 1 has enums                                      |
| CDOP-FB-033 | ambiguity | `registry.original[]`, `creation_date`, `update_date`                                                | Registry history arrays and dates are underspecified                                                               |
| CDOP-FB-034 | ambiguity | `validation.*[]`, `verification.*[]`                                                                 | Sibling arrays with no key to their validation or verification event                                               |
| CDOP-FB-035 | ambiguity | `validation.date[]`, `validation_body.details[]`, `verification.*`                                   | Required values that registries do not publish, or that do not exist yet                                           |
| CDOP-FB-036 | ambiguity | `project.validation_status`, `project.validation_stage[]`                                            | Validation status modelled three ways                                                                              |
| CDOP-FB-037 | ambiguity | `validation.crediting_period[]`, `validation_type`, report links                                     | Round 2 restates Round 1 fields under new ids, names and vocabularies                                              |
| CDOP-FB-038 | defect    | `validation_body.details[].validation_body_sectoral_scopes`                                          | The sectoral scope list is the CDM list: no scope for REDD+, IFM, wetlands, peat or biochar                        |
| CDOP-FB-039 | ambiguity | `verification.verification_credential_issuer_id`                                                     | A decentralised identifier is required on every verification                                                       |
| CDOP-FB-040 | ambiguity | `verification.quantity[]`, `verification.deductions[]`                                               | Verified quantity: unit, uncertainty basis and period are ambiguous                                                |
| CDOP-FB-041 | defect    | Round 2 annotations                                                                                  | Round 2 drops annotations Round 1 carries, and one cardinality contradicts `required`                              |

## Upstream watch

**Checked 14 October 2026.** Upstream `main` has not moved since the snapshot: it is still `eff6ca3`, and there is no release, open pull request, new issue or discussion. No status above changes, and the vendored files stay as they are. Statuses change only when a fix reaches `main`.

Two unmerged branches by Sebastian Weeks carry proposed schema changes, with no pull request open for either:

| Branch           | Commits                      | Based on                                                                  | What it changes                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `R2P-ST-Testing` | 7 to 8 October 2026          | `eff6ca3` (current `main`)                                                | New `Additionality` pod: eight `project.*[]` groups (`financial_additionality`, `barriers`, `common_practice`, `counterfactual_scenario`, `general_additionality`, `lockin_risk`, `performance_additionality`, `regulatory_additionality`), fields 261 to 325, also added to Full List. New `additionality.json` example; `full_list.json` reworked. |
| `R2P-FT-Testing` | 27 August to 13 October 2026 | `fd28ca2`, 11 commits behind `main` (it predates the 1 September changes) | Restores the `Registry_Metadata`, `Validation_Metadata` and `Verification_Metadata` pods that `main` deleted on 1 September, as fields 261 to 330. Adds `registry`, `validation_body` and `verification` to Full List. Replaces the `validation.event[].validation_type` enum. Three new examples; `full_list.json` reworked.                        |

**Effect on the entries if the branches merged as they stand.**

| Id          | Effect                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CDOP-FB-001 | `Validation_Metadata` on `R2P-FT-Testing` carries `validation_id` and no `_id` key, as promised. Confirm once it reaches `main`.                                                                                                                                                                                                                                                                                      |
| CDOP-FB-003 | Fixed on `R2P-ST-Testing`: `credit_blockblock_start` is gone, `block_start` (field 152) sits in `unit.credit_block[]` and is required there. Still present on `R2P-FT-Testing`.                                                                                                                                                                                                                                       |
| CDOP-FB-004 | Partly fixed on `R2P-ST-Testing`: `full_list.json` now validates (it adds `agreement`, `cobenefits`, `compliance_market_id` and `credit_block[]`) and `additionality.json` validates. `co_benefits.json`, `project_finance.json` and `unit_description.json` still fail. On `R2P-FT-Testing`, `full_list.json` and `location_details.json` fail against that branch's own stale schemas; the three new examples pass. |
| CDOP-FB-005 | Worse on `R2P-FT-Testing`: the top-level `required` grows from nine entities to twelve (`registry`, `validation_body`, `verification`). `verification` is a single object, so a Full List can hold one verification, although a project has many.                                                                                                                                                                     |
| CDOP-FB-011 | `R2P-FT-Testing` adds four more integer identifiers: `validation.validation_event[].validation_id` (287), `registry.identification[].registry_identifier` (261), `registry.original[].original_registry_identifier` (264), `registry.program[].program_identifier` (267). The new `verification.verification_id` (307) is a string, as proposed.                                                                      |
| CDOP-FB-014 | `R2P-FT-Testing` adds a `verification` entity with a string `verification_id`, but `issuance.issuance[]` does not reference it. Both branches' examples still mark issuances `Verified`.                                                                                                                                                                                                                              |
| CDOP-FB-015 | The new `verification.status[]` has the same three-field shape, and requires only `is_current`, not the status value itself.                                                                                                                                                                                                                                                                                          |
| CDOP-FB-016 | Worse on `R2P-FT-Testing`: `validation.validation_event[]` sits beside the existing `validation[]` and `event[]`, and `validation.crediting_period[]` repeats the project's crediting period dates.                                                                                                                                                                                                                   |
| CDOP-FB-018 | The new link fields (`registry_link`, `original_registry_link`, `lca_link`, `validation_report_link`, `validation_stage_document_link`, `verification_report_url[]`) have no `format: uri`. New date fields do use `format: date`.                                                                                                                                                                                    |
| CDOP-FB-021 | Field 242 has one path on `R2P-FT-Testing`, but only because the branch predates the 1 September rename. Merging its generated JSON would revert `Labels_Certifications` to `carbon_crediting_standard`, which is a regression of `main`, not a fix.                                                                                                                                                                  |
| CDOP-FB-023 | A step towards the proposal on `R2P-FT-Testing`: `verification.deductions[].verification_buffer_pool_deduction_quantity` (327) records the buffer deduction per verification and reporting period.                                                                                                                                                                                                                    |
| CDOP-FB-026 | `additionalProperties: true` rises from 141 objects to 159 (`R2P-ST-Testing`) and 187 (`R2P-FT-Testing`).                                                                                                                                                                                                                                                                                                             |
| Others      | No change on either branch to 002, 006 to 010, 012, 013, 017, 019, 020, 022, 024, 025, 027 to 029. The `full_list.json` examples fill `compliance_market_id` with a value rather than relaxing it (020). New fields spell the annotations one way, but the existing inconsistencies remain (007); `R2P-FT-Testing`'s 70 new fields carry no `x-cdop-mutability` at all.                                               |

**Raise before either branch merges.** The `R2P-FT-Testing` pods are now vendored as Round 2 drafts (entries `CDOP-FB-030` to `CDOP-FB-041`); the points below concern the branches as a whole:

1. **Field id collision.** Now `CDOP-FB-030`. Both branches allocate ids from 261 independently. 56 ids, 261 to 325, name different fields on each (261 is `financial_additionality_project_cost_breakdown` on one and `registry_identifier` on the other). Merging both breaks the one id, one field rule that field ids exist for. The generator check proposed in CDOP-FB-021 would catch it.
2. **`R2P-FT-Testing` is stale.** Its generated JSON predates `main`'s 1 September changes, so merging the JSON as it stands would undo the `Labels_Certifications` rename and bring back the one-value `country_subdivision_code` enum that `main` removed. It needs a rebase and regeneration from the current workbook. This is why the API vendors only the branch's three new schema files and their examples, not its `Full_List`, `Project_Approach_Details` or `Estimations`.
3. **Additionality groups require every field.** Each entry of each group requires all its fields, including alternative tests: a `financial_additionality[]` entry must give simple cost analysis, investment comparison and benchmark results together. This is the CDOP-FB-029 shape again. Several names repeat their group (`common_practice_common_practice_documentation`, `counterfactual_scenario_counterfactual_scenarios`, `regulatory_additionality_regulatory_additionality_determination_method`).
4. **Breaking enum change.** Recorded for the Round 2 pod as `CDOP-FB-037`. `R2P-FT-Testing` replaces the four `validation_type` values (`Validation of Project Design Document` and three others) with `Project validation` and `Program validation`, and makes `project.validation_status` required, so every existing Full List document would fail.

---

## CDOP-FB-001: Identifier key on the validation record (historical)

|                   |                                                    |
| ----------------- | -------------------------------------------------- |
| File / field path | `validation` (pre-release v2 draft), the `_id` key |
| Category          | defect                                             |
| Status            | fixed at source (awaiting regenerated JSON)        |

**Observation.** Rethink Carbon reported the `validation` identifier key (`_id`) in its Round 2 feedback on 1 September 2026, before the v2.0 JSON was published. Sebastian Weeks (RMI, TWG) confirmed by email on 2 September 2026 that it had been fixed in the source Excel workbook. The details are in that feedback document and are not reproduced here.

**Impact.** None on the vendored v2.0 files, which carry `validation_id` (field ids 154 and 170). The integer typing of that key is a separate item, `CDOP-FB-011`.

**What the reference API does.** Nothing specific. The entry exists so the register numbering starts from the first item Rethink raised.

**Proposal.** Confirm the fix appears in the next generated JSON release, then mark this entry `fixed upstream`.

---

## CDOP-FB-002: Property names containing spaces

|                   |                                                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `schemas/v2/Full_List.schema.json`: `project."crediting period"[]` (field 161); `schemas/v2/Co_Benefits.schema.json` and `Full_List.schema.json`: `cobenefits.cobenefit_target[]."overview_of_the_projects_approach_to_ track_and_quantify"` |
| Category          | defect                                                                                                                                                                                                                                       |
| Status            | open, not yet raised upstream                                                                                                                                                                                                                |

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

**Impact.** Code generators reject or mangle keys with spaces. Clients in most languages cannot address the property without quoting. Two groups for one concept invite divergent documents.

**What the reference API does.** The spaced `"crediting period"` group is never emitted. The duration is carried by the API's own crediting-period data (`duration_years`). In `cdop/co-benefits` and `cdop/full-list` documents the co-benefit key is emitted exactly as the schema spells it, embedded space included, so the document validates. `pnpm cdop:lint` reports both under rule `key-format`.

**Proposal.** Merge field 161 into `crediting_period[]` and rename the co-benefit key to `overview_of_the_projects_approach_to_track_and_quantify`. Add a generator check that every property name matches `^[a-z][a-z0-9_]*$`.

---

## CDOP-FB-003: `unit.credit_blockblock_start` is mangled and required

|                   |                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| File / field path | `schemas/v2/Full_List.schema.json`: `unit.credit_blockblock_start` (field 152), `unit.credit_block[]` |
| Category          | defect                                                                                                |
| Status            | open, not yet raised upstream                                                                         |

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

|                   |                                                                                                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `examples/v2/full_list.json`, `unit_description.json`, `co_benefits.json`, `project_finance.json` against the matching schemas (four of the eleven examples fail; the other seven pass only because `additionalProperties: true` ignores their flat arrays, see CDOP-FB-026) |
| Category          | defect                                                                                                                                                                                                                                                                       |
| Status            | open, not yet raised upstream                                                                                                                                                                                                                                                |

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

## CDOP-FB-005: Mechanically derived `Full_List.required` makes every project document invalid

|                   |                                                                             |
| ----------------- | --------------------------------------------------------------------------- |
| File / field path | `schemas/v2/Full_List.schema.json`: top-level `required`; `unit`, `vintage` |
| Category          | defect                                                                      |
| Status            | open, not yet raised upstream                                               |

**Observation.** The top level of Full List requires nine entities:

```json
"required": ["agreement", "cobenefits", "estimations", "geolocation_file", "project", "project_stakeholder", "unit", "validation", "vintage"]
```

The list appears to be derived from "has a nested required field" rather than from cardinality: `agreement` is required because `agreement_type` is; `cobenefits` because two of its fields are; `unit` and `vintage` because their fields are. `unit` and `vintage` are single objects, not arrays:

```json
"vintage": { "type": "object", "properties": { "vintage": { "type": "string", "format": "date" } }, "required": ["vintage"] }
```

So a valid Full List must contain exactly one unit, one vintage, at least one agreement and co-benefit targets. A project with no financial agreements, or with two credit blocks, has no valid Full List document.

**Impact.** Full List is unusable as a document contract for a project. It works, at best, as a per-unit document.

**What the reference API does.** Sections with no data are omitted by default, which makes the default Full List fail upstream `required` for most projects; the API says so in the conformance report rather than fabricating data. `?strict=1` emits empty-but-valid placeholders where the schema allows one and sets `X-CDOP-Conformance` to explain each placeholder. The `unit` and `vintage` sections are emitted only in per-unit documents (`/v2/units/{id}/cdop/full-list`) or when `?unit_id=` is given on the project document. `pnpm cdop:lint` reports the derivation under `required-derived`.

**Proposal.** Derive `required` from `x-cdop-cardinality` (`1..1` and `1..*`) at each level, never from nested requireds. Make `unit` and `vintage` arrays, or remove them from the project-level document and keep them in Unit Description.

---

## CDOP-FB-006: Enum typo `Verificed Carbon Standard (VCS)`

|                   |                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| File / field path | `schemas/v2/Full_List.schema.json` and `Project_Approach_Details.schema.json`: `crediting_program.standard[].standard_name` (field 46) |
| Category          | defect                                                                                                                                 |
| Status            | open, not yet raised upstream                                                                                                          |

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
| Status            | open, not yet raised upstream                                                                                                                                                          |

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
| Status            | open, not yet raised upstream                                                                      |

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
| Status            | open, not yet raised upstream          |

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
| Status            | open, not yet raised upstream               |

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
| Status            | open, not yet raised upstream                                                                                                   |

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
| Status            | open, not yet raised upstream        |

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
| Status            | open, not yet raised upstream                                                                                                                                                                                                                                                                                                                                        |

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

**Observation.** The standard enum (19 values) includes both UK codes:

```json
"standard_name": { "enum": ["…", "Peatland Code", "…", "Woodland Carbon Code"] }
```

The crediting program enum (43 values) has a program for one of them only. It lists `IUCN UK Peatland Programme` and nothing under which the Woodland Carbon Code sits. The methodology enum (496 values) has no entry for either code: no value matches the Woodland Carbon Code carbon calculation spreadsheet or the Peatland Code emissions calculator.

**Impact.** A Woodland Carbon Code project can name its standard but not its program. No UK project can name its methodology. `crediting_program` and `methodology` are both required sections of Project Approach & Details, so every WCC and PC project fails that pod and Full List on enum errors alone. Found by the conformance sweep: 300 of 300 UK projects fail, 200 of 200 projects under the other five standards pass.

**What the reference API does.** Emits the real names (`Woodland Carbon Code`; `WCC - Carbon Calculation Spreadsheet`; `Peatland Code - Emissions Calculator`) and lets the document fail. It does not substitute a nearby enum value, because that would misstate the project. `X-CDOP-Conformance` cites this entry. The names follow the enum's own `<program prefix> - <title>` pattern so they can be adopted as they stand.

**Proposal.** Add `Woodland Carbon Code` to the crediting program enum (or state which program administers it) and add the two methodology values. More generally, see CDOP-FB-021 and CDOP-FB-022: a reference table relating registry, program, standard and methodology would make this class of gap visible when the list is edited.

---

## CDOP-FB-029: `unit_level[]` requires an accreditation and a compliance eligibility on every entry

|                   |                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| File / field path | `unit.unit_level[]` (253 to 260), `carbon_crediting_standard.carbon_standard_level_accreditation` (242) |
| Category          | defect                                                                                                  |
| Status            | open, not yet raised upstream                                                                           |

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
| Status            | raised upstream                                                                              |

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
| Status            | raised upstream                                                                                                                  |

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
| Status            | raised upstream                                                                                                      |

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
| Status            | raised upstream                                                                                                                                                  |

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
| Status            | raised upstream                                                                                                                                                                                                                       |

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
| Status            | raised upstream                                                                                                                                       |

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
| Status            | raised upstream                                                                                                                        |

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

**Observation.** No Round 2 field carries `x-cdop-mutability`. Verification Metadata fields also carry no `x-cdop-data-source`, `x-cdop-public-private` or `x-cdop-pre-issuance-inclusion`, which Registry and Validation Metadata do. `is_current` is required but annotated optional:

```json
"is_current": { "type": "boolean", "x-cdop-field-id": 330, "x-cdop-cardinality": "0..1" }
```

with `"required": ["is_current"]` on its object. The audit status description still lists `PASS, PASS_WITH_RESERVATIONS, FAIL`, while the enum values are now `Pass (Fully compliant with zero reserves)` and so on, each value carrying its own definition in brackets.

**Impact.** Mutability is what a client needs to know before caching a registry or status field. A reader cannot tell whether verification data is public. The cardinality annotation and the `required` list disagree, so one of them is wrong. Codes that embed their definitions break when the wording is edited.

**What the reference API does.** Nothing to work around: it validates against `required` and ignores the annotations. `pnpm cdop:lint` covers the Round 2 files with the same checks as Round 1.

**Proposal.** A shared style guide for all pods, enforced by the lint step proposed in CDOP-FB-007: every field carries the same annotation set, cardinality is generated from `required` (or the reverse), and enum values are short codes with definitions in a separate column.
