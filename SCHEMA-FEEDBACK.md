# CDOP schema feedback register

This file is the numbered record of every point where the CDOP v2.0 schema could not be implemented as published, was ambiguous, needed an extension, or left an API concern unspecified. It is the deliverable the Technical Working Group asked for alongside the reference API: "document any gaps, ambiguities or decisions that could affect schema development".

The register is served by the API at `/rels/feedback` and to MCP clients as the `cdop://feedback` resource.

## How the register works

**Snapshot.** Entries are written against the vendored schema at upstream commit `eff6ca3d634fc4032d9873cc2c423487c8f34a1b` (16 September 2026), schema version 2.0. File paths are relative to `packages/cdop-schemas/`. Field ids are the `x-cdop-field-id` values from the schema.

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
| CDOP-FB-021 | ambiguity | `crediting_program`, `carbon_crediting_standard`, `registry`                                         | Three overlapping "standard" concepts with no relation between registry, program and standard                      |
| CDOP-FB-022 | ambiguity | `methodology.versions[].methodology`                                                                 | A 496-value enum with embedded program prefixes                                                                    |
| CDOP-FB-023 | ambiguity | `project.buffer_pool[]`                                                                              | Buffer totals without dates; the buffer is a ledger                                                                |
| CDOP-FB-024 | ambiguity | `project.project_risk`                                                                               | JSON stored in a string                                                                                            |
| CDOP-FB-025 | ambiguity | `unit.descriptor[].type`                                                                             | Lacks WCU and PCU while including PIU; `"VER, CER"` is two values                                                  |
| CDOP-FB-026 | ambiguity | all pods                                                                                             | `additionalProperties: true` everywhere, so misspelled keys validate                                               |
| CDOP-FB-027 | api-gap   | n/a                                                                                                  | No `modified_at`, version, deletion, pagination, change-feed or link conventions                                   |
| CDOP-FB-028 | defect    | `crediting_program.crediting_program[].crediting_program_name`, `methodology.versions[].methodology` | The UK codes are in the standard enum but missing from the program and methodology enums                           |
| CDOP-FB-029 | defect    | `unit.unit_level[]`                                                                                  | Every unit label must be an accreditation and a compliance eligibility at once; CORSIA phases are spelled two ways |

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

|                   |                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| File / field path | `crediting_program.crediting_program[]` (44 to 45), `crediting_program.standard[]` (46 to 47), `carbon_crediting_standard` (242), `registry.current_registry` (83) |
| Category          | ambiguity                                                                                                                                                          |
| Status            | open, not yet raised upstream                                                                                                                                      |

**Observation.** Programs (43 names), standards (19 names) and registries (35 names) are three flat enums with no stated relation, and a fourth entity, `carbon_crediting_standard`, contains a single field:

```json
"carbon_crediting_standard": { "type": "object", "properties": { "carbon_standard_level_accreditation": { "x-cdop-field-id": 242 } } }
```

Nothing says that `Woodland Carbon Code` (standard) is administered under a program and hosted on the UK Land Carbon Registry, or that Verra is both a program and a registry.

**Impact.** Consumers cannot join documents across the three lists, and the fourth entity is a naming trap.

**What the reference API does.** Keeps normative tables with foreign keys: `registry`, `crediting_program`, `standard` (with its program and registry), `standard_version`. They are served at `/v2/reference/*` and exposed per project as the `cdop:registry` and `cdop:crediting-program` facets.

**Proposal.** Publish one reference table relating registry, program and standard (with slugs), reference it from the enums, and rename `carbon_crediting_standard` to what it holds (standard-level accreditation) or fold it into `labels`.

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
