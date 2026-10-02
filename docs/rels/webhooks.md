# cdop:webhooks

Served at `/rels/webhooks`.

**Meaning.** From the root to the webhook subscriptions of the calling API key. Each webhook has a ping action and a deliveries collection.

**Target.** `/v2/webhooks`; items at `/v2/webhooks/{id}` with `…/actions/ping` and `…/deliveries`.

**Cardinality.** Exactly one on the root.

**Example.**

```json
"cdop:webhooks": { "href": "https://cdop.rethinkcarbon.co.uk/v2/webhooks" }
```

**Availability.** M2.
