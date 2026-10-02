# cdop:owner-account

Served at `/rels/owner-account`.

**Meaning.** From a unit block to the registry account that holds it. This is the account concept the CDOP schema lacks (see `CDOP-FB-019`).

**Target.** `/v2/accounts/{id}`.

**Cardinality.** Exactly one on a unit block.

**Example.**

```json
"cdop:owner-account": { "href": "https://cdop.rethinkcarbon.co.uk/v2/accounts/acc_01K5N8X2Q7R3V4W5Y6Z7A8B9F3" }
```

**Availability.** M2.
