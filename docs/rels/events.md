# cdop:events

Served at `/rels/events`.

**Meaning.** From the root or a project to the server-sent event stream of CloudEvents, optionally filtered to that project.

**Target.** `/v2/events` (`text/event-stream`), or `/v2/events?project_id={id}`. Supports `Last-Event-ID`, `since`, `types`, `subject`.

**Cardinality.** Exactly one on the root and on a project.

**Example.**

```json
"cdop:events": { "href": "https://cdop.rethinkcarbon.co.uk/v2/events?project_id=prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0" }
```

**Availability.** M2.
