import { POD_NAMES, ROUND2_PODS, type PodName } from "@cdop/schemas";
import { describe, expect, it } from "vitest";
import { buildPodDocument, validateDocument } from "../src/domain/projection/cdop.js";
import { contextFromDataset } from "../src/domain/projection/context.js";
import { explainConformance } from "../src/http/conformance.js";
import { generateDataset, type Counts } from "../src/seed/generate.js";

const COUNTS: Counts = { wcc: 40, pc: 30, vcs: 30, gs4gg: 8, acr: 8, "plan-vivo": 6, puro: 4 };
const ds = generateDataset({ seed: "2026", counts: COUNTS });
const ctx = contextFromDataset(ds, "https://cdop.example");

/** Pods no published-schema defect touches: every document must validate, for every project. */
const CLEAN_PODS: PodName[] = [
  "location-details",
  "disclosures",
  "issuances",
  "crediting-period",
  "estimations",
  "co-benefits",
  "durability-permanence",
  "project-finance",
];
/** Register entries allowed to explain a failure. Anything else is a bug in this API. */
const KNOWN = [
  "CDOP-FB-005",
  "CDOP-FB-020",
  "CDOP-FB-028",
  "CDOP-FB-029",
  // Round 2 drafts: unpublished required values, the CDM sectoral scopes, the required DID.
  "CDOP-FB-035",
  "CDOP-FB-038",
  "CDOP-FB-039",
];

function sweep(strict: boolean): Array<{
  project: string;
  standard: string;
  pod: PodName;
  valid: boolean;
  refs: string[];
  unexplained: string[];
}> {
  const rows = [];
  for (const p of ds.projects) {
    for (const pod of POD_NAMES) {
      if (pod === "unit-description" && p.blocks.length === 0 && !strict) continue;
      // Verification Metadata describes a verification event; without one there is no document.
      if (pod === "verification-metadata" && p.verifications.length === 0) continue;
      const result = buildPodDocument(p, ctx, pod, { strict });
      const c = explainConformance(validateDocument(pod, result.document), result.missing);
      rows.push({
        project: p.id,
        standard: p.standard_id,
        pod,
        valid: c.valid,
        refs: c.refs,
        unexplained: c.unexplained.map((e) => `${e.instancePath} ${e.message}`),
      });
    }
  }
  return rows;
}

describe.each([
  ["strict", true],
  ["default", false],
])("CDOP conformance of every seeded project x every pod (%s mode)", (_mode, strict) => {
  const rows = sweep(strict);

  it("covers every standard and every pod", () => {
    expect(new Set(rows.map((r) => r.standard)).size).toBe(7);
    expect(new Set(rows.map((r) => r.pod)).size).toBe(POD_NAMES.length);
  });

  it("never fails for a reason the feedback register does not record", () => {
    expect(
      rows
        .filter((r) => r.unexplained.length > 0)
        .map((r) => `${r.project} ${r.pod}: ${r.unexplained.join("; ")}`),
    ).toEqual([]);
    for (const r of rows) for (const ref of r.refs) expect(KNOWN).toContain(ref);
  });

  if (strict) {
    it("validates every pod the published defects do not touch", () => {
      expect(
        rows
          .filter((r) => CLEAN_PODS.includes(r.pod) && !r.valid)
          .map((r) => `${r.project} ${r.pod}`),
      ).toEqual([]);
    });

    it("validates Project Approach & Details for every standard CDOP's enums know (CDOP-FB-028 is UK only)", () => {
      const pad = rows.filter((r) => r.pod === "project-approach-details");
      expect(pad.filter((r) => !["wcc", "pc"].includes(r.standard) && !r.valid)).toEqual([]);
      for (const r of pad.filter((x) => ["wcc", "pc"].includes(x.standard)))
        expect(r.refs).toEqual(["CDOP-FB-028"]);
    });

    it("fails Full List only on the recorded defects, compliance_market_id among them (CDOP-FB-020)", () => {
      const full = rows.filter((r) => r.pod === "full-list");
      expect(full.every((r) => !r.valid && r.refs.includes("CDOP-FB-020"))).toBe(true);
    });

    it("validates Verification Metadata for every verified project once the DID is a placeholder", () => {
      const ver = rows.filter((r) => r.pod === "verification-metadata");
      expect(ver.length).toBeGreaterThan(0);
      expect(ver.filter((r) => !r.valid).map((r) => r.project)).toEqual([]);
    });

    it("validates Validation Metadata for every UK project, whose registry publishes the validation deadline", () => {
      const uk = rows.filter((r) => r.pod === "validation-metadata" && r.standard === "wcc");
      expect(uk.filter((r) => !r.valid).map((r) => `${r.project} ${r.refs.join(",")}`)).toEqual([]);
    });
  }

  it("validates Registry Metadata for every project", () => {
    const reg = rows.filter((r) => r.pod === "registry-metadata");
    expect(reg.filter((r) => !r.valid).map((r) => r.project)).toEqual([]);
  });

  it("fails the Round 2 drafts only on the Round 2 register entries", () => {
    for (const r of rows.filter((x) => ROUND2_PODS.includes(x.pod)))
      for (const ref of r.refs)
        expect(["CDOP-FB-035", "CDOP-FB-038", "CDOP-FB-039"]).toContain(ref);
  });
});

