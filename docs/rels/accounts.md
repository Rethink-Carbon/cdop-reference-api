# cdop:accounts

Served at `/rels/accounts`.

**Meaning.** From the root to registry accounts (developers, VVBs, code administrators, registry operators, buyers, aggregators, traders, buffer pools), or from a registry facet to the accounts on that registry.

**Target.** `/v2/accounts` and `/v2/accounts/{id}`, with `/v2/accounts/{id}/units` for holdings.

**Cardinality.** Exactly one on the root.

**Example.**

```json
"cdop:accounts": { "href": "https://cdop.rethinkcarbon.co.uk/v2/accounts" }
```

**Availability.** M2.
