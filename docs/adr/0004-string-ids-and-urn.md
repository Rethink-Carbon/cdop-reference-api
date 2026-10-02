# ADR 0004: String identifiers and the CDOP URN

Status: accepted. Date: 2026-09-20.

## Context

CDOP v2.0 carries three overlapping project identifiers (`project_id`, `project_identifier`, `current_registry_project_id`), types four identifiers as integers, and shows a country-keyed URN (`cdop:KEN:VCS-4721`) in its examples without a grammar. Rethink's Round 2 feedback asked for string ids everywhere and a resolvable global identifier. The API also needs its own ids that are stable across reseeds, sortable, and safe to expose.

## Decision

Every API identifier is a string. Records use opaque prefixed ULID-shaped ids (`prj_`, `unt_`, `iss_`, `val_`, `vrf_`, `est_`, `agr_`, `gis_`, `doc_`, `acc_`, `org_`, `mst_`, `evt_`, `whk_` and others; see `apps/api/src/domain/ids.ts`). Runtime ids take a millisecond time component and random bits. Seeded ids derive both parts from a SHA-256 of a tag so a reseed reproduces the dataset.

The CDOP `project_identifier` is a URN with the grammar `cdop:<registry-slug>:<native-id>[:<batch>]`. The registry slug is the authority, held in the `registry` table (one slug per CDOP registry name). `current_registry_project_id` is the native id, kept verbatim. `GET /v2/identifiers/{urn}` resolves any known URN with a `303 See Other`.

CDOP fields typed `integer` (`validation_id`, `estimation_id`) are emitted in schema-pure documents as the record's per-project `sequence`, so documents validate; the string id lives in the HAL resource.

## Consequences

- No integer id leaks from the API, and no registry-native id is used as a primary key, so projects from different registries cannot collide.
- Ids are readable in logs and URLs, and their prefix says what they are.
- The URN authority is a proposal (`CDOP-FB-010`); if the TWG picks a different authority, only the slug table and the resolver change.
- The `sequence` projection for integer fields is a documented compromise (`CDOP-FB-011`).

## Alternatives considered

- **UUIDv7**: sortable and standard, but unprefixed and harder to read; no way to tell a unit from a project by eye.
- **Registry-native ids as primary keys**: collide across registries and change when a project moves registry.
- **Country-keyed URN** (the upstream example): a country is not an identifier authority; one registry spans many countries.
- **Integers**: cannot carry native ids and do not scope across documents.
