# cdop:estimations

Served at `/rels/estimations`.

**Meaning.** From a project to its estimations, each with one row per vintage (year, estimated mitigation, monitoring period, expected issuance date) and a status history.

**Target.** `/v2/projects/{id}/estimations`, a HAL collection. Estimation actions live under `/v2/projects/{id}/estimations/{eid}/actions/{action}` (M2).

**Cardinality.** Exactly one on a project.

**Example.**

```json
"cdop:estimations": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/estimations" }
```

**Availability.** M1.
