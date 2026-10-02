# CDOP API profile (proposal)

Status: draft, written with milestone M1 of the reference API. Offered to the CDOP Technical Working Group as a companion to the document schemas.

The CDOP schemas say what a document contains. They do not say how a server identifies records, how a client detects change, how lists are paged, how errors look, or how one registry's status words compare with another's. Two conformant servers could still be impossible to synchronise with the same client. This profile fills that gap. Everything in it is implemented by the reference API, so each rule can be tried against a running server.

The key words MUST, SHOULD and MAY are used in the usual sense.

## 1. Identifiers

### 1.1 Strings everywhere

Every identifier MUST be a JSON string. Integers do not carry registry-native ids (`VCS-4721`) and an unscoped small integer cannot join two documents. See `CDOP-FB-011`.

The reference API uses opaque, prefixed, ULID-shaped ids: a three-letter prefix, an underscore, and 26 Crockford base32 characters.

| Prefix | Entity                | Prefix | Entity             |
| ------ | --------------------- | ------ | ------------------ |
| `prj`  | project               | `unt`  | unit block         |
| `iss`  | issuance              | `val`  | validation event   |
| `vrf`  | verification event    | `est`  | estimation         |
| `esv`  | estimation vintage    | `agr`  | agreement          |
| `gis`  | geolocation file      | `doc`  | document           |
| `acc`  | account               | `org`  | organisation       |
| `mst`  | milestone             | `evt`  | event              |
| `whk`  | webhook               | `whd`  | webhook delivery   |
| `trf`  | transfer              | `ret`  | retirement         |
| `cnl`  | cancellation          | `bpe`  | buffer pool entry  |
| `psh`  | project status record | `ush`  | unit status record |

Seeded ids are derived from a hash of a tag, so a reseed reproduces them. Ids minted at runtime carry a millisecond time component and sort by creation time.

### 1.2 The CDOP URN

`project.project_identifier` is the global identifier. Its grammar:

```
cdop-urn   = "cdop:" registry ":" native-id [ ":" batch ]
registry   = 1*( ALPHA / DIGIT / "-" )      ; slug of the registry that minted native-id
native-id  = 1*( VCHAR except ":" )         ; the registry's own project id, verbatim
batch      = 1*( VCHAR except ":" )         ; an issuance batch within the project
```

Examples: `cdop:ukl:104000000012345`, `cdop:verra:4721`, `cdop:verra:4721:B2`.

The registry slug is the authority. The reference API keeps one slug per CDOP registry name (35 names) in its `registry` table, with the registry's URL and a `project_url_template`. A country is not an authority: one registry issues ids across many countries, and a project can change registry but not country. The upstream examples use `cdop:KEN:VCS-4721`, which this profile does not recommend. See `CDOP-FB-010`.

`issuance.issuance[].batch_identifier` is the project URN with a batch suffix.

A server MUST resolve any URN it knows:

```
GET /v2/identifiers/cdop:verra:4721       → 303 See Other, Location: /v2/projects/prj_…
GET /v2/identifiers/cdop:verra:4721:B2    → 303 See Other, Location: /v2/issuances/iss_…
```

### 1.3 Native ids beside global ids

A resource MUST carry both the URN and the registry's native id (`current_registry_project_id`). The native id is what a human types into the registry's website.

## 2. Timestamps and versions

| Field         | Meaning                                                          | Format                    |
| ------------- | ---------------------------------------------------------------- | ------------------------- |
| `created_at`  | When the server first stored the record                          | RFC 3339 `date-time`, UTC |
| `modified_at` | When any field of the record, or of a child record, last changed | RFC 3339 `date-time`, UTC |
| `version`     | Integer, incremented on every change                             | integer                   |
| `*_on`        | Real-world dates (registered, validated, issued)                 | `date`                    |
| `*_at`        | System times                                                     | `date-time`               |

Rules:

