# cdop:milestones

Served at `/rels/milestones`.

**Meaning.** From a project to its milestones: validation due, verification due, monitoring report due, crediting period end and similar, each with a due date and a derived status (upcoming, overdue, completed) and the event that completed it.

**Target.** `/v2/projects/{id}/milestones`, a HAL collection.

**Cardinality.** Exactly one on a project.

**Example.**

```json
"cdop:milestones": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/milestones" }
```

**Availability.** M2.
