# cdop:project

Served at `/rels/project`.

**Meaning.** From any child resource (a unit block, an issuance, a status record, a document, a geolocation file, an estimation, a validation, a milestone, an agreement, an event) to the project it belongs to.

**Target.** The project resource, `/v2/projects/{id}`.

**Cardinality.** Exactly one on every child resource.

**Example.**

```json
"cdop:project": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0" }
```

**Availability.** M1.
