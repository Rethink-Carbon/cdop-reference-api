# cdop:agreements

Served at `/rels/agreements`.

**Meaning.** From a project to its financial agreements: type, counterparties, offtake terms, insurance, funding details with a status history.

**Target.** `/v2/projects/{id}/agreements`, a HAL collection.

**Cardinality.** Exactly one on a project.

**Example.**

```json
"cdop:agreements": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/agreements" }
```

**Availability.** M2 (route); seeded data arrives in M3.
