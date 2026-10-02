# cdop:units

Served at `/rels/units`.

**Meaning.** From the root, a project, an issuance or an account to unit blocks. One block is one resource: a serial range with one owner and one state.

**Target.** `/v2/units`, `/v2/projects/{id}/units` or `/v2/accounts/{id}/units`, a HAL collection with `limit` up to 250.

**Cardinality.** Exactly one on the root, on a project and on an issuance; one on an account.

**Example.**

```json
"cdop:units": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/units" }
```

**Availability.** M1 (root, project, issuance), M2 (account).
