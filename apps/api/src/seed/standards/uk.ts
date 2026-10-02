/**
 * The flow both UK codes share on the UK Land Carbon Registry: registration review,
 * validation (with or without a payment hold), Pending Issuance Units at validation, and
 * verification on the code's schedule converting matured vintages. wcc.ts and pc.ts supply
 * the state codes, document catalogue and carbon numbers.
 */
import type {
  ProjectAggregate,
  ProjectMitigation,
  ValidationEvent,
  VerificationEvent,
} from "../aggregate.js";
import { nativeState } from "../../domain/lifecycle/index.js";
import { buildUkLedger, INITIAL_VALIDATION } from "../ledger.js";
import { pickSkewed } from "../parties.js";
import type { Rng } from "../prng.js";
import { addDays, addYears, startOfDayUtc } from "../time.js";
import { lastOf, prune } from "../util.js";
import { projectShell, touch, Walker } from "./assemble.js";
import {
  makeCreditingPeriod,
  makeDocument,
  makeEstimations,
  makeGeolocationFile,
  makeId,
  makeMilestone,
  makeSite,
  seatsFor,
  statusRecords,
  type GenContext,
  type ProjectSpec,
  type VintagePlan,
} from "./common.js";
import {
  makeAgreement,
  makeCobenefits,
  makeFinance,
  makeLabel,
  makeLandowners,
  makeSdgs,
  makeStakeholders,
} from "./extras.js";

export interface UkCodes {
  development: string;
  customerReview: string;
  systemReview: string;
  paymentHold: string;
  holdAction: string;
  releaseAction: string;
  /** WCC can validate straight from system review; PC always holds for payment first. */
  approveSystemAction?: string;
  validateAction: string;
  validated: string;
  verified: string;
  restoration?: { submitAction: string; pending: string[]; validated: string };
}

export interface UkDocs {
  registration: string[];
  validation: string[];
  validationStatement: string;
  restorationStatement?: string;
  progressReport: string;
  verificationStatement: string;
  /** Document types the attestations point at. */
  ownership: string;
  pdd: string;
}

export interface UkProfile {
  codes: UkCodes;
  docs: UkDocs;
  areaType: string;
  claimType: string;
  cobenefitMethod: string;
}

export interface UkCarbon {
  name: string;
  description: string;
  nativeProjectId: string;
  areaHa: number;
  startOn: Date;
  durationYears: number;
  totalMitigation: number;
  bufferRate: number;
  standardVersion: string;
  methodologyVersionId: string;
  activityType: string;
  mitigation: Pick<ProjectMitigation, "mitigation_type" | "project_sector" | "project_type">;
  unitPrice: number;
  nativeAttributes: Record<string, unknown>;
  projectRisk: Record<string, unknown>;
  validationDeadlineYears?: number;
}

function monitoringEnd(startOn: Date, spec: ProjectSpec, k: number): Date {
  const { first_year, interval_years } = spec.standard.verification_schedule;
  return addDays(addYears(startOn, first_year + k * interval_years), -1);
}

function walkUk(w: Walker, rng: Rng, spec: ProjectSpec, c: UkCodes, startOn: Date): void {
  const validate = (): boolean => {
    if (!w.to(c.systemReview)) return false;
    if (c.approveSystemAction && !rng.bool("walk:payhold", 0.3))
      return w.edge(c.approveSystemAction);
    return w.edge(c.holdAction) && w.edge(c.releaseAction);
  };
  // Restoration works take a season or two after validation before the VVB is called back.
  const submitRestoration = (): boolean =>
    c.restoration
      ? w.edge(c.restoration.submitAction, addDays(w.at, rng.int("walk:restoration:lag", 200, 600)))
      : true;
  const target = spec.target;

  if (target === "WITHDRAWN") {
    if (rng.bool("walk:withdraw:late", 0.3) ? validate() : w.to(c.development)) w.edge("WITHDRAW");
  } else if (target === "NOT_DELIVERED") {
    if (w.to(c.development))
      w.edge(
        "NOT_DELIVERED",
        addDays(addYears(w.at, 3), rng.int("walk:notdelivered:lag", 10, 120)),
      );
  } else if (nativeState(spec.standard.id, target)?.lifecycle === "rejected") {
    w.exit(target);
  } else if (target === c.paymentHold) {
    if (w.to(c.systemReview)) w.edge(c.holdAction);
  } else if (target === c.validated) {
    validate();
  } else if (
    c.restoration &&
    (c.restoration.pending.includes(target) || target === c.restoration.validated)
  ) {
    if (validate() && submitRestoration()) w.to(target);
  } else if (target === c.verified) {
    if (!validate() || !submitRestoration()) return;
    if (c.restoration && !w.to(c.restoration.validated)) return;
    for (let k = 0; k < 3; k++) {
      if (
        !w.edge(
          "VERIFY",
          addDays(monitoringEnd(startOn, spec, k), rng.int(`walk:verify:${k}:lag`, 60, 270)),
        )
      )
        return;
    }
  } else {
    w.to(target);
  }
}