- A child change (a new status record, a document, a unit block) MUST bump the parent project's `modified_at` and `version`. This makes `modified_since` on the project collection behave like a registry's own "modified date" filter.
- `ETag` on a single resource is `"v<version>"`. `If-None-Match` with a matching tag MUST return `304 Not Modified`. Collections use a weak ETag.
- Writes that can conflict (actions, `PUT` of a pod document) SHOULD honour `If-Match`. A stale tag returns `412` with problem type `precondition-failed`.
- Registry records are append-only in spirit. A server MUST NOT hard-delete a project, issuance or unit block that has been published. Corrections are new status records. Where a row is removed in the database, the event feed carries a `org.cdop.row.changed` event with `data.op = "delete"` so consumers can reconcile.

## 3. Pagination

Collections use opaque cursors, never offsets.

| Parameter | Meaning                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| `limit`   | Page size. Default 20. Maximum 100 (250 for unit blocks).                                                            |
| `cursor`  | Opaque token from the previous page's `_links.next`. Invalid tokens return `400` with problem type `cursor-invalid`. |
| `sort`    | A field name, with a leading `-` for descending. Each collection publishes its sortable fields.                      |

Responses carry `total` (an exact count), `limit`, and `_links.next`, `_links.prev`, `_links.first`, `_links.up` and a templated `_links.search`. Paging is keyset-based on the sort value plus the record id, so a page is stable while rows are inserted.

## 4. `modified_since`

`GET /v2/projects?modified_since=2026-09-01T00:00:00Z&sort=modified_at` returns every project whose `modified_at` is at or after the instant, oldest first. A client that stores the last `modified_at` it saw and repeats the query has a complete, ordered change list at the project level. The reference API indexes `(modified_at, id)` for this query.

For finer detail, or for deletions, use the events model.

## 5. Events

### 5.1 Envelope

Events are CloudEvents 1.0, structured JSON.

| Attribute                      | Value                                                                    |
| ------------------------------ | ------------------------------------------------------------------------ |
| `id`                           | `evt_…`                                                                  |
| `source`                       | Absolute URL of the resource that changed                                |
| `type`                         | See 5.2                                                                  |
| `subject`                      | The entity id                                                            |
| `time`                         | Business time of the change (`effective_at`)                             |
| `datacontenttype`              | `application/json`                                                       |
| `dataschema`                   | URL of the event's JSON Schema (`apps/api/schemas/events/*.schema.json`) |
| `sequence` (extension)         | The outbox sequence as a string; the SSE id and `Last-Event-ID`          |
| `actor`, `origin` (extensions) | Who caused it; `api`, `simulator`, `seed` or `db`                        |
| `correlationid` (extension)    | The `Idempotency-Key` of the request that caused it                      |
| `apiversion` (extension)       | The API version                                                          |

`data` is `{ entity, id, project_id, action, status: { from, to, status_reason, effective_at, is_current }, changes, version, _links }`.

### 5.2 Types

Rule 1: every append of a status record is `org.cdop.<entity>.status.changed`, for `entity` in `project`, `unit`, `issuance`, `validation`, `verification`, `estimation`, `geolocation_file`, `agreement`.

Rule 2: facts that are not status changes have their own types: `org.cdop.project.created`, `org.cdop.project.updated`, `org.cdop.unit.issued`, `org.cdop.unit.transferred`, `org.cdop.unit.split`, `org.cdop.unit.converted`, `org.cdop.buffer_pool.deposited`, `org.cdop.buffer_pool.released`, `org.cdop.buffer_pool.reversal_covered`, `org.cdop.document.added`, `org.cdop.document.replaced`, `org.cdop.milestone.completed`, `org.cdop.milestone.overdue`, `org.cdop.account.created`, `org.cdop.account.updated`, `org.cdop.row.changed` (a database-side edit captured by trigger), `org.cdop.webhook.ping`.

### 5.3 Transports

| Transport          | Route                                                    | Notes                                                                                                                                                   |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server-sent events | `GET /v2/events`                                         | Filters `types` (glob), `project_id`, `subject`. Resume with `Last-Event-ID` or `since`. Replays from the outbox, then goes live. Heartbeat every 15 s. |
| Pull feed          | `GET /v2/changes?since=&types=&project_id=&limit=&wait=` | A HAL page of events. `wait` long-polls up to 30 s.                                                                                                     |
| Webhooks           | `POST /v2/webhooks`, `…/actions/ping`, `…/deliveries`    | Signed per the Standard Webhooks specification. 8 retries over about 8 hours, then auto-disable.                                                        |

