# cdop:identifier

Served at `/rels/identifier`.

**Meaning.** From a project or an issuance to the resolver for its CDOP URN, or a templated link from the root. Resolving a URN answers with a 303 to the canonical resource.

**Target.** `/v2/identifiers/{urn}`; the root carries it templated as `/v2/identifiers/{urn}`.

**Cardinality.** Exactly one on a project and on an issuance; one templated link on the root.

**Example.**

```json
"cdop:identifier": { "href": "https://cdop.rethinkcarbon.co.uk/v2/identifiers/cdop:ukl:104000000012345" }
```

**Availability.** M1.
