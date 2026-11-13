/** The standard-track draft is independently pinned; schema validity is not an assessment. */
import type { ProjectAggregate } from "../../seed/aggregate.js";
import type { ProjectionResult } from "./cdop.js";

export function buildAdditionality(agg: ProjectAggregate): ProjectionResult {
  const additionality: Record<string, string> = {
    additionality_project_id: agg.project_identifier,
  };
  const scale = [
    agg.area_ha === undefined ? undefined : `${agg.area_ha} hectares`,
    agg.duration_years === undefined ? undefined : `${agg.duration_years} years`,
  ].filter((value): value is string => value !== undefined);
  if (scale.length) additionality.lockin_risk_project_scale = scale.join("; ");
  // Existing lifecycle status and generic Additionality PDFs do not establish a specific
  // additionality test or evidence category. Leave assessment and private financial fields out.
  return { pod: "additionality", document: { additionality }, missing: [], placeholders: [] };
}
