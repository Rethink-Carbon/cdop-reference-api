# cdop:source-block

Served at `/rels/source-block`.

**Meaning.** From a unit block to the block it was split from or converted from (for example a WCU block created by converting a PIU block at verification).

**Target.** `/v2/units/{id}`.

**Cardinality.** Zero or one on a unit block.

**Example.**

```json
"cdop:source-block": { "href": "https://cdop.rethinkcarbon.co.uk/v2/units/unt_01K5N8X2Q7R3V4W5Y6Z7A8B9D1" }
```

**Availability.** M2.
