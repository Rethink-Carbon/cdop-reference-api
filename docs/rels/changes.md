# cdop:changes

Served at `/rels/changes`.

**Meaning.** From the root or a project to the pull feed of CloudEvents: a HAL page, resumable with `since`, long-polling with `wait`.

**Target.** `/v2/changes?since=&types=&project_id=&limit=&wait=`.

**Cardinality.** Exactly one on the root and on a project.

**Example.**

```json
"cdop:changes": { "href": "https://cdop.rethinkcarbon.co.uk/v2/changes?project_id=prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0" }
```

**Availability.** M2.
