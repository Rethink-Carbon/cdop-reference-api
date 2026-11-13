# 0014: Versioned TWG proposals beside published CDOP

Date: 13 November 2026

Status: accepted for the reference implementation; schema proposals remain subject to TWG review.

## Context

The 20 October TWG discussion called for worked identity and lifecycle proposals that participants can inspect in the API and visual explorer. Altering vendored CDOP schemas would obscure the published contract and invalidate upstream hash verification.

## Decision

Adopt upstream CDOP v2.1.0 verbatim and adapt its projection to corrected keys and optional compliance-market membership. Keep the existing Round 2 pin explicit.

Expose Rethink's focused review profile under `/v2/proposals/0.1.0` and `/v2/projects/{id}/proposals/0.1.0`. Label every response with `rethink-proposal-0.1.0`, offer an Atlas selector and HAL links, and export deterministic examples with feedback IDs. Validate both document shape and semantic relationships. Published document routes retain their published contract.

The proposal UUID derives from the demo issuer's immutable project key. It demonstrates persistence across registry changes, not global duplicate reconciliation. Future revisions must use another proposal version when they change the contract.

## Consequences

Reviewers can compare concrete data and validation outcomes. Fixtures and negative regression tests can inform upstream generator work. The proposal is deliberately incomplete as a replacement CDOP schema, requires no database migration, and must not be represented as TWG-approved. Production identity assignment and richer authorization/registration history remain design decisions.
