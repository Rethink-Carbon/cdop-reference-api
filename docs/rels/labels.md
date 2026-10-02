# cdop:labels

Served at `/rels/labels`.

**Meaning.** From a project or a unit block to its labels facet: accreditations, compliance eligibility and potential eligibility, with dates and links.

**Target.** `/v2/projects/{id}/labels` or the `labels` member of a unit resource.

**Cardinality.** Exactly one on a project; one on a unit block.

**Example.**

```json
"cdop:labels": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/labels" }
```

**Availability.** Route M1; seeded data arrives in M3.
