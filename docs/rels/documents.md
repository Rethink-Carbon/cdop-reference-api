# cdop:documents

Served at `/rels/documents`.

**Meaning.** From a project to its documents: typed (from the WCC and Peatland Code catalogues or generic types), with the validation, verification or issuance they belong to, upload time, size, hash and a URL.

**Target.** `/v2/projects/{id}/documents`, a HAL collection.

**Cardinality.** Exactly one on a project.

**Example.**

```json
"cdop:documents": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/documents" }
```

**Availability.** M1.