Events are kept for 180 days or 500 000 rows. A `Last-Event-ID` older than retention returns a problem with a `resync` link to the collection.

### 5.4 Exactly-once for producers

Each event has a `dedupe_key`. Retried requests and re-runs of the simulator or the seed do not duplicate events.

## 6. Formats

Servers MUST emit, and the schema SHOULD declare:

| Kind of field                                   | `format`         |
| ----------------------------------------------- | ---------------- |
| Links: `*_link`, `*_url`, `website`, `document` | `uri` (absolute) |
| Email addresses                                 | `email`          |
| Real-world dates                                | `date`           |
| Timestamps (`file_created_on`, `*_at`)          | `date-time`      |

See `CDOP-FB-018` for the list of untyped fields in v2.0.

## 7. Required tiers

`required` in v2.0 is derived mechanically and includes Private fields (`CDOP-FB-005`, `CDOP-FB-019`). This profile proposes one annotation per field:

```
x-cdop-required-tier: core | registry | private | optional
```

- `core`: present in every public document.
- `registry`: present once a registry record exists.
- `private`: present only in documents exchanged under an agreement; never in the public `required` set.
- `optional`: everything else.

`required` at each level is then generated from the tier, not from nested requireds. The existing annotations keep their meaning with canonical lowercase values: `x-cdop-mutability: immutable | mutable`, `x-cdop-public-private: public | private`.

## 8. Project lifecycle

### 8.1 The normalised enum

`lifecycle_stage` has eight values. Six form an ordered ladder; two are exits.

```
draft → listed → registered → validated → verified → retired
                                                    ↘ withdrawn
                                          (any) →  rejected
```

| Value        | Meaning                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| `draft`      | Known to a developer or code administrator; not yet accepted by a registry.              |
| `listed`     | Publicly listed on a registry before registration (Verra "Listed", pipeline).            |
| `registered` | Accepted onto the registry; UK codes register before validation.                         |
| `validated`  | Design validated by a VVB and accepted by the registry. Verra "Registered" maps here.    |
| `verified`   | At least one verification completed; verified units exist or are issuing.                |
| `retired`    | Crediting finished; the project is closed.                                               |
| `withdrawn`  | Left the registry before completion (withdrawn, de-registered, not delivered, inactive). |
| `rejected`   | Refused by the code administrator, VVB or registry.                                      |

`is_on_hold` is an orthogonal boolean. Every project carries the triple `registry_status {code, vocabulary}`, CDOP `status` (the projected record) and `lifecycle_stage`.

### 8.2 CDOP `project_status` (17) → lifecycle

| CDOP value                  | `lifecycle_stage` |
| --------------------------- | ----------------- |
| Origination                 | draft             |
| Pre-feasibility             | draft             |
| Feasibility                 | draft             |
| Project design drafting     | draft             |
| Project design finalization | draft             |
| Listed                      | listed            |
| Validation                  | listed            |
| Validated                   | validated         |
| Registered                  | registered        |
| Approved                    | validated         |
| Authorized                  | validated         |
| Verified and issuing        | verified          |
| Completed                   | retired           |
| Withdrawn                   | withdrawn         |
| De-registered               | withdrawn         |
| Inactive                    | withdrawn         |
| Rejected                    | rejected          |

### 8.3 CAD Trust project status (9) → lifecycle

| CAD Trust value | `lifecycle_stage` |
| --------------- | ----------------- |
| Listed          | listed            |
| Registered      | registered        |
| Validated       | validated         |
| Verified        | verified          |
| Certified       | verified          |
| Completed       | retired           |
| Withdrawn       | withdrawn         |
| Inactive        | withdrawn         |
| Rejected        | rejected          |

### 8.4 Woodland Carbon Code native codes (UK Land Carbon Registry)

Owner is the seat whose action moves the project on. Source: `apps/api/src/domain/lifecycle/wcc.ts`.

