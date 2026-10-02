# ADR 0007: Canonical lifecycle vocabularies beside native codes

Status: accepted. Date: 2026-09-20.

## Context

CDOP's `project_status` enum has 17 values that mix developer funnel stages, registry states, Article 6 authorisation and an activity flag. `unit.status` has 7 values that mix states, hold reasons and events. The wiki and CAD Trust use different lists again. Registries have their own codes: the UK Land Carbon Registry has 17 Woodland Carbon Code states and 18 Peatland Code states, each owned by a seat (developer, code administrator, VVB, registry). Consumers need to compare projects across registries, drive state-gated actions, and keep the registry's own word for audit.

## Decision

Three vocabularies travel together on every project: the registry's native code (`registry_status {code, vocabulary}`), the projected CDOP value (`status`), and a normalised `lifecycle_stage`. The stage has eight values, `draft, listed, registered, validated, verified, retired, withdrawn, rejected`: six on an ordered ladder and two exits. `is_on_hold` is orthogonal. Verra "Registered" maps to `validated`.

Unit blocks use a canonical seven-state machine (`pending, active, on_hold, buffer, retired, cancelled, expired`) plus `state_reason`; the CDOP enum and the CAD Trust picklist are projections, and the native status is kept.

Each standard has a native machine (states with owner seat and mapping, transitions with actor and intent) in `apps/api/src/domain/lifecycle/`, mirrored in the `native_state` and `native_transition` tables. These tables are the single source for HAL-FORMS templates, action routes, OpenAPI operations, event types and the MCP `get_state_machine` tool. The mapping tables are published in `docs/api-profile.md` and at `/v2/state-machines/project`.

## Consequences

- Cross-registry comparison works on `lifecycle_stage`; audit works on the native code; CDOP conformance works on `status`. No information is lost by projecting.
- Adding a standard means adding one machine file and one row set, not touching routes.
- The projections are proposals to the TWG (`CDOP-FB-012`, `CDOP-FB-013`) and may change; the native code never does.
- The international machines (VCS, Gold Standard, ACR, Plan Vivo, Puro) are simplified and their state names are flagged for verification.
- `listed` and `rejected` were added to Rethink's original six-value proposal to cover Verra's pipeline and refusals.

## Alternatives considered

- **CDOP's 17 values as the canonical vocabulary**: conflated, and its order (Validated before Registered) contradicts the UK codes.
- **Native codes only**: no comparison across registries and no shared affordance model.
- **CAD Trust's 9 values**: closer, but no `draft`, and `Certified` and `Inactive` still need mapping.
