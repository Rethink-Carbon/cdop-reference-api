/**
 * Simplified machines for the international standards. State names approximate the public
 * registries' vocabularies (Verra, Gold Standard, ACR, Plan Vivo, Puro). Flagged for review.
 */
import type { NativeState, NativeTransition, StandardMachine } from "./types.js";

const S = (
  code: string,
  name: string,
  owner: NativeState["owner"],
  lifecycle: NativeState["lifecycle"],
  cdopStatus: NativeState["cdopStatus"],
  phase?: string,
  terminal = false,
): NativeState => {
  const s: NativeState = { code, name, owner, lifecycle, cdopStatus, terminal };
  if (phase) s.phase = phase;
  return s;
};
const T = (
  from: string,
  action: string,
  actor: NativeTransition["actor"],
  intent: NativeTransition["intent"],
  to: string,
  label: string,
  requiresReason = false,
): NativeTransition => ({
  from,
  action,
  actor,
  intent,
  to,
  label,
  requiresReason,
});

function exPostMachine(
  standardId: string,
  names: { registered: string; issuing: string; ended: string },
): StandardMachine {
  const states: NativeState[] = [
    S("UNDER_DEVELOPMENT", "Under Development", "developer", "draft", "Project design drafting"),
    S("LISTED", "Listed", "developer", "listed", "Listed"),
    S("UNDER_VALIDATION", "Under Validation", "vvb", "listed", "Validation", "validation_review"),
    S(
      "REGISTRATION_REQUESTED",
      "Registration Requested",
      "registry",
      "listed",
      "Validated",
      "registration_review",
    ),
    S("REGISTERED", names.registered, "registry", "validated", "Registered"),
    S(
      "VERIFICATION_APPROVAL_REQUESTED",
      "Verification Approval Requested",
      "registry",
      "validated",
      "Registered",
      "verification_review",
    ),
    S("UNITS_ISSUED", names.issuing, "registry", "verified", "Verified and issuing"),
    S("ON_HOLD", "On Hold", "registry", "validated", "Inactive", "hold"),
    S("CREDITING_PERIOD_ENDED", names.ended, "registry", "retired", "Completed", undefined, true),
    S("INACTIVE", "Inactive", "registry", "withdrawn", "Inactive", undefined, true),
    S("WITHDRAWN", "Withdrawn", "developer", "withdrawn", "Withdrawn", undefined, true),
    S("REJECTED", "Rejected", "registry", "rejected", "Rejected", undefined, true),
  ];
  const transitions: NativeTransition[] = [
    T("UNDER_DEVELOPMENT", "LIST", "developer", "submit", "LISTED", "List the project"),
    T(
      "LISTED",
      "SUBMIT_FOR_VALIDATION",
      "developer",
      "submit",
      "UNDER_VALIDATION",
      "Submit for validation",
    ),
    T("LISTED", "WITHDRAW", "developer", "withdraw", "WITHDRAWN", "Withdraw the project", true),
    T(
      "UNDER_VALIDATION",
      "VALIDATION_COMPLETE",
      "vvb",
      "approve",
      "REGISTRATION_REQUESTED",
      "Issue validation opinion and request registration",
    ),
    T("UNDER_VALIDATION", "REQUEST_CHANGES", "vvb", "more_info", "LISTED", "Request changes", true),
    T(
      "UNDER_VALIDATION",
      "VALIDATION_FAILED",
      "vvb",
      "reject",
      "REJECTED",
      "Negative validation opinion",
      true,
    ),
    T(
      "REGISTRATION_REQUESTED",
      "REGISTER",
      "registry",
      "approve",
      "REGISTERED",
      "Register the project",
    ),
    T(
      "REGISTRATION_REQUESTED",
      "REQUEST_CHANGES",
      "registry",
      "more_info",
      "LISTED",
      "Request changes",
      true,
    ),
    T(
      "REGISTRATION_REQUESTED",
      "REJECT",
      "registry",
      "reject",
      "REJECTED",
      "Reject registration",
      true,
    ),
    T(
      "REGISTERED",
      "REQUEST_VERIFICATION_APPROVAL",
      "developer",
      "submit",
      "VERIFICATION_APPROVAL_REQUESTED",
      "Submit verification for approval",
    ),
    T("REGISTERED", "HOLD", "registry", "hold", "ON_HOLD", "Place on hold", true),
    T("REGISTERED", "WITHDRAW", "developer", "withdraw", "WITHDRAWN", "Withdraw the project", true),
    T(
      "VERIFICATION_APPROVAL_REQUESTED",
      "APPROVE_VERIFICATION",
      "registry",
      "issue",
      "UNITS_ISSUED",
      "Approve verification and issue units",
    ),
    T(
      "VERIFICATION_APPROVAL_REQUESTED",
      "REQUEST_CHANGES",
      "registry",
      "more_info",
      "REGISTERED",
      "Request changes",
      true,
    ),
    T(
      "UNITS_ISSUED",
      "REQUEST_VERIFICATION_APPROVAL",
      "developer",
      "submit",
      "VERIFICATION_APPROVAL_REQUESTED",
      "Submit a further verification",
    ),
    T("UNITS_ISSUED", "HOLD", "registry", "hold", "ON_HOLD", "Place on hold", true),
    T(
      "UNITS_ISSUED",
      "END_CREDITING_PERIOD",
      "registry",
      "other",
      "CREDITING_PERIOD_ENDED",
      "End the crediting period",
    ),
    T("ON_HOLD", "RELEASE", "registry", "release", "REGISTERED", "Release the hold"),
    T("ON_HOLD", "DEACTIVATE", "registry", "reject", "INACTIVE", "Deactivate", true),
  ];
  return { standardId, states, transitions };
}

export const VCS_MACHINE = exPostMachine("vcs", {
  registered: "Registered",
  issuing: "Units Issued",
  ended: "Crediting Period Ended",
});
export const GS_MACHINE = exPostMachine("gs4gg", {
  registered: "Certified Design",
  issuing: "Certified Project",
  ended: "Crediting Period Ended",
});
export const ACR_MACHINE = exPostMachine("acr", {
  registered: "Registered",
  issuing: "Verified",
  ended: "Completed",
});
export const PLAN_VIVO_MACHINE = exPostMachine("plan-vivo", {
  registered: "Registered",
  issuing: "Issuing",
  ended: "Archived",
});
export const PURO_MACHINE = exPostMachine("puro", {
  registered: "Registered",
  issuing: "Output Audited",
  ended: "Removed",
});