| Native code                             | Name                                          | Owner      | `lifecycle_stage` | CDOP status                 |
| --------------------------------------- | --------------------------------------------- | ---------- | ----------------- | --------------------------- |
| NEW                                     | New                                           | developer  | draft             | Project design drafting     |
| PENDING_REVIEW_UNDER_DEVELOPMENT_ACTOR1 | Under Development - Pending Review (Customer) | developer  | draft             | Project design finalization |
| PENDING_REVIEW_UNDER_DEVELOPMENT_ACTOR2 | Under Development - Pending Review (Program)  | code_admin | draft             | Project design finalization |
| PENDING_REVIEW_UNDER_DEVELOPMENT_ACTOR3 | Under Development - Pending Review (System)   | registry   | draft             | Project design finalization |
| DEVELOPMENT                             | Under Development                             | developer  | registered        | Registered                  |
| PENDING_REVIEW_ACTOR4                   | Pending Review (Customer)                     | developer  | registered        | Validation                  |
| PENDING_REVIEW_ACTOR5                   | Pending Review (Validator)                    | vvb        | registered        | Validation                  |
| PENDING_REVIEW_ACTOR6                   | Pending Review (Program)                      | code_admin | registered        | Validation                  |
| PENDING_REVIEW_ACTOR7                   | Pending Review (System)                       | registry   | registered        | Validation                  |
| PENDING_PAYMENT_ACTOR7                  | Pending Payment                               | registry   | registered        | Validation                  |
| VALIDATED                               | Validated                                     | registry   | validated         | Validated                   |
| SELF_ASSESSED                           | Self Assessed                                 | developer  | validated         | Validated                   |
| VERIFIED                                | Verified                                      | registry   | verified          | Verified and issuing        |
| NOT_DELIVERED                           | Not Delivered                                 | code_admin | withdrawn         | De-registered               |
| RETIRED                                 | Retired                                       | developer  | retired           | Completed                   |
| WITHDRAWN                               | Withdrawn                                     | developer  | withdrawn         | Withdrawn                   |
| REJECTED                                | Rejected                                      | registry   | rejected          | Rejected                    |

Transitions follow the registry's own action names (`SUBMIT_ACTOR1`, `APPROVE_ACTOR2`, `NEED_MORE_INFORMATION_ACTOR5`, `VALIDATE_ACTOR4`, `PENDING_PAYMENT_ACTOR7`, `NOT_DELIVERED`, `WITHDRAW`, `VERIFY`, `RETIRE_PROJECT`). Each has an intent (`submit`, `approve`, `more_info`, `reject`, `hold`, `release`, `withdraw`, `verify`, `issue`, `other`) that the events and templates use.

### 8.5 Peatland Code native codes (UK Land Carbon Registry)

Source: `apps/api/src/domain/lifecycle/pc.ts`.

| Native code                                | Name                                          | Owner      | `lifecycle_stage` | CDOP status                 |
| ------------------------------------------ | --------------------------------------------- | ---------- | ----------------- | --------------------------- |
| NEW                                        | New                                           | developer  | draft             | Project design drafting     |
| PENDING_CUST_DEV                           | Under Development - Pending Review (Customer) | developer  | draft             | Project design finalization |
| PENDING_REVIEW_UNDER_DEVELOPMENT_3RD_PARTY | Under Development - Pending Review (Program)  | code_admin | draft             | Project design finalization |
| PENDING_MOP_UNDER_DEV                      | Under Development - Pending Review (System)   | registry   | draft             | Project design finalization |
| DEVELOPMENT                                | Under Development                             | developer  | registered        | Registered                  |
| PENDING_REVIEW_VALIDATION_CUSTOMER         | Pending Review (Customer)                     | developer  | registered        | Validation                  |
| PENDING_REVIEW_VALIDATION_VALIDATOR        | Pending Review (Validator)                    | vvb        | registered        | Validation                  |
| PENDING_3RD_VAL                            | Pending Review (Program)                      | code_admin | registered        | Validation                  |
| PENDING_REVIEW_VALIDATION_MARKIT           | Pending Review (System)                       | registry   | registered        | Validation                  |
| VALIDATED_PENDING_PAYMENT                  | Validated - Pending Payment                   | registry   | registered        | Validation                  |
| VALIDATED                                  | Validated                                     | registry   | validated         | Validated                   |
| PENDING_VALIDATOR_RESTORATION_VALIDATION   | Pending Restoration Validation (Validator)    | vvb        | validated         | Validated                   |
| PENDING_MOP_RESTORATION_VALIDATION         | Pending Restoration Validation (System)       | registry   | validated         | Validated                   |
| RESTORATION_VALIDATED                      | Restoration Validated                         | registry   | validated         | Validated                   |
| VERIFIED                                   | Verified                                      | registry   | verified          | Verified and issuing        |
| RETIRED                                    | Retired                                       | developer  | retired           | Completed                   |
| WITHDRAWN                                  | Withdrawn                                     | developer  | withdrawn         | Withdrawn                   |
| REJECTED                                   | Rejected                                      | registry   | rejected          | Rejected                    |

