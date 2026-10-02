# cdop:reference

Served at `/rels/reference`.

**Meaning.** From the root to the reference lists: every enum in the vendored schema (registries, programs, standards, methodologies, countries, statuses, unit types and the rest), keyed by field path.

**Target.** `/v2/reference` (index) and `/v2/reference/{list}`.

**Cardinality.** Exactly one on the root.

**Example.**

```json
"cdop:reference": { "href": "https://cdop.rethinkcarbon.co.uk/v2/reference" }
```

**Availability.** M1.
