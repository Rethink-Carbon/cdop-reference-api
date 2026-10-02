import type { AppDeps } from "./context.js";
import { projectionContextFor } from "./context.js";
import type { ProjectAggregate } from "../seed/aggregate.js";
import type { ProjectionContext } from "../domain/projection/context.js";

/** Projection context covering every organisation/account an aggregate refers to. */
export async function contextForAggregates(
  deps: AppDeps,
  aggs: ProjectAggregate[],
): Promise<ProjectionContext> {
  const orgIds: string[] = [];
  const accountIds: string[] = [];
  for (const agg of aggs) {
    if (agg.developer_organisation_id) orgIds.push(agg.developer_organisation_id);
    if (agg.vvb_organisation_id) orgIds.push(agg.vvb_organisation_id);
    if (agg.developer_account_id) accountIds.push(agg.developer_account_id);
    for (const s of agg.stakeholders) orgIds.push(s.organisation_id);
    for (const v of agg.validations) if (v.vvb_organisation_id) orgIds.push(v.vvb_organisation_id);
    for (const v of agg.verifications)
      if (v.vvb_organisation_id) orgIds.push(v.vvb_organisation_id);
    for (const a of agg.agreements)
      for (const c of a.counterparties) orgIds.push(c.organisation_id);
    for (const r of agg.retirements)
      if (r.beneficiary_organisation_id) orgIds.push(r.beneficiary_organisation_id);
    if (agg.finance?.declaring_entity_organisation_id)
      orgIds.push(agg.finance.declaring_entity_organisation_id);
    for (const b of agg.blocks) accountIds.push(b.owner_account_id);
  }
  return projectionContextFor(deps, orgIds, accountIds);
}
