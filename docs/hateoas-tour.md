# HATEOAS tour

A longer walk through the API with curl and jq. Start at the root and follow links. Sections marked M2 need the lifecycle and events milestone; everything else is M1.

Set a base URL once. The hosted demo and a local `docker compose up` serve the same routes.

```bash
BASE=http://localhost:3000          # or https://cdop.rethinkcarbon.co.uk
H='accept: application/hal+json'
```

## 1. The root

```bash
curl -s -H "$H" "$BASE/v2" | jq
```

The root has no data of its own, only links: `self`, `curies`, `service-desc` (the OpenAPI document), `service-doc` (the Scalar API reference), and the `cdop:` collections (`projects`, `units`, `issuances`, `accounts`, `reference`, `schemas`, `state-machines`, `events`, `changes`, `webhooks`, `feedback`, and a templated `identifier`). The `cdop` curie is templated: `cdop:projects` is documented at `/rels/projects`.

```bash
curl -s "$BASE/rels/projects"
```

Two headers travel with every response:

```bash
curl -s -D - -o /dev/null "$BASE/v2" | grep -iE '^x-(cdop|api)-'
```

```
X-CDOP-Schema-Version: 2.0+eff6ca3
X-API-Version: 0.1.0
```

## 2. Collections

Follow `cdop:projects`. Filters use CDOP field names; `limit`, `sort` and `cursor` page the result.

```bash
PROJECTS=$(curl -s "$BASE/v2" | jq -r '._links["cdop:projects"].href')
curl -s "$PROJECTS?standard=pc&sort=-modified_at&limit=2" | jq '{total, limit, links: (._links | keys), first: ._embedded.projects[0]}'
```

Index rows are compact: id, name, standard, country, `lifecycle_stage`, `registry_status`, `modified_at`, and a `self` link. Take the `next` link for the following page; never build a cursor by hand.

```bash
NEXT=$(curl -s "$PROJECTS?standard=pc&limit=2" | jq -r '._links.next.href // empty')
[ -n "$NEXT" ] && curl -s "$NEXT" | jq '._embedded.projects | length'
```

`modified_since` gives a change list at project level:

```bash
curl -s "$PROJECTS?modified_since=2026-09-01T00:00:00Z&sort=modified_at" | jq '.total'
```

## 3. A project

```bash
PROJECT=$(curl -s "$PROJECTS?standard=wcc&limit=1" | jq -r '._embedded.projects[0]._links.self.href')
curl -s "$PROJECT" | jq '{project_name, project_identifier, current_registry_project_id, lifecycle_stage, registry_status, status, modified_at, version}'
```

