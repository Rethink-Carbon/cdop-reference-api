import { schemaVersionLabel } from "@cdop/schemas";
import { generateDataset } from "../../seed/generate.js";
import { buildPodDocument, validateDocument } from "./cdop.js";
import { contextFromDataset } from "./context.js";
import { PROPOSAL_FEEDBACK, buildProposal, validateProposal } from "./proposal.js";

export const PROPOSAL_EXAMPLES = ["wcc", "pc", "vcs", "registry-transfer"] as const;
let cached: Record<string, unknown> | undefined;

/** Fixed synthetic cases, also exported as standalone JSON for upstream test pipelines. */
export function proposalExamples(): Record<string, unknown> {
  if (cached) return cached;
  const ds = generateDataset({ seed: "twg-november-2026", counts: { wcc: 40, pc: 40, vcs: 40 } });
  const ctx = contextFromDataset(ds, "https://cdop.example");
  const examples: Record<string, unknown> = {};
  for (const standard of ["wcc", "pc", "vcs"]) {
    const p = ds.projects.find(
      (p) => p.standard_id === standard && p.verifications.length >= 1 && p.blocks.length > 0,
    );
    if (!p) throw new Error(`Missing verified ${standard} proposal example`);
    const published = buildPodDocument(p, ctx, "full-list");
    const proposed = buildProposal(p);
    examples[standard] = {
      feedback_ids: PROPOSAL_FEEDBACK,
      description: `Synthetic ${standard} project with verification and unit history.`,
      published: {
        schema_version: schemaVersionLabel(),
        document: published.document,
        validation: validateDocument("full-list", published.document),
      },
      proposed: { document: proposed, validation: validateProposal(proposed) },
    };
    if (standard === "vcs") {
      // A hypothetical destination, not a claim that this transfer is allowed by any standard.
      const transferred = {
        ...p,
        registry_id: "example-destination",
        native_project_id: "TRANSFER-001",
      };
      const after = buildProposal(transferred);
      examples["registry-transfer"] = {
        feedback_ids: ["CDOP-FB-010"],
        description:
          "Hypothetical transfer: the same immutable source record acquires a new registry and native identifier. Importers preserve the global ID; they must not mint it again from destination attributes.",
        before: proposed,
        after,
        validation: { before: validateProposal(proposed), after: validateProposal(after) },
      };
    }
  }
  cached = examples;
  return examples;
}
