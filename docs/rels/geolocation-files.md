# cdop:geolocation-files

Served at `/rels/geolocation-files`.

**Meaning.** From a project to its GIS files. Each file resource carries the CDOP metadata (format, status, validity, area type) plus a bounding box and area, and links to its content.

**Target.** `/v2/projects/{id}/geolocation-files`, a HAL collection. Each item links to `…/{gid}/content`, served as `application/geo+json`.

**Cardinality.** Exactly one on a project.

**Example.**

```json
"cdop:geolocation-files": { "href": "https://cdop.rethinkcarbon.co.uk/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0/geolocation-files" }
```

**Availability.** M1.
