# cdop:child-block

Served at `/rels/child-block`.

**Meaning.** From a unit block to the blocks that were created from it by a split or a conversion. The inverse of `cdop:source-block`.

**Target.** `/v2/units/{id}`, one link per child.

**Cardinality.** Zero or more on a unit block (an array when present).

**Example.**

```json
"cdop:child-block": { "href": "https://cdop.rethinkcarbon.co.uk/v2/units/unt_01K5N8X2Q7R3V4W5Y6Z7A8B9J6" }
```

**Availability.** M2.
