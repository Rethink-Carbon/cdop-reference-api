# cdop:registry

Served at `/rels/registry`.

**Meaning.** From a project to its registry facet: current and origin registry, the native project id and URL, the issuance registry, and previous registrations.

**Target.** `/v2/projects/{id}/registry`, a singleton facet resource.

**Cardinality.** Exactly one on a project.

**Example.**

```json
"cdop:registry": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/registry" }
```

**Availability.** M1.