describe("Round 2 draft pods", () => {
  it("leaves the sectoral scope out only where the CDM list has none (CDOP-FB-038)", () => {
    for (const p of ds.projects) {
      const result = buildPodDocument(p, ctx, "validation-metadata");
      const doc = result.document as {
        validation_body?: { details?: Array<{ validation_body_sectoral_scopes?: string[] }> };
      };
      for (const body of doc.validation_body?.details ?? []) {
        const scoped = body.validation_body_sectoral_scopes !== undefined;
        expect(
          scoped ||
            result.missing.includes("validation_body.details.validation_body_sectoral_scopes"),
        ).toBe(true);
        if (["pc", "puro", "acr"].includes(p.standard_id)) expect(scoped, p.id).toBe(false);
      }
    }
  });

  it("keeps validation dates, reports and events index-aligned (CDOP-FB-034)", () => {
    for (const p of ds.projects) {
      const doc = buildPodDocument(p, ctx, "validation-metadata").document as {
        validation: { date?: unknown[]; validation_event?: unknown[]; report?: unknown[] };
      };
      const n = p.validations.length;
      expect(doc.validation.validation_event?.length ?? 0).toBe(n);
      expect(doc.validation.date?.length ?? 0).toBe(n);
      expect(doc.validation.report?.length ?? 0).toBe(n);
    }
  });

  it("describes the chosen verification event and states the deductions it nets off", () => {
    const p = ds.projects.find(
      (x) => x.verifications.filter((v) => v.status === "completed").length > 1,
    );
    expect(p).toBeDefined();
    if (!p) return;
    const first = p.verifications.find((v) => v.status === "completed");
    const doc = buildPodDocument(p, ctx, "verification-metadata", { verificationId: first?.id })
      .document as {
      verification: {
        verification_id: string;
        quantity: Array<{ verified_quantity: number }>;
        deductions: Array<Record<string, number>>;
      };
    };
    expect(doc.verification.verification_id).toBe(first?.id);
    const d = doc.verification.deductions[0] ?? {};
    expect(doc.verification.quantity[0]?.verified_quantity).toBeCloseTo(
      (first?.gross_verified_quantity ?? 0) -
        (d.verification_leakage_deduction_quantity ?? 0) -
        (d.verification_buffer_pool_deduction_quantity ?? 0) -
        (first?.uncertainty_deduction ?? 0),
      2,
    );
  });
});

describe("standard-level accreditation, field 242 (CDOP-FB-021)", () => {
  it("carries the Full List value into Labels & Certifications at that pod's own path", () => {
    let accredited = 0;
    for (const p of ds.projects) {
      const full = buildPodDocument(p, ctx, "full-list").document as {
        carbon_crediting_standard?: { carbon_standard_level_accreditation?: string };
      };
      const labels = buildPodDocument(p, ctx, "labels-certifications").document as {
        crediting_program?: { carbon_standard_level_accreditation?: string };
      };
      const value = full.carbon_crediting_standard?.carbon_standard_level_accreditation;
      expect(labels.crediting_program?.carbon_standard_level_accreditation).toBe(value);
      if (value) accredited += 1;
    }
    expect(accredited).toBeGreaterThan(0);
  });
});

describe("unit-level labels (CDOP-FB-029)", () => {
  it("never claims an accreditation a unit does not hold", () => {
    const big = generateDataset({ seed: "2026", counts: { vcs: 120 } });
    const bigCtx = contextFromDataset(big, "https://cdop.example");
    let corsiaOnly = 0;
    for (const p of big.projects) {
      for (const block of p.blocks.filter((b) => b.labels.length > 0)) {
        const doc = buildPodDocument(p, bigCtx, "labels-certifications", {
          unitId: block.id,
          strict: true,
        }).document as { unit?: { unit_level?: Array<Record<string, string>> } };
        const entries = doc.unit?.unit_level ?? [];
        expect(entries).toHaveLength(block.labels.length);
        const accredited = entries.filter((e) => e.unit_level_accreditation).length;
        expect(accredited).toBe(block.labels.filter((l) => l === "ccp").length);
        for (const e of entries.filter((x) => x.unit_level_compliance_eligibility))
          expect(e.unit_level_compliance_eligibility).toMatch(/^CORSIA .* scope /);
        if (!block.labels.includes("ccp")) corsiaOnly += 1;
      }
    }
    expect(corsiaOnly).toBeGreaterThan(0);
  });
});
