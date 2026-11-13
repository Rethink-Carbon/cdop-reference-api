# ADR 0015: A separately pinned Additionality draft

- Status: accepted
- Date: 2026-11-13

The latest standard-track Additionality proposal is useful for TWG review, but is not part of published CDOP v2.1.0. Its numeric field IDs overlap published and fast-track fields, and schema validation does not establish evidence completeness or an additionality decision.

Vendor the standalone schema and hypothetical example verbatim under their own upstream pin. Add `additionality` to the draft pod catalogue, with its own schema version label, source metadata, validation, project HAL link and MCP discovery. Keep the published Full List and fast-track source pins unchanged. Extend sync, drift and hash verification to cover the third source.

Project exports contain only the existing project reference and available area/duration facts. Do not infer assessment booleans from lifecycle stages or generic documents; omit private financial fields and do not manufacture values in strict mode. Expose the richer upstream synthetic example separately for schema review. Atlas and the public review guide explain that a schema-valid record is not an assessment.

This needs no database migration and does not modify stored projects. Conditional evidence rules, identifier conventions and field ID allocation remain upstream design questions. Do not rewrite the upstream draft to make it appear to resolve those questions.
