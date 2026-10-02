# cdop:projects

Served at `/rels/projects`.

**Meaning.** From the root to the project collection, or from a registry, standard or account to the projects filtered to it. Filters are CDOP field names; the collection also publishes a templated `search` link.

**Target.** `/v2/projects`, a HAL collection with cursor paging.

**Cardinality.** Exactly one on the root; one on a registry, a standard and an account.

**Example.**

```json
"cdop:projects": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects?standard=wcc" }
```

**Availability.** M1.
