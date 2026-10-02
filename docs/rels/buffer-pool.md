# cdop:buffer-pool

Served at `/rels/buffer-pool`.

**Meaning.** From a project to its buffer-pool facet: the four CDOP lifetime totals plus the dated ledger entries (deposits, releases, reversal coverage) that produce them.

**Target.** `/v2/projects/{id}/buffer-pool`, a singleton facet resource.

**Cardinality.** Exactly one on a project.

**Example.**

```json
"cdop:buffer-pool": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/buffer-pool" }
```

**Availability.** Route M1; ledger entries arrive with the M2 ledger.
