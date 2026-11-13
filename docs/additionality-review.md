# Additionality draft: November TWG review

Reviewed 13 November 2026 for the TWG meeting on Monday 16 November.

The latest proposal can be demonstrated as a separately labelled draft. It describes the information used to assess whether a project's climate benefit would happen without carbon-credit revenue or incentives. This API checks the document's structure; it does not decide whether a project is additional.

## Source and changes

The four JSON attachments in Sebastian's 27 October testing email are byte-for-byte identical to the current [standard-track branch at `daab3d5`](https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol/tree/daab3d58d7b7b01cc26ca849f652194b111a35eb), dated 26 October. The standalone schema and example are vendored unchanged, with hashes in `packages/cdop-schemas/UPSTREAM-ADDITIONALITY.json`.

This supersedes our 20 October review of the 8 October draft:

- The document now has a flat `additionality` object with 57 fields.
- Only `additionality_project_id` is required. The other 56 fields are optional, so projects need not supply every alternative test.
- The project reference is a string. In the demo it uses the existing `project_identifier`, which can be resolved through the API's identifier resolver. The TWG still needs to agree the identifier convention across registries.
- All 12 fields marked Private are financial fields and can be omitted. The public project exports omit them.

## Try it in the demo

Open a project in [Atlas](/atlas/), choose **CDOP documents**, then find **Additionality (Round 2 draft)** in the CDOP document table. Its result says **schema valid · not assessed**.

- [Inspect the draft schema](/v2/schemas/Additionality.schema.json).
- [Inspect the complete upstream hypothetical example](/v2/drafts/additionality/example). Its financial figures and assessment narratives are synthetic worked examples, not evidence about an actual project.
- Fetch `/v2/projects/{id}/cdop/additionality` for an existing demo project.
- Submit a document to `POST /v2/validate?schema=additionality` to check its structure.
- [Inspect the schema index and separate source pins](/v2/schemas).

Project exports contain the project reference and available area/duration facts only. No pass/fail claims are inferred from lifecycle status, verification status or generic document titles. The existing demo PDFs are placeholders and do not establish assessment evidence. `strict=1` does not invent missing assessment or financial information. A schema-valid export can therefore be a very incomplete assessment record.

Documents carry `X-CDOP-Schema-Version: round2-draft-additionality+daab3d5`. The published v2.1.0 Full List and the separately pinned fast-track metadata drafts keep their existing versions. Additionality is also discoverable through project HAL links, the OpenAPI reference and MCP's CDOP document tool. No database migration or reseed is needed.

## Review results and remaining questions

Both upstream JSON examples pass their respective schemas. The standalone Additionality example has no undeclared fields. The standard-track Full List example contains 34 undeclared paths that its permissive schema accepts; that Full List is reviewed but is **not** adopted by the demo.

The remaining issues are material for production adoption:

1. **Field identifiers collide.** All 57 Additionality field IDs overlap other meanings: five overlap published v2.1.0 fields, and 52 overlap the fast-track metadata pods (10 Registry, 27 Validation, 15 Verification). Use the pinned schema, pod and property path together; a numeric field ID alone is ambiguous. The API's path-based field registry retains both meanings. See CDOP-FB-030.
2. **Valid does not mean evidenced.** An identifier-only document passes. So do an empty identifier, an undeclared `passes_additionality` property, a regulatory claim without evidence, and selection of a financial benchmark approach without benchmark details. A string in a boolean field correctly fails. Additional applicability and conditional evidence requirements are needed before using validation as a completeness check. See CDOP-FB-042.
3. **Financial data is largely narrative.** Structured values, units, currencies, assumptions, periods and benchmark references would make comparisons more reliable. Optional Private annotations do not themselves implement access control.
4. **Assessments need provenance.** Agree how evidence links, assessors, methodology versions, assessment dates and revisions attach to each claim, and how alternative tests are declared applicable or not applicable.

For Monday, this is useful as a reviewable evidence format with a working validator and realistic examples. It is not ready to act as an automatic additionality decision or a universal completeness check.

## Reproduce the review

Download `json_schema/Additionality.schema.json`, `json_schema/Full_List.schema.json`, `examples/additionality.json` and `examples/full_list.json` from the pinned commit into one directory, preserving the four basenames. Then run:

```sh
node apps/api/scripts/review-additionality.mjs /path/to/original-json > review.json
pnpm cdop:verify
pnpm cdop:drift --additionality
```

The recorded results are in `docs/reviews/additionality-2026-11-13.json`. `--additionality` selects the standard-track pin for sync and drift; `--round2` continues to select the fast-track pin.
