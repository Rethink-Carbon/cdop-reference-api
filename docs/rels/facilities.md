# cdop:facilities

Served at `/rels/facilities`.

**Meaning.** From a project to the locations recorded as facilities (the CDOP `facility.location[]` section).

**Target.** `/v2/projects/{id}/facilities`, a HAL collection. May be empty.

**Cardinality.** Exactly one on a project.

**Example.**

```json
"cdop:facilities": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/facilities" }
```

**Availability.** M1.