export function buildUkProject(
  ctx: GenContext,
  spec: ProjectSpec,
  rng: Rng,
  profile: UkProfile,
  carbon: UkCarbon,
): ProjectAggregate {
  const { codes: c, docs } = profile;
  const seats = seatsFor(ctx, spec);
  const site = makeSite(ctx, spec, rng, carbon.areaHa);

  const w = new Walker(ctx, spec, rng);
  const initial = w.state;
  walkUk(w, rng, spec, c, carbon.startOn);
  const statusHistory = statusRecords(ctx, spec, rng, initial, spec.createdAt, w.steps, seats);

  const registeredAt = w.firstInto(c.development)?.at;
  const p = projectShell(
    ctx,
    spec,
    prune({
      name: carbon.name,
      description: carbon.description,
      nativeProjectId: carbon.nativeProjectId,
      standardVersion: carbon.standardVersion,
      methodologyVersionId: carbon.methodologyVersionId,
      activityType: carbon.activityType,
      site,
      statusHistory,
      mitigation: carbon.mitigation,
      startOn: carbon.startOn,
      endOn: addDays(addYears(carbon.startOn, carbon.durationYears), -1),
      durationYears: carbon.durationYears,
      creditingPeriodType: "Fixed" as const,
      maxCumulativeCreditingYears: carbon.durationYears,
      maxCreditingPeriods: 1,
      totalMitigation: carbon.totalMitigation,
      bufferRate: carbon.bufferRate,
      validationDeadlineOn:
        registeredAt && carbon.validationDeadlineYears
          ? startOfDayUtc(addYears(registeredAt, carbon.validationDeadlineYears))
          : undefined,
    }),
  );
  p.native_attributes = carbon.nativeAttributes;
  p.project_risk = carbon.projectRisk;
  p.governance_structure = `${spec.developer.organisation.legal_name} manages the project on behalf of the landowner under the code's commitment statement.`;
  p.public_comment = false;
  p.previous_program = false;

  // ------------------------------------------------------------------------------ validation
  const submitted = w.firstAction(c.validateAction);
  const validatedStep = w.firstInto(c.validated);
  let validation: ValidationEvent | undefined;
  if (submitted) {
    const status: ValidationEvent["status"] = validatedStep
      ? "completed"
      : w.state === c.customerReview
        ? "changes_requested"
        : nativeState(spec.standard.id, w.state)?.terminal
          ? "withdrawn"
          : "in_review";
    const visit = addDays(submitted.at, rng.int("val:visit", 14, 40));
    const visited = validatedStep
      ? visit.getTime() < validatedStep.at.getTime()
      : visit.getTime() < ctx.now.getTime();
    validation = prune({
      id: makeId(ctx, spec, "val", "1", submitted.at),
      sequence: 1,
      validation_type: INITIAL_VALIDATION,
      status,
      vvb_organisation_id: spec.vvb.organisation.id,
      vvb_account_id: seats.vvb.id,
      submitted_on: startOfDayUtc(submitted.at),
      site_visit_start_on: visited ? startOfDayUtc(visit) : undefined,
      site_visit_end_on: visited
        ? startOfDayUtc(addDays(visit, rng.int("val:visit:days", 0, 2)))
        : undefined,
      decided_on: validatedStep ? startOfDayUtc(validatedStep.at) : undefined,
      opinion: validatedStep ? ("positive" as const) : undefined,
    });
    p.validations.push(validation);
  }
  const restorationStep = c.restoration ? w.firstInto(c.restoration.validated) : undefined;
  const restorationSubmitted = c.restoration
    ? w.firstAction(c.restoration.submitAction)
    : undefined;
  let restoration: ValidationEvent | undefined;
  if (restorationSubmitted) {
    restoration = prune({
      id: makeId(ctx, spec, "val", "2", restorationSubmitted.at),
      sequence: 2,
      validation_type: "Other",
      status: restorationStep ? ("completed" as const) : ("in_review" as const),
      vvb_organisation_id: spec.vvb.organisation.id,
      vvb_account_id: seats.vvb.id,
      submitted_on: startOfDayUtc(restorationSubmitted.at),
      decided_on: restorationStep ? startOfDayUtc(restorationStep.at) : undefined,
      opinion: restorationStep ? ("positive" as const) : undefined,
      notes: "Restoration validation: confirms the restoration works were delivered as designed.",
    });
    p.validations.push(restoration);
  }

  // ------------------------------------------------------------- crediting period, estimates
  const period = makeCreditingPeriod(
    ctx,
    spec,
    1,
    carbon.startOn,
    carbon.durationYears,
    "Fixed",
    validatedStep ? validation?.id : undefined,
  );
  p.creditingPeriods.push(period);
  if (validation && validatedStep) validation.crediting_period_id = period.id;
  const plan: VintagePlan = {
    startOn: carbon.startOn,
    durationYears: carbon.durationYears,
    periodYears: spec.standard.vintage_period_years,
    totalMitigation: carbon.totalMitigation,
    bufferRate: carbon.bufferRate,
  };
  p.estimations = makeEstimations(
    ctx,
    spec,
    plan,
    spec.createdAt,
    validatedStep?.at,
    validatedStep ? validation?.id : undefined,
  );
  const vintages = lastOf(p.estimations).vintages;

  // ---------------------------------------------------------------------------- verifications
  const verifySteps = w.steps.filter((s) => s.transition.action === "VERIFY");
  verifySteps.forEach((step, k) => {
    const end = monitoringEnd(carbon.startOn, spec, k);
    const start = k === 0 ? carbon.startOn : addDays(monitoringEnd(carbon.startOn, spec, k - 1), 1);
    const gap = Math.max(12, Math.round((step.at.getTime() - end.getTime()) / 86_400_000));
    const visit = addDays(end, Math.min(gap - 8, rng.int(`vrf:${k}:visit`, 5, 40)));
    const v: VerificationEvent = {
      id: makeId(ctx, spec, "vrf", String(k + 1), step.at),
      sequence: k + 1,
      monitoring_period_start_on: start,
      monitoring_period_end_on: end,
      status: "completed",
      vvb_organisation_id: spec.vvb.organisation.id,
      site_visit_start_on: startOfDayUtc(visit),
      site_visit_end_on: startOfDayUtc(addDays(visit, rng.int(`vrf:${k}:visit:days`, 0, 2))),
      submitted_on: startOfDayUtc(addDays(step.at, -rng.int(`vrf:${k}:submitted`, 3, 7))),
      verified_on: startOfDayUtc(step.at),
      opinion: "positive",
      claim_type: profile.claimType,
      uom: "tCO2e",
      predicted_quantity: vintages
        .filter(
          (x) =>
            x.vintage_end_on.getTime() <= end.getTime() &&
            x.vintage_end_on.getTime() >= start.getTime(),
        )
        .reduce((s, x) => s + x.estimated_mitigation, 0),
      leakage_deduction: 0,
      buffer_deduction: 0,
      uncertainty_deduction: 0,
    };
    p.verifications.push(v);
  });

  // -------------------------------------------------------------------------------- documents
  const firstSubmit = w.steps[0];
  if (firstSubmit) {
    docs.registration.forEach((typeId, i) =>
      p.documents.push(
        makeDocument(ctx, spec, rng, `reg:${i}`, typeId, carbon.name, firstSubmit.at, {
          uploadedBy: seats.developer.id,
        }),
      ),
    );
    p.geolocationFiles.push(
      makeGeolocationFile(
        ctx,
        spec,
        site,
        "boundary",
        profile.areaType,
        lastOf(p.documents).uploaded_at,
        `${carbon.nativeProjectId}_boundary.geojson`,
      ),
    );
  }
  if (submitted && validation) {
    const id = validation.id;
    docs.validation.forEach((typeId, i) =>
      p.documents.push(
        makeDocument(ctx, spec, rng, `val:${i}`, typeId, carbon.name, submitted.at, {
          uploadedBy: seats.developer.id,
          validationEventId: id,
        }),
      ),
    );
    if (rng.bool("gis:revised", 0.4))
      p.geolocationFiles.push(
        makeGeolocationFile(
          ctx,
          spec,
          site,
          "accounting",
          "Project Accounting Area",
          lastOf(p.documents).uploaded_at,
          `${carbon.nativeProjectId}_net_area.geojson`,
        ),
      );
  }
  if (validatedStep && validation) {
    const doc = makeDocument(
      ctx,
      spec,
      rng,
      "val:statement",
      docs.validationStatement,
      carbon.name,
      validatedStep.at,
      { uploadedBy: seats.vvb.id, validationEventId: validation.id },
    );
    p.documents.push(doc);
    validation.statement_document_id = doc.id;
  }
  if (restorationStep && restoration && docs.restorationStatement) {
    const doc = makeDocument(
      ctx,
      spec,
      rng,
      "val:restoration",
      docs.restorationStatement,
      carbon.name,
      restorationStep.at,
      { uploadedBy: seats.vvb.id, validationEventId: restoration.id },
    );
    p.documents.push(doc);
    restoration.statement_document_id = doc.id;
  }
  p.verifications.forEach((v, k) => {
    const step = verifySteps[k];
    if (!step) return;
    const report = makeDocument(
      ctx,
      spec,
      rng,
      `vrf:${k}:report`,
      docs.progressReport,
      carbon.name,
      v.submitted_on ?? step.at,
      {
        uploadedBy: seats.developer.id,
        verificationEventId: v.id,
        versionLabel: `year-${v.monitoring_period_end_on.getUTCFullYear() - carbon.startOn.getUTCFullYear()}`,
      },
    );
    const statement = makeDocument(
      ctx,
      spec,
      rng,
      `vrf:${k}:statement`,
      docs.verificationStatement,
      carbon.name,
      step.at,
      {
        uploadedBy: seats.vvb.id,
        verificationEventId: v.id,
        versionLabel: `verification-${v.sequence}`,
      },
    );
    p.documents.push(report, statement);
    v.report_document_id = report.id;
    v.statement_document_id = statement.id;
  });
  const ownership = p.documents.find((d) => d.document_type_id === docs.ownership);
  const pdd = p.documents.find((d) => d.document_type_id === docs.pdd);
  p.attestations = prune({
    carbon_credit_ownership_attestation: true,
    carbon_credit_ownership_documentation: ownership?.id,
    legal_compliance_attestation: true,
    legal_compliance_documentation: pdd?.id,
    land_ownership_attestation: true,
    land_ownership_documentation: ownership?.id,
    land_right_attestation: true,
  });

  // ------------------------------------------------------------------------------- milestones
  if (registeredAt && carbon.validationDeadlineYears) {
    p.milestones.push(
      makeMilestone(
        ctx,
        spec,
        "validation_due",
        "Validation due",
        1,
        addYears(registeredAt, carbon.validationDeadlineYears),
        validatedStep && validation
          ? { at: validatedStep.at, validationEventId: validation.id }
          : undefined,
      ),
    );
  }
  if (validatedStep) {
    if (c.restoration && validation) {
      p.milestones.push(
        makeMilestone(
          ctx,
          spec,
          "restoration_validation_due",
          "Restoration validation due",
          2,
          addYears(validatedStep.at, 2),
          restorationStep && restoration
            ? { at: restorationStep.at, validationEventId: restoration.id }
            : undefined,
        ),
      );
    }
    for (let k = 0; k < Math.max(2, verifySteps.length + 1); k++) {
      const end = monitoringEnd(carbon.startOn, spec, k);
      if (end.getTime() > period.end_on.getTime()) break;
      const year =
        spec.standard.verification_schedule.first_year +
        k * spec.standard.verification_schedule.interval_years;
      const v = p.verifications[k];
      const step = verifySteps[k];
      p.milestones.push(
        makeMilestone(
          ctx,
          spec,
          "verification_due",
          `Year ${year} verification`,
          10 + k,
          addYears(end, 1),
          v && step ? { at: step.at, verificationEventId: v.id } : undefined,
        ),
      );
    }
    p.milestones.push(
      makeMilestone(ctx, spec, "crediting_period_end", "Project end", 99, period.end_on),
    );
  }

  // ---------------------------------------------------------------------------------- extras
  p.stakeholders = makeStakeholders(ctx, spec, spec.createdAt);
  p.landowners = makeLandowners(rng, spec);
  p.finance = makeFinance(rng, carbon.areaHa, carbon.totalMitigation, "GBP", carbon.unitPrice);
  if (rng.bool("extras:cobenefits", 0.6)) {
    p.sdgs = makeSdgs(rng);
    p.cobenefitMethods = [profile.cobenefitMethod];
    p.cobenefits = makeCobenefits(ctx, spec, rng, p.verifications);
  }
  if (validatedStep && rng.bool("extras:agreement", 0.2)) {
    const buyer = pickSkewed(rng, "extras:agreement:buyer", ctx.parties.buyers);
    const at = addDays(validatedStep.at, rng.int("extras:agreement:lag", 20, 300));
    if (at.getTime() < ctx.now.getTime())
      p.agreements.push(
        makeAgreement(
          ctx,
          spec,
          rng,
          buyer,
          at,
          "GBP",
          carbon.unitPrice,
          Math.round(
            carbon.totalMitigation *
              (1 - carbon.bufferRate) *
              rng.float("extras:agreement:share", 0.2, 0.7),
          ),
          carbon.startOn.getUTCFullYear(),
        ),
      );
  }
  if (validatedStep && rng.bool("extras:ukets", 0.1))
    p.labels.push(
      makeLabel(ctx, spec, "uk-ets-eligible", "compliance_potential", validatedStep.at),
    );

  buildUkLedger(ctx, spec, rng, p);
  touch(p);
  return p;
}
