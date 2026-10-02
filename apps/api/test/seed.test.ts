import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { machineFor } from "../src/domain/lifecycle/index.js";
import {
  apportion,
  DEFAULT_COUNTS,
  FULL_COUNTS,
  generateDataset,
  SEED_NOW,
  type Counts,
} from "../src/seed/generate.js";
import { checkInvariants } from "../src/seed/invariants.js";

/** Small enough to be quick, wide enough to reach every standard and most lifecycle targets. */
const WIDE: Counts = { wcc: 40, pc: 30, vcs: 30, gs4gg: 8, acr: 8, "plan-vivo": 6, puro: 4 };

const digest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

describe("synthetic dataset", () => {
  it("is a pure function of the seed", () => {
    expect(digest(generateDataset({ seed: "2026" }))).toBe(
      digest(generateDataset({ seed: "2026" })),
    );
    expect(digest(generateDataset({ seed: "2026" }))).not.toBe(
      digest(generateDataset({ seed: "2027" })),
    );
  });

  it("does not depend on the wall clock", () => {
    expect(generateDataset({ seed: "2026" }).generatedAt).toEqual(SEED_NOW);
  });

  it("changes one project's numbers without disturbing another's when the mix grows", () => {
    // Randomness is addressed by tag, so wcc:3 is the same project in a mix of 20 or 200.
    const small = generateDataset({ seed: "2026", counts: { wcc: 8 } }).projects;
    const large = generateDataset({ seed: "2026", counts: { wcc: 8, vcs: 5 } }).projects;
    for (const p of small) expect(large.find((q) => q.id === p.id)?.area_ha).toBe(p.area_ha);
  });

  it.each([
    ["the default mix", "2026", DEFAULT_COUNTS],
    [
      "the CI mix",
      "2026",
      { wcc: 8, pc: 6, vcs: 6, gs4gg: 2, acr: 2, "plan-vivo": 2, puro: 2 } satisfies Counts,
    ],
    ["a wide mix", "2026", WIDE],
    ["a wide mix on another seed", "7", WIDE],
    ["a wide mix on a third seed", "31337", WIDE],
  ])("holds every invariant for %s", (_name, seed, counts) => {
    expect(checkInvariants(generateDataset({ seed, counts }))).toEqual([]);
  });

  it("holds every invariant at full scale (500 projects, 7 standards)", () => {
    const ds = generateDataset({ seed: "2026", counts: FULL_COUNTS });
    expect(ds.projects).toHaveLength(500);
    expect(checkInvariants(ds)).toEqual([]);
  });

  it("reaches a spread of lifecycle states, including the exits", () => {
    const ds = generateDataset({ seed: "2026", counts: WIDE });
    const lifecycle = new Set(ds.projects.map((p) => p.lifecycle_state));
    for (const state of ["draft", "registered", "validated", "verified", "withdrawn", "rejected"])
      expect(lifecycle).toContain(state);
    const wcc = new Set(
      ds.projects.filter((p) => p.standard_id === "wcc").map((p) => p.native_state_code),
    );
    expect(wcc).toContain("NOT_DELIVERED");
    // Every current state is one the standard's machine defines.
    for (const p of ds.projects)
      expect(machineFor(p.standard_id).states.map((s) => s.code)).toContain(p.native_state_code);
  });

  it("issues ex-ante units at validation and converts them at verification for the UK codes", () => {
    const ds = generateDataset({ seed: "2026", counts: WIDE });
    const verified = ds.projects.filter(
      (p) => p.standard_id === "wcc" && p.lifecycle_state === "verified",
    );
    expect(verified.length).toBeGreaterThan(0);
    for (const p of verified) {
      expect(p.issuances.some((i) => i.kind === "ex_ante" && i.unit_type === "PIU")).toBe(true);
      expect(p.issuances.some((i) => i.kind === "conversion" && i.unit_type === "WCU")).toBe(true);
      expect(
        p.blocks.some(
          (b) =>
            b.unit_type === "PIU" && b.state === "cancelled" && b.state_reason === "conversion",
        ),
      ).toBe(true);
    }
    // Nothing is issued before validation.
    for (const p of ds.projects.filter((q) => q.standard_id === "wcc" && !q.validated_on))
      expect(p.issuances).toHaveLength(0);
  });

  it("nests WCC group members under a master that precedes them", () => {
    const ds = generateDataset({ seed: "2026", counts: DEFAULT_COUNTS });
    const children = ds.projects.filter((p) => p.master_project_id);
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      const master = ds.projects.find((p) => p.id === child.master_project_id);
      expect(master?.program_type).toBe("Scaled up program");
      expect(child.program_type).toBe("Nested project");
      expect(child.developer_organisation_id).toBe(master?.developer_organisation_id);
    }
  });
});

describe("apportion", () => {
  it("hands out exactly n items in proportion, rare cases included", () => {
    const out = apportion(20, [
      ["common", 90],
      ["rare", 10],
    ] as const);
    expect(out).toHaveLength(20);
    expect(out.filter((x) => x === "rare")).toHaveLength(2);
    expect(apportion(0, [["a", 1]] as const)).toEqual([]);
    expect(
      apportion(3, [
        ["a", 1],
        ["b", 1],
        ["c", 1],
        ["d", 1],
      ] as const),
    ).toHaveLength(3);
  });
});
