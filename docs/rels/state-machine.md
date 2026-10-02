# cdop:state-machine

Served at `/rels/state-machine`.

**Meaning.** From a project, unit block, issuance or estimation to the transition table that governs it, with the lifecycle mapping tables. Also carried by `illegal-transition` problems.

**Target.** `/v2/state-machines/{entity}` for `project`, `unit`, `issuance`, `estimation`, `geolocation_file`; `/v2/state-machines` from the root.

**Cardinality.** Exactly one on each stateful resource and on the root.

**Example.**

```json
"cdop:state-machine": { "href": "https://cdop.rethinkcarbon.co.uk/v2/state-machines/unit" }
```

**Availability.** M2.
