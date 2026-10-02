/**
 * Unit-ledger mechanics shared by the UK (PIU → WCU/PCU) and ex-post flows: per-project
 * block numbering, registry serial grammars, blocks with a full status history, splits
 * that keep ranges disjoint, transfers, retirements and cancellations.
 */
import type {
  Account,
  ActorKind,
  Cancellation,
  Issuance,
  ProjectAggregate,
  Retirement,
  Transfer,
  UnitBlock,
  UnitStatusRecord,
} from "./aggregate.js";
import { cdopUnitStatus, type UnitState } from "../domain/lifecycle/units.js";
import type { Rng } from "./prng.js";
import { businessDaysAfter, startOfDayUtc } from "./time.js";
import { makeId, type GenContext, type ProjectSpec } from "./standards/common.js";
import { ddMMyyyy, prune } from "./util.js";

export interface LedgerScope {
  ctx: GenContext;
  spec: ProjectSpec;
  rng: Rng;
  p: ProjectAggregate;
  registry: Account;
  bufferPool: Account;
}

export function blockQuantity(b: Pick<UnitBlock, "block_start" | "block_end">): number {
  return b.block_end - b.block_start + 1;
}

export function vintageLabel(start: Date, end: Date): string {
  const a = start.getUTCFullYear();
  const b = end.getUTCFullYear();
  return a === b ? String(a) : `${a}-${b}`;
}

const NATIVE_STATUS: Record<UnitState, [code: string, name: string]> = {
  pending: ["PENDING", "Pending"],
  active: ["ACTIVE", "Active"],
  on_hold: ["ON_HOLD", "On hold"],
  buffer: ["RESERVE", "Buffer reserve"],
  retired: ["RETIRED", "Retired"],
  cancelled: ["CANCELLED", "Cancelled"],
  expired: ["EXPIRED", "Expired"],
};

interface RecordOptions {
  reason?: string;
  actor: ActorKind;
  actorAccountId?: string;
  fromOwner?: string;
  toOwner?: string;
  quantity?: number;
}

export class Ledger {
  private readonly counters = new Map<string, number>();
  private issuanceSeq = 0;
  private cumulative = 0;
  private local = 0;

  constructor(readonly scope: LedgerScope) {}

  /** A business-hours instant `min..max` days after `from`, or undefined if that is not before now. */
  later(tag: string, from: Date, minDays: number, maxDays: number): Date | undefined {
    const at = businessDaysAfter(
      this.scope.rng,
      `ledger:${tag}`,
      from,
      this.scope.rng.int(`ledger:${tag}:days`, minDays, maxDays),
    );
    return at.getTime() < this.scope.ctx.now.getTime() ? at : undefined;
  }

  private nextRange(unitType: string, quantity: number): [number, number] {
    const start = this.counters.get(unitType) ?? 1;
    this.counters.set(unitType, start + quantity);
    return [start, start + quantity - 1];
  }

  private serial(
    b: Pick<
      UnitBlock,
      | "unit_type"
      | "unit_class"
      | "block_start"
      | "block_end"
      | "vintage_start_on"
      | "vintage_end_on"
    >,
    issuanceSeq: number,
  ): string {
    const { p } = this.scope;
    const year = b.vintage_start_on.getUTCFullYear();
    switch (p.registry_id) {
      case "ukl": {
        const code = p.standard_id === "pc" ? "PC" : "WCC";
        return `${code}-${b.unit_type}-GB-${p.native_project_id}-${ddMMyyyy(b.vintage_start_on)}-${ddMMyyyy(b.vintage_end_on)}-${b.block_start}-${b.block_end}-MER-0-${b.unit_class === "buffer" ? "B" : "P"}`;
      }
      case "verra":
        return `${issuanceSeq}-${b.block_start}-${b.block_end}-VCS-VCU-262-VER-${p.country_code}-14-${p.native_project_id}-${ddMMyyyy(b.vintage_start_on)}-${ddMMyyyy(b.vintage_end_on)}-0`;
      case "gold-standard":
        return `GS1-1-GS-VER-${p.native_project_id}-${year}-${b.block_start}-${b.block_end}`;
      case "acr":
        return `ACR-${p.native_project_id}-${year}-${b.block_start}-${b.block_end}`;
      case "plan-vivo":
        return `PV-${p.native_project_id}-${year}-${b.block_start}-${b.block_end}`;
      default:
        return `CORC-${p.native_project_id}-${year}-${b.block_start}-${b.block_end}`;
    }
  }

