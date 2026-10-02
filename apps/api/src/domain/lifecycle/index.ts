import { WCC_MACHINE } from "./wcc.js";
import { PC_MACHINE } from "./pc.js";
import {
  ACR_MACHINE,
  GS_MACHINE,
  PLAN_VIVO_MACHINE,
  PURO_MACHINE,
  VCS_MACHINE,
} from "./generic.js";
import type { LifecycleState, NativeState, NativeTransition, StandardMachine } from "./types.js";

export * from "./types.js";

export const MACHINES: Record<string, StandardMachine> = {
  wcc: WCC_MACHINE,
  pc: PC_MACHINE,
  vcs: VCS_MACHINE,
  gs4gg: GS_MACHINE,
  acr: ACR_MACHINE,
  "plan-vivo": PLAN_VIVO_MACHINE,
  puro: PURO_MACHINE,
};

export function machineFor(standardId: string): StandardMachine {
  const m = MACHINES[standardId];
  if (!m) throw new Error(`no state machine for standard ${standardId}`);
  return m;
}

export function nativeState(standardId: string, code: string): NativeState | undefined {
  return machineFor(standardId).states.find((s) => s.code === code);
}

export function transitionsFrom(standardId: string, code: string): NativeTransition[] {
  return machineFor(standardId).transitions.filter((t) => t.from === code);
}

/** Ordered ladder for the canonical project lifecycle (exits are not on the ladder). */
export const LIFECYCLE_LADDER: LifecycleState[] = [
  "draft",
  "listed",
  "registered",
  "validated",
  "verified",
  "retired",
];

/** CAD Trust v2.0 project status → canonical (for the cross-walk shown on /v2/state-machines/project). */
export const CADT_PROJECT_STATUS_TO_LIFECYCLE: Record<string, LifecycleState> = {
  Listed: "listed",
  Registered: "registered",
  Validated: "validated",
  Verified: "verified",
  Certified: "verified",
  Completed: "retired",
  Withdrawn: "withdrawn",
  Inactive: "withdrawn",
  Rejected: "rejected",
};

/** CDOP project_status (17) → canonical. */
export const CDOP_PROJECT_STATUS_TO_LIFECYCLE: Record<string, LifecycleState> = {
  Origination: "draft",
  "Pre-feasibility": "draft",
  Feasibility: "draft",
  "Project design drafting": "draft",
  "Project design finalization": "draft",
  Listed: "listed",
  Validation: "listed",
  Validated: "validated",
  Registered: "registered",
  Approved: "validated",
  Authorized: "validated",
  "Verified and issuing": "verified",
  Completed: "retired",
  Withdrawn: "withdrawn",
  "De-registered": "withdrawn",
  Inactive: "withdrawn",
  Rejected: "rejected",
};
