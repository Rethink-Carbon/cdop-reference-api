# cdop:schema

Served at `/rels/schema`.

**Meaning.** From a CDOP document resource, or from the root, to the JSON Schema that describes it. The schema files are served intact, exactly as vendored.

**Target.** `/v2/schemas/{file}` (`application/schema+json`), or `/v2/schemas` from the root. CDOP documents also send a `Link: rel="describedby"` header.

**Cardinality.** Exactly one on a CDOP document; one on the root (the index).

**Example.**

```json
"cdop:schema": { "href": "https://cdop.rethinkcarbon.co.uk/v2/schemas/Full_List.schema.json" }
```

**Availability.** M1.
