# cdop:verifications

Served at `/rels/verifications`.

**Meaning.** From a project to its verification events: monitoring period, claimed, gross and verified quantities, explicit leakage, buffer and uncertainty deductions, opinion, VVB and the resulting issuance.

**Target.** `/v2/projects/{id}/verifications`, a HAL collection.

**Cardinality.** Exactly one on a project.

**Example.**

```json
"cdop:verifications": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/verifications" }
```

**Availability.** M2.