  issuance(
    kind: Issuance["kind"],
    unitType: string,
    unitClass: Issuance["unit_class"],
    vintage: [Date, Date],
    volume: number,
    issuedAt: Date,
    recipient: Account,
    links: { verificationEventId?: string; validationEventId?: string } = {},
  ): Issuance {
    const { ctx, spec, p } = this.scope;
    this.issuanceSeq += 1;
    this.cumulative += volume;
    const seq = this.issuanceSeq;
    const issuance: Issuance = prune({
      id: makeId(ctx, spec, "iss", String(seq), issuedAt),
      batch_identifier: `${p.native_project_id}-${unitType}-${vintageLabel(vintage[0], vintage[1])}-${seq}`,
      sequence: seq,
      kind,
      verification_event_id: links.verificationEventId,
      validation_event_id: links.validationEventId,
      status: "Complete" as const,
      issued_on: startOfDayUtc(issuedAt),
      requested_on: startOfDayUtc(issuedAt),
      unit_type: unitType,
      unit_class: unitClass,
      metric: p.unit_metric,
      vintage_start_on: vintage[0],
      vintage_end_on: vintage[1],
      vintage_label: vintageLabel(vintage[0], vintage[1]),
      volume,
      cumulative_volume: this.cumulative,
      recipient_account_id: recipient.id,
      url: p.native_project_url,
    });
    p.issuances.push(issuance);
    return issuance;
  }

  /** A freshly issued block with its first history row. */
  issueBlock(
    issuance: Issuance,
    quantity: number,
    owner: Account,
    state: "active" | "buffer",
    at: Date,
    reason?: string,
    sourceBlockId?: string,
  ): UnitBlock {
    const { ctx, spec, p } = this.scope;
    const [block_start, block_end] = this.nextRange(issuance.unit_type, quantity);
    this.local += 1;
    const [code, name] = NATIVE_STATUS[state];
    const block: UnitBlock = prune({
      id: makeId(ctx, spec, "unt", String(this.local), at),
      issuance_id: issuance.id,
      serial_number: "",
      source_block_id: sourceBlockId,
      block_start,
      block_end,
      unit_type: issuance.unit_type,
      unit_class: issuance.unit_class,
      metric: issuance.metric,
      vintage_start_on: issuance.vintage_start_on,
      vintage_end_on: issuance.vintage_end_on,
      vintage_label: issuance.vintage_label,
      owner_account_id: owner.id,
      state,
      state_reason: reason,
      native_status_code: code,
      native_status_name: name,
      cdop_status: cdopUnitStatus(state, reason),
      labels: [],
      history: [],
    });
    block.serial_number = this.serial(block, issuance.sequence);
    p.blocks.push(block);
    this.record(
      block,
      at,
      sourceBlockId ? "convert" : "issue",
      state,
      prune({
        reason,
        actor: "registry" as const,
        actorAccountId: this.scope.registry.id,
        toOwner: owner.id,
        quantity,
      }),
    );
    return block;
  }

  /** Append a history row and move the block to `to`. */
  record(
    block: UnitBlock,
    at: Date,
    action: string,
    to: UnitState,
    opts: RecordOptions,
  ): UnitStatusRecord {
    const { ctx, spec } = this.scope;
    const from = block.history.length ? block.state : undefined;
    const row: UnitStatusRecord = prune({
      id: makeId(ctx, spec, "ush", `${block.id}:${block.history.length + 1}`, at),
      sequence: block.history.length + 1,
      from_state: from,
      to_state: to,
      cdop_status: cdopUnitStatus(to, opts.reason),
      action,
      reason: opts.reason,
      actor_kind: opts.actor,
      actor_account_id: opts.actorAccountId,
      from_owner_account_id: opts.fromOwner,
      to_owner_account_id: opts.toOwner,
      quantity: opts.quantity,
      effective_at: at,
      is_current: false,
    });
    block.history.push(row);
    block.state = to;
    if (opts.reason !== undefined) block.state_reason = opts.reason;
    else delete block.state_reason;
    block.cdop_status = row.cdop_status;
    const [code, name] = NATIVE_STATUS[to];
    block.native_status_code = code;
    block.native_status_name = name;
    if (opts.toOwner) block.owner_account_id = opts.toOwner;
    return row;
  }

