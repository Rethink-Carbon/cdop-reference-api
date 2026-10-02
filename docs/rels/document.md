# cdop:document

Served at `/rels/document`.

**Meaning.** From a project (or a unit block) to its schema-pure CDOP documents, one link per pod. The value is an array of named links, not a single link. Pick a document by its `name`; the `profile` of each link is the URL of the JSON Schema it validates against.

**Target.** `/v2/projects/{id}/cdop/{pod}` for the eleven project pods (`full-list`, `location-details`, `project-approach-details`, `disclosures`, `issuances`, `crediting-period`, `estimations`, `co-benefits`, `durability-permanence`, `project-finance`, `labels-certifications`); `/v2/units/{id}/cdop/{pod}` for `unit-description` and the per-unit `full-list`. Each response carries `ETag`, `X-CDOP-Schema-Version` and a `Link: rel="describedby"` header, and accepts `?strict=1`.

**Cardinality.** One array on a project (eleven links) and on a unit block (two links).

**Example.**

```json
"cdop:document": [
  { "name": "full-list", "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/cdop/full-list", "type": "application/json", "profile": "https://cdop.rethinkcarbon.co.uk/v2/schemas/Full_List.schema.json", "title": "Full List" },
  { "name": "location-details", "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/cdop/location-details", "type": "application/json", "profile": "https://cdop.rethinkcarbon.co.uk/v2/schemas/Location_Details.schema.json", "title": "Location Details" }
]
```

Selecting one with jq: `jq -r '._links["cdop:document"][] | select(.name == "full-list") | .href'`.

**Availability.** M1.
