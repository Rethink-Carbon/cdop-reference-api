# cdop:status-history

Served at `/rels/status-history`.

**Meaning.** From a project or a unit block to its status records, newest first. Each record carries `sequence`, `effective_at`, `recorded_at`, `actor_kind`, `actor_account_id`, `action`, `intent`, `reason` and `event_id`; `is_current` is derived.

**Target.** `/v2/projects/{id}/status-history` or `/v2/units/{id}/status-history`, a HAL collection.

**Cardinality.** Exactly one on a project and on a unit block.

**Example.**

```json
"cdop:status-history": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/status-history" }
```

**Availability.** M1 (projects), M1 (units).
