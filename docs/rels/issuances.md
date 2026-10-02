# cdop:issuances

Served at `/rels/issuances`.

**Meaning.** From the root to every issuance, or from a project to its issuances (batches with kind, unit type, vintage, volume, cumulative volume and status).

**Target.** `/v2/issuances` or `/v2/projects/{id}/issuances`, a HAL collection.

**Cardinality.** Exactly one on the root and on a project.

**Example.**

```json
"cdop:issuances": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/issuances" }
```

**Availability.** M1.