### 8.6 International standards (simplified, to be verified)

VCS, Gold Standard, ACR, Plan Vivo and Puro share one simplified ex-post machine in `apps/api/src/domain/lifecycle/generic.ts`. State names approximate the public registries' vocabularies and are flagged for review with each program.

| Native code                                                                 | `lifecycle_stage` | CDOP status             |
| --------------------------------------------------------------------------- | ----------------- | ----------------------- |
| UNDER_DEVELOPMENT                                                           | draft             | Project design drafting |
| LISTED                                                                      | listed            | Listed                  |
| UNDER_VALIDATION                                                            | listed            | Validation              |
| REGISTRATION_REQUESTED                                                      | listed            | Validated               |
| REGISTERED (GS: Certified Design)                                           | validated         | Registered              |
| VERIFICATION_APPROVAL_REQUESTED                                             | validated         | Registered              |
| UNITS_ISSUED (GS: Certified Project; ACR: Verified; Puro: Output Audited)   | verified          | Verified and issuing    |
| ON_HOLD                                                                     | validated         | Inactive                |
| CREDITING_PERIOD_ENDED (ACR: Completed; Plan Vivo: Archived; Puro: Removed) | retired           | Completed               |
| INACTIVE                                                                    | withdrawn         | Inactive                |
| WITHDRAWN                                                                   | withdrawn         | Withdrawn               |
| REJECTED                                                                    | rejected          | Rejected                |

## 9. Unit blocks

### 9.1 The canonical machine

One resource is one credit block (a serial range with one owner and one state). States: `pending`, `active`, `on_hold`, `buffer`, `retired`, `cancelled`, `expired`, plus a free `state_reason`. Source: `apps/api/src/domain/lifecycle/units.ts`.

| From    | Action         | Actor    | To        | Event                                   |
| ------- | -------------- | -------- | --------- | --------------------------------------- |
| pending | activate       | registry | active    | `org.cdop.unit.status.changed`          |
| pending | convert        | registry | cancelled | `org.cdop.unit.converted`               |
| pending | transfer       | holder   | pending   | `org.cdop.unit.transferred`             |
| active  | hold           | registry | on_hold   | `org.cdop.unit.status.changed`          |
| active  | transfer       | holder   | active    | `org.cdop.unit.transferred`             |
| active  | retire         | holder   | retired   | `org.cdop.unit.status.changed`          |
| active  | cancel         | registry | cancelled | `org.cdop.unit.status.changed`          |
| active  | expire         | registry | expired   | `org.cdop.unit.status.changed`          |
| active  | deposit_buffer | registry | buffer    | `org.cdop.buffer_pool.deposited`        |
| on_hold | release        | registry | active    | `org.cdop.unit.status.changed`          |
| on_hold | cancel         | registry | cancelled | `org.cdop.unit.status.changed`          |
| buffer  | release_buffer | registry | active    | `org.cdop.buffer_pool.released`         |
| buffer  | cancel_buffer  | registry | cancelled | `org.cdop.buffer_pool.reversal_covered` |

A transfer changes the owner and MAY split the block; a split returns the new blocks in `_embedded.created`, each with a `cdop:source-block` link. Conversion of a pending unit (PIU) into a verified unit (WCU, PCU) at verification is a `cancel` with reason `conversion` plus a new block whose `source_block_id` points back.

### 9.2 Projection onto CDOP `unit.status`

