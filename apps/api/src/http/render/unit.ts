import type { ProjectAggregate, UnitBlock } from "../../seed/aggregate.js";
import { hal, type Linker, type Links, type Template } from "../hal.js";
import { clean, documentLinks, iso, isoTs, schemaLink, UNIT_PODS } from "./common.js";
import { CADT_UNIT_STATUS } from "../../domain/lifecycle/units.js";

export function unitLinks(
  linker: Linker,
  block: UnitBlock,
  projectId: string,
  sourceSerial?: string,
): Links {
  const base = `/v2/units/${block.id}`;
  const links: Links = {
    self: linker.link(base),
    curies: linker.curies(),
    collection: linker.link("/v2/units"),
    describedby: schemaLink(linker, "unit-description"),
    [linker.rel("project")]: linker.link(`/v2/projects/${projectId}`),
    [linker.rel("issuance")]: linker.link(`/v2/issuances/${block.issuance_id}`),
    [linker.rel("owner-account")]: linker.link(`/v2/accounts/${block.owner_account_id}`),
    [linker.rel("status-history")]: linker.link(`${base}/status-history`),
    [linker.rel("document")]: documentLinks(linker, base, UNIT_PODS),
    [linker.rel("state-machine")]: linker.link("/v2/state-machines/unit"),
    monitor: linker.link("/v2/events", { type: "text/event-stream" }, { subject: block.id }),
  };
  if (block.source_block_id)
    links[linker.rel("source-block")] = linker.link(
      `/v2/units/${block.source_block_id}`,
      sourceSerial ? { title: sourceSerial } : undefined,
    );
  if (block.retirement_id)
    links[linker.rel("retirement")] = linker.link(
      `/v2/projects/${projectId}/retirements/${block.retirement_id}`,
    );
  return links;
}

function historyRecord(h: UnitBlock["history"][number]) {
  return clean({
    status: h.cdop_status,
    status_reason: h.reason,
    is_current: h.is_current,
    lifecycle_state: h.to_state,
    from_state: h.from_state,
    action: h.action,
    actor: h.actor_kind,
    actor_account_id: h.actor_account_id,
    from_owner_account_id: h.from_owner_account_id,
    to_owner_account_id: h.to_owner_account_id,
    quantity: h.quantity,
    effective_at: isoTs(h.effective_at),
    sequence: h.sequence,
  });
}

export function renderUnit(
  block: UnitBlock,
  agg: ProjectAggregate,
  linker: Linker,
  opts: { ownerName?: string | undefined; templates?: Record<string, Template> | undefined } = {},
) {
  const current = block.history.find((h) => h.is_current);
  const retirement = agg.retirements.find((r) => r.id === block.retirement_id);
  const issuance = agg.issuances.find((i) => i.id === block.issuance_id);
  const source = block.source_block_id
    ? agg.blocks.find((b) => b.id === block.source_block_id)
    : undefined;
  const properties = clean({
    id: block.id,
    project_id: agg.id,
    project_identifier: agg.project_identifier,
    issuance_id: block.issuance_id,
    batch_identifier: issuance?.batch_identifier,
    descriptor: { metric: block.metric, type: block.unit_type, class: block.unit_class },
    reference: clean({
      serial_number: block.serial_number,
      source_serial_number: source?.serial_number,
    }),
    credit_block: {
      block_start: block.block_start,
      block_end: block.block_end,
      quantity: block.block_end - block.block_start + 1,
    },
    vintage: iso(block.vintage_start_on),
    vintage_period: {
      start: iso(block.vintage_start_on),
      end: iso(block.vintage_end_on),
      label: block.vintage_label,
    },
    status: current ? historyRecord(current) : { status: block.cdop_status, is_current: true },
    lifecycle_state: block.state,
    state_reason: block.state_reason,
    registry_status: clean({ code: block.native_status_code, name: block.native_status_name }),
    cadt_status: CADT_UNIT_STATUS[block.state],
    owner_account_id: block.owner_account_id,
    owner_account_name: opts.ownerName,
    retirement: retirement
      ? clean({
          retirement_beneficiary: retirement.beneficiary_name,
          retirement_detail: retirement.detail,
          retired_at: isoTs(retirement.retired_at),
          purpose: retirement.purpose,
        })
      : undefined,
    labels: block.labels,
    modified_at: isoTs(current?.effective_at ?? agg.modified_at),
  });
  return hal(properties, unitLinks(linker, block, agg.id, source?.serial_number), {
    templates: opts.templates,
  });
}

export function renderUnitIndex(block: UnitBlock, projectId: string, linker: Linker) {
  return hal(
    clean({
      id: block.id,
      serial_number: block.serial_number,
      type: block.unit_type,
      class: block.unit_class,
      vintage: iso(block.vintage_start_on),
      vintage_label: block.vintage_label,
      quantity: block.block_end - block.block_start + 1,
      status: block.cdop_status,
      lifecycle_state: block.state,
      owner_account_id: block.owner_account_id,
      project_id: projectId,
    }),
    {
      self: linker.link(`/v2/units/${block.id}`),
      [linker.rel("project")]: linker.link(`/v2/projects/${projectId}`),
    },
  );
}

export function renderUnitStatusHistory(block: UnitBlock, projectId: string, linker: Linker) {
  const records = [...block.history].sort((a, b) => b.sequence - a.sequence).map(historyRecord);
  return hal(
    { total: records.length, unit_id: block.id },
    {
      self: linker.link(`/v2/units/${block.id}/status-history`),
      curies: linker.curies(),
      up: linker.link(`/v2/units/${block.id}`),
      [linker.rel("project")]: linker.link(`/v2/projects/${projectId}`),
      [linker.rel("state-machine")]: linker.link("/v2/state-machines/unit"),
    },
    { embedded: { "status-records": records } },
  );
}