  /** Carve `quantity` off the top of `block` into a child block; the parent keeps the rest. */
  split(block: UnitBlock, quantity: number, at: Date): UnitBlock {
    const { ctx, spec, p } = this.scope;
    if (quantity <= 0 || quantity >= blockQuantity(block))
      throw new Error(`split of ${quantity} from a block of ${blockQuantity(block)}`);
    const issuance = p.issuances.find((i) => i.id === block.issuance_id);
    this.local += 1;
    const child: UnitBlock = {
      ...block,
      id: makeId(ctx, spec, "unt", String(this.local), at),
      source_block_id: block.id,
      block_start: block.block_end - quantity + 1,
      labels: [...block.labels],
      history: [],
    };
    delete child.retirement_id;
    delete child.cancellation_id;
    block.block_end -= quantity;
    block.serial_number = this.serial(block, issuance?.sequence ?? 0);
    child.serial_number = this.serial(child, issuance?.sequence ?? 0);
    p.blocks.push(child);
    this.record(
      block,
      at,
      "split",
      block.state,
      prune({
        reason: block.state_reason,
        actor: "registry" as const,
        actorAccountId: this.scope.registry.id,
        quantity,
      }),
    );
    this.record(
      child,
      at,
      "split",
      block.state,
      prune({
        reason: block.state_reason,
        actor: "registry" as const,
        actorAccountId: this.scope.registry.id,
        fromOwner: block.owner_account_id,
        toOwner: block.owner_account_id,
        quantity,
      }),
    );
    return child;
  }

  /** Move `quantity` units (splitting if partial) to `to`; returns the block that moved. */
  transfer(
    block: UnitBlock,
    quantity: number,
    at: Date,
    from: Account,
    to: Account,
    kind: Transfer["kind"],
    price?: number,
    currency?: string,
  ): UnitBlock {
    const { ctx, spec, p } = this.scope;
    const moving = quantity < blockQuantity(block) ? this.split(block, quantity, at) : block;
    const transfer: Transfer = prune({
      id: makeId(ctx, spec, "trf", moving.id, at),
      block_id: moving.id,
      kind,
      from_account_id: from.id,
      to_account_id: to.id,
      quantity,
      price,
      currency,
      status: "accepted" as const,
      requested_at: at,
      settled_at: at,
      remarks:
        kind === "assignment"
          ? "Assignment of pending issuance units under a forward sale."
          : undefined,
    });
    p.transfers.push(transfer);
    const actor: ActorKind = from.account_type === "project_developer" ? "developer" : "buyer";
    this.record(moving, at, "transfer", moving.state, {
      actor,
      actorAccountId: from.id,
      fromOwner: from.id,
      toOwner: to.id,
      quantity,
    });
    return moving;
  }

  retire(
    block: UnitBlock,
    quantity: number,
    at: Date,
    holder: Account,
    beneficiary: { name: string; organisationId?: string },
    purpose: Retirement["purpose"],
    detail: string,
  ): UnitBlock {
    const { ctx, spec, p } = this.scope;
    const target = quantity < blockQuantity(block) ? this.split(block, quantity, at) : block;
    const retirement: Retirement = prune({
      id: makeId(ctx, spec, "ret", target.id, at),
      block_id: target.id,
      account_id: holder.id,
      quantity,
      retired_at: at,
      beneficiary_name: beneficiary.name,
      beneficiary_organisation_id: beneficiary.organisationId,
      purpose,
      detail,
      vintage_label: target.vintage_label,
    });
    p.retirements.push(retirement);
    target.retirement_id = retirement.id;
    const actor: ActorKind = holder.account_type === "project_developer" ? "developer" : "buyer";
    this.record(target, at, "retire", "retired", { actor, actorAccountId: holder.id, quantity });
    return target;
  }

  cancel(
    block: UnitBlock,
    at: Date,
    action: "cancel" | "cancel_buffer",
    reason: Cancellation["reason"],
    detail: string,
    replacementBlockId?: string,
  ): Cancellation {
    const { ctx, spec, p } = this.scope;
    const cancellation: Cancellation = prune({
      id: makeId(ctx, spec, "cnl", block.id, at),
      block_id: block.id,
      account_id: block.owner_account_id,
      quantity: blockQuantity(block),
      cancelled_at: at,
      reason,
      detail,
      replacement_block_id: replacementBlockId,
    });
    p.cancellations.push(cancellation);
    block.cancellation_id = cancellation.id;
    this.record(block, at, action, "cancelled", {
      reason,
      actor: "registry",
      actorAccountId: this.scope.registry.id,
      quantity: cancellation.quantity,
    });
    return cancellation;
  }

  bufferEntry(
    kind: "deposit" | "release" | "cancellation",
    quantity: number,
    at: Date,
    blockId: string,
    verificationEventId?: string,
    notes?: string,
  ): void {
    const { ctx, spec, p } = this.scope;
    p.bufferEntries.push(
      prune({
        id: makeId(ctx, spec, "bpe", `${kind}:${blockId}`, at),
        standard_id: p.standard_id,
        kind,
        quantity,
        occurred_on: startOfDayUtc(at),
        block_id: blockId,
        verification_event_id: verificationEventId,
        notes,
      }),
    );
  }

  /** Mark the last row of every block's history as current. */
  finalize(): void {
    for (const b of this.scope.p.blocks) {
      b.history.forEach((h, i) => (h.is_current = i === b.history.length - 1));
    }
  }
}