Three status words travel together: `registry_status.code` (the registry's own code, for example `PENDING_REVIEW_ACTOR5`), `status` (the current CDOP status record) and `lifecycle_stage` (the normalised value, for example `registered`).

The links on a project:

```bash
curl -s "$PROJECT" | jq '._links | keys'
```

Facets are singletons (`cdop:stakeholders`, `cdop:crediting-program`, `cdop:registry`, `cdop:cobenefits`, `cdop:buffer-pool`, `cdop:labels`, `cdop:finance`); the rest are collections (`cdop:validations`, `cdop:estimations`, `cdop:documents`, `cdop:geolocation-files`, `cdop:issuances`, `cdop:units`, `cdop:status-history`, and in M2 `cdop:verifications`, `cdop:agreements`, `cdop:milestones`).

```bash
curl -s "$(curl -s "$PROJECT" | jq -r '._links["cdop:status-history"].href')" | jq '._embedded["status-records"][] | {sequence, effective_at, actor_kind, action, lifecycle_state, native_state_code, is_current}'
```

## 4. Geometry

```bash
GIS=$(curl -s "$(curl -s "$PROJECT" | jq -r '._links["cdop:geolocation-files"].href')" | jq -r '._embedded["geolocation-files"][0]._links.self.href')
curl -s "$GIS" | jq '{file_name, file_format, file_status, area_type, area_ha, bbox}'
curl -s -H 'accept: application/geo+json' "$(curl -s "$GIS" | jq -r '._links.content.href')" | jq '.geometry.type'
```

## 5. Conditional requests

Every single resource has a strong ETag, `"v<version>"`. Send it back and get a 304.

```bash
ETAG=$(curl -s -D - -o /dev/null "$PROJECT" | awk 'tolower($1)=="etag:" {print $2}' | tr -d '\r')
curl -s -o /dev/null -w '%{http_code}\n' -H "if-none-match: $ETAG" "$PROJECT"
```

```
304
```

Collections use a weak ETag (`W/"…"`) that changes with the page content.

## 6. CDOP documents

`cdop:document` is an array of named links, one per pod, each with a `profile` pointing at its schema.

```bash
curl -s "$PROJECT" | jq -r '._links["cdop:document"][] | "\(.name)\t\(.href)"'
```

Fetch the Full List and look at its headers:

```bash
FULL=$(curl -s "$PROJECT" | jq -r '._links["cdop:document"][] | select(.name == "full-list") | .href')
curl -s -D - "$FULL" -o full-list.json | grep -iE '^(etag|link|x-cdop-schema-version):'
```

```
ETag: "v7"
Link: <http://localhost:3000/v2/schemas/Full_List.schema.json>; rel="describedby"; type="application/schema+json"
X-CDOP-Schema-Version: 2.0+eff6ca3
```

Validate it:

```bash
curl -s -X POST "$BASE/v2/validate?schema=full-list" -H 'content-type: application/json' --data @full-list.json | jq
```

A project without financial agreements fails the upstream `required` list by design (see `CDOP-FB-005`). Ask for strict mode and read the conformance header:

```bash
curl -s -D - -o /dev/null "$FULL?strict=1" | grep -i '^x-cdop-conformance'
```

Now try one of the upstream examples, which do not validate (`CDOP-FB-004`):

```bash
curl -s -X POST "$BASE/v2/validate?schema=unit-description" -H 'content-type: application/json' \
  --data @packages/cdop-schemas/examples/v2/unit_description.json | jq '{valid, first: .errors[0]}'
```

## 7. Resolving a CDOP URN

`project_identifier` is a URN. The resolver answers with a 303.

```bash
URN=$(curl -s "$PROJECT" | jq -r '.project_identifier')
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$BASE/v2/identifiers/$URN"
```

```
303 http://localhost:3000/v2/projects/prj_01K5N8X2Q7R3V4W5Y6Z7A8B9C0
```

`curl -L` follows it. A batch URN (`…:B2`) resolves to an issuance.

## 8. Problem details

Errors are `application/problem+json` with a `type` you can open in a browser.

```bash
curl -s -i "$BASE/v2/projects/prj_00000000000000000000000000" | sed -n '1p;/^{/,$p'
```

```
HTTP/1.1 404 Not Found
{
  "type": "http://localhost:3000/problems/not-found",
  "title": "Resource not found",
  "status": 404,
  "detail": "project prj_00000000000000000000000000 was not found",
  "instance": "/v2/projects/prj_00000000000000000000000000"
}
```

A bad cursor gives `cursor-invalid` (400); an unknown pod gives `unknown-pod` (404); a payload that fails Ajv on a write gives `schema-conformance` (422) with the errors inlined.

## 9. Units and templates (M2)

One unit resource is one credit block. Its `_templates` are the legal actions for its state and your role.

```bash
UNIT=$(curl -s "$(curl -s "$PROJECT" | jq -r '._links["cdop:units"].href')?lifecycle_state=active&limit=1" | jq -r '._embedded.units[0]._links.self.href')
curl -s "$UNIT" | jq '{serial_number, quantity, state, state_reason, status, templates: (._templates | keys)}'
```

The shape, illustrative:

```json
"_templates": {
  "retire": {
    "title": "Retire",
    "method": "POST",
    "target": "http://localhost:3000/v2/units/unt_01K5N8X2Q7R3V4W5Y6Z7A8B9D1/actions/retire",
    "properties": [
      { "name": "quantity", "type": "number", "required": true, "min": 1, "max": 500 },
      { "name": "beneficiary", "type": "text" },
      { "name": "detail", "type": "textarea" }
    ]
  },
  "transfer": {
    "title": "Transfer",
    "method": "POST",
    "target": "http://localhost:3000/v2/units/unt_01K5N8X2Q7R3V4W5Y6Z7A8B9D1/actions/transfer",
    "properties": [
      { "name": "to_account_id", "required": true, "options": { "link": { "href": "http://localhost:3000/v2/accounts" }, "valueField": "id", "promptField": "name" } },
      { "name": "quantity", "type": "number", "min": 1, "max": 500 }
    ]
  },
  "hold": { "title": "Put on hold", "method": "POST", "target": "…/actions/hold", "properties": [ { "name": "reason", "required": true } ] },
  "cancel": { "title": "Cancel", "method": "POST", "target": "…/actions/cancel", "properties": [ { "name": "reason", "required": true } ] }
}
```

Anonymous callers see all templates on the demo (`AFFORDANCES_FOR_ANONYMOUS=all`) but cannot execute them.

## 10. Executing an action (M2)

Writes need a key and benefit from `Idempotency-Key` and `If-Match`.

```bash
KEY=cdop_…                                  # printed by pnpm seed, or issued by an admin
ETAG=$(curl -s -D - -o /dev/null "$UNIT" | awk 'tolower($1)=="etag:" {print $2}' | tr -d '\r')
curl -s -X POST "$UNIT/actions/retire" \
  -H "authorization: Bearer $KEY" -H "if-match: $ETAG" -H "idempotency-key: $(uuidgen)" \
  -H 'content-type: application/json' \
  --data '{"quantity": 100, "beneficiary": "Example Ltd", "detail": "FY2026 residual emissions"}' | jq '{state, quantity, created: [._embedded.created[]? | {id, quantity, state}], templates: (._templates | keys)}'
```

A partial retirement splits the block: the retired part is returned under `_embedded.created` with a `cdop:source-block` link back. After the call the templates change: a retired block offers nothing. Repeat the same request with the same `Idempotency-Key` and you get the same response. Change the body and keep the key: `422 idempotency-key-reused`. Send the old ETag: `412 precondition-failed`. Retire an already retired block:

```json
{
  "type": "http://localhost:3000/problems/illegal-transition",
  "title": "Transition not allowed in the current state",
  "status": 409,
  "detail": "retire is not allowed from state retired",
  "instance": "/v2/units/unt_01K5N8X2Q7R3V4W5Y6Z7A8B9D1/actions/retire",
  "allowed_actions": [],
  "_links": { "cdop:state-machine": { "href": "http://localhost:3000/v2/state-machines/unit" } }
}
```

## 11. Events (M2)

Open the stream in one shell:

```bash
curl -N "$BASE/v2/events?types=org.cdop.unit.*"
```

Retire a block in another. A CloudEvent arrives within a second:

```
id: 48213
event: org.cdop.unit.status.changed
data: {"specversion":"1.0","id":"evt_…","type":"org.cdop.unit.status.changed","source":"http://localhost:3000/v2/units/unt_…","subject":"unt_…","time":"2026-09-21T10:15:00Z","sequence":"48213","origin":"api","data":{"entity":"unit","id":"unt_…","project_id":"prj_…","action":"retire","status":{"from":"active","to":"retired","effective_at":"2026-09-21T10:15:00Z","is_current":true},"version":8,"_links":{"self":{"href":"http://localhost:3000/v2/units/unt_…"}}}}
```

Disconnect and resume from where you were:

```bash
curl -N -H 'last-event-id: 48213' "$BASE/v2/events"
```

The pull feed returns the same events as a HAL page and long-polls:

```bash
curl -s "$BASE/v2/changes?since=48213&wait=20" | jq '{count: (._embedded.events | length), next: ._links.next.href}'
```

Edit a cell in the database (Supabase Studio or psql) and an `org.cdop.row.changed` event appears with the changed columns.

## 12. MCP

The same model is available to agents at `/mcp`. See [mcp.md](mcp.md).