| Canonical state    | `state_reason`             | CDOP `status`            |
| ------------------ | -------------------------- | ------------------------ |
| pending, active    | any                        | Active                   |
| on_hold            | `pending_transfer`         | Pending Transfer         |
| on_hold            | `accepted_pending_payment` | Accepted Pending Payment |
| on_hold            | other                      | On Hold                  |
| buffer             | any                        | Deposited Released       |
| retired            | any                        | Retired                  |
| cancelled, expired | any                        | Cancelled                |

### 9.3 Cross-walk to the CAD Trust picklist

As encoded in `units.ts` (flagged for verification against the CAD Trust v2 picklist):

| Canonical state | CAD Trust |
| --------------- | --------- |
| pending         | Issued    |
| active          | Held      |
| on_hold         | Inactive  |
| buffer          | Buffer    |
| retired         | Retired   |
| cancelled       | Cancelled |
| expired         | Expired   |

## 10. Other machines

| Entity                   | States                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Issuance                 | Pre-issuance → Pending Issuance → Issuing → Complete or Failed. `Verified` is a precondition, not a state (`CDOP-FB-014`).                             |
| Estimation               | Unvalidated → Validated → Superseded. One `is_current` per project.                                                                                    |
| Geolocation file         | The CDOP `file_status` enum as published.                                                                                                              |
| Validation, verification | Append-only events with their own `status` (`planned`, `submitted`, `in_review`, `changes_requested`, `completed`, `rejected`, `expired`/`withdrawn`). |

## 11. Errors

Errors are RFC 9457 `application/problem+json`. `type` is an absolute URL under `/problems/`, and each slug has a page.

| Slug                     | HTTP | When                                                                                            |
| ------------------------ | ---- | ----------------------------------------------------------------------------------------------- |
| `not-found`              | 404  | Unknown resource                                                                                |
| `validation-failed`      | 422  | Bad query or body for our own routes                                                            |
| `illegal-transition`     | 409  | Action not allowed in the current state; lists `allowed_actions` and links `cdop:state-machine` |
| `role-not-permitted`     | 403  | Key role cannot perform the action                                                              |
| `unauthenticated`        | 401  | Write without a key                                                                             |
| `precondition-failed`    | 412  | Stale `If-Match`                                                                                |
| `idempotency-key-reused` | 422  | Same key, different request                                                                     |
| `schema-conformance`     | 422  | Payload fails the CDOP schema; carries Ajv errors                                               |
| `unknown-pod`            | 404  | Unknown CDOP document name                                                                      |
| `cursor-invalid`         | 400  | Undecodable cursor                                                                              |
| `rate-limited`           | 429  | Anonymous bucket exhausted                                                                      |
| `conflict`               | 409  | Other conflicts                                                                                 |
| `internal`               | 500  | Unexpected error                                                                                |

Write requests are checked in this order: authentication, role, state, body, precondition, then the transaction.

## 12. Authentication

Reads are anonymous, with a per-IP token bucket. Writes carry `Authorization: Bearer cdop_<keyid>.<64hex>`. Servers store only a SHA-256 of the key. Roles: `developer`, `vvb`, `code_admin`, `registry`, `admin`, `sandbox`. MCP clients that cannot set headers MAY put the key in the path (`/mcp/<token>`).

## 13. Headers

| Header                              | Meaning                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| `X-CDOP-Schema-Version`             | `2.0+eff6ca3`: schema version plus the short upstream commit      |
| `X-API-Version`                     | The API's semantic version                                        |
| `X-CDOP-Conformance`                | On `?strict=1` documents: which placeholders were emitted and why |
| `Link: <…>; rel="describedby"`      | The JSON Schema of a CDOP document                                |
| `ETag`, `If-None-Match`, `If-Match` | See section 2                                                     |
| `Idempotency-Key`                   | On actions; echoed as the CloudEvents `correlationid`             |

## 14. Open questions for the TWG

1. Identifiers: is the registry slug the right URN authority, and who maintains the slug list?
2. Status records: add `effective_at`, `recorded_at`, `actor` and `sequence`, and adopt a normalised lifecycle enum beside the native code?
3. Full List: is it a per-unit document, or should `unit` and `vintage` become arrays?
4. Parallel arrays: move to one object per vintage and per validation event?
5. Verification: adopt an event-shaped verification record (monitoring period, claimed and verified quantities, explicit deductions)?
6. This profile: maintain an API companion alongside the schema?
