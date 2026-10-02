export type LifecycleState =
  | "draft"
  | "listed"
  | "registered"
  | "validated"
  | "verified"
  | "retired"
  | "withdrawn"
  | "rejected";

export const LIFECYCLE_STATES: LifecycleState[] = [
  "draft",
  "listed",
  "registered",
  "validated",
  "verified",
  "retired",
  "withdrawn",
  "rejected",
];

/** CDOP v2 project_status enum (17 values), projected from the canonical state + native code. */
export type CdopProjectStatus =
  | "Origination"
  | "Pre-feasibility"
  | "Feasibility"
  | "Project design drafting"
  | "Project design finalization"
  | "Listed"
  | "Validation"
  | "Validated"
  | "Registered"
  | "Approved"
  | "Authorized"
  | "Verified and issuing"
  | "Completed"
  | "Withdrawn"
  | "De-registered"
  | "Inactive"
  | "Rejected";

export type Actor = "developer" | "code_admin" | "vvb" | "registry" | "system";
export type OwnerActor = Actor | "none";
export type Intent =
  | "submit"
  | "approve"
  | "more_info"
  | "reject"
  | "hold"
  | "release"
  | "withdraw"
  | "verify"
  | "issue"
  | "other";

export interface NativeState {
  code: string;
  name: string;
  owner: OwnerActor;
  lifecycle: LifecycleState;
  cdopStatus: CdopProjectStatus;
  phase?: string;
  terminal?: boolean;
}

export interface NativeTransition {
  from: string;
  action: string;
  actor: Actor;
  intent: Intent;
  to: string;
  label: string;
  requiresReason?: boolean;
}

export interface StandardMachine {
  standardId: string;
  states: NativeState[];
  transitions: NativeTransition[];
}
