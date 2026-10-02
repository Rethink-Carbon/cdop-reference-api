# cdop:validations

Served at `/rels/validations`.

**Meaning.** From a project to its validation events: type, status, VVB, site visit and decision dates, opinion, crediting period and report documents.

**Target.** `/v2/projects/{id}/validations`, a HAL collection.

**Cardinality.** Exactly one on a project.

**Example.**

```json
"cdop:validations": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/validations" }
```

**Availability.** M1.
