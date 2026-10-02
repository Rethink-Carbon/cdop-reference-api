/** Canonical unit-block machine and its projections onto CDOP / CAD Trust vocabularies. */
export type UnitState =
  "pending" | "active" | "on_hold" | "buffer" | "retired" | "cancelled" | "expired";

export type CdopUnitStatus =
  | "Active"
  | "On Hold"
  | "Pending Transfer"
  | "Accepted Pending Payment"
  | "Deposited Released"
  | "Retired"
  | "Cancelled";

export interface UnitTransition {
  from: UnitState;
  action: string;
  actor: "registry" | "holder" | "system";
  to: UnitState;
  emits: string;
  label: string;
}

export const UNIT_TRANSITIONS: UnitTransition[] = [
  {
    from: "pending",
    action: "activate",
    actor: "registry",
    to: "active",
    emits: "org.cdop.unit.status.changed",
    label: "Activate",
  },
  {
    from: "pending",
    action: "convert",
    actor: "registry",
    to: "cancelled",
    emits: "org.cdop.unit.converted",
    label: "Convert to verified units",
  },
  {
    from: "pending",
    action: "transfer",
    actor: "holder",
    to: "pending",
    emits: "org.cdop.unit.transferred",
    label: "Transfer",
  },
  {
    from: "active",
    action: "hold",
    actor: "registry",
    to: "on_hold",
    emits: "org.cdop.unit.status.changed",
    label: "Put on hold",
  },
  {
    from: "active",
    action: "transfer",
    actor: "holder",
    to: "active",
    emits: "org.cdop.unit.transferred",
    label: "Transfer",
  },
  {
    from: "active",
    action: "retire",
    actor: "holder",
    to: "retired",
    emits: "org.cdop.unit.status.changed",
    label: "Retire",
  },
  {
    from: "active",
    action: "cancel",
    actor: "registry",
    to: "cancelled",
    emits: "org.cdop.unit.status.changed",
    label: "Cancel",
  },
  {
    from: "active",
    action: "expire",
    actor: "registry",
    to: "expired",
    emits: "org.cdop.unit.status.changed",
    label: "Expire",
  },
  {
    from: "active",
    action: "deposit_buffer",
    actor: "registry",
    to: "buffer",
    emits: "org.cdop.buffer_pool.deposited",
    label: "Deposit into buffer pool",
  },
  {
    from: "on_hold",
    action: "release",
    actor: "registry",
    to: "active",
    emits: "org.cdop.unit.status.changed",
    label: "Release hold",
  },
  {
    from: "on_hold",
    action: "cancel",
    actor: "registry",
    to: "cancelled",
    emits: "org.cdop.unit.status.changed",
    label: "Cancel",
  },
  {
    from: "buffer",
    action: "release_buffer",
    actor: "registry",
    to: "active",
    emits: "org.cdop.buffer_pool.released",
    label: "Release from buffer pool",
  },
  {
    from: "buffer",
    action: "cancel_buffer",
    actor: "registry",
    to: "cancelled",
    emits: "org.cdop.buffer_pool.reversal_covered",
    label: "Cancel buffer units against a reversal",
  },
];

export function cdopUnitStatus(state: UnitState, reason?: string | null): CdopUnitStatus {
  switch (state) {
    case "pending":
    case "active":
      return "Active";
    case "on_hold":
      if (reason === "pending_transfer") return "Pending Transfer";
      if (reason === "accepted_pending_payment") return "Accepted Pending Payment";
      return "On Hold";
    case "buffer":
      return "Deposited Released";
    case "retired":
      return "Retired";
    case "cancelled":
    case "expired":
      return "Cancelled";
  }
}

export const CADT_UNIT_STATUS: Record<UnitState, string> = {
  pending: "Issued",
  active: "Held",
  on_hold: "Inactive",
  buffer: "Buffer",
  retired: "Retired",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function unitTransitionsFrom(state: UnitState): UnitTransition[] {
  return UNIT_TRANSITIONS.filter((t) => t.from === state);
}
