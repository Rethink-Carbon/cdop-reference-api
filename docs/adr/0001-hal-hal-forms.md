# ADR 0001: HAL + HAL-FORMS for the hypermedia representation

Status: accepted. Date: 2026-09-20.

## Context

Rethink committed to the TWG to explore hypermedia: links to navigate between related resources and to discover available actions. The API therefore needs a JSON representation with a standard place for links, a way to embed collection rows, and a way to describe state- and role-gated actions at runtime. Tooling matters: the audience is registry engineers and TWG reviewers who will explore the API in a browser before writing code.

Candidates were HAL, HAL-FORMS, Siren, JSON:API, Collection+JSON and plain JSON with an ad hoc `links` object.

## Decision

Resources are `application/hal+json`: CDOP field names verbatim in the body, `_links` for relations, `_embedded` for collection rows. Custom relations use the `cdop` curie, which resolves to `/rels/{rel}` where each relation has a page. Actions are HAL-FORMS `_templates`, generated from the transition table for the entity, filtered by the current state and the caller's role. A template's `options.link` points at a collection (for example `/v2/accounts` for `to_account_id`). Errors are RFC 9457 problem details, never HAL.

## Consequences

- Every resource carries `_links`; a client never constructs a URL. The README's five-step tour and hal-explorer work from the root alone.
- Templates are derived, not hand-written, so a retired block cannot offer `retire`. The same table drives the action routes, OpenAPI operations, event types and the MCP state-machine tool.
- Clients that ignore hypermedia still get plain JSON fields with CDOP names.
- HAL has no standard for errors or for schema links; problem details and `describedby` links fill those gaps.
- HAL-FORMS support in off-the-shelf clients is thinner than HAL's. hal-explorer renders templates; this needs checking for `options.link` at implementation time.

## Alternatives considered

- **Siren**: richer action model, but almost no tooling and unfamiliar to most reviewers.
- **JSON:API**: strong on relationships and sparse fieldsets, but no affordances, and its `attributes`/`relationships` envelope hides the CDOP field names one level down.
- **Collection+JSON**: collection-centric; awkward for single documents.
- **Plain JSON with `links`**: no shared vocabulary, no explorer, and every client invents its own link handling.
