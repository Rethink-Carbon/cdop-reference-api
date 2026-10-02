import { describe, expect, it } from "vitest";
import {
  POD_NAMES,
  buildFieldRegistry,
  enumValues,
  lintSchemas,
  loadExample,
  loadSchema,
  loadUpstream,
  validatePayload,
} from "../src/index.js";

describe("vendored CDOP schemas", () => {
  it("loads every pod", () => {
    for (const pod of POD_NAMES) expect(loadSchema(pod).$schema).toContain("2020-12");
  });

  it("pins an upstream commit with hashes for every vendored file", () => {
    const up = loadUpstream();
    expect(up.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(Object.keys(up.files).length).toBeGreaterThan(20);
  });

  it("builds a field registry with 260 upstream field ids", () => {
    const registry = buildFieldRegistry();
    const ids = new Set(registry.flatMap((f) => (f.fieldId === undefined ? [] : [f.fieldId])));
    expect(Math.max(...ids)).toBe(260);
    expect(registry.find((f) => f.path === "project.status[].project_status")?.enum?.length).toBe(
      17,
    );
  });

  it("looks up enums by path", () => {
    expect(enumValues("unit.status[].status")).toContain("Retired");
    expect(enumValues("crediting_program.standard.standard_name")).toContain(
      "Woodland Carbon Code",
    );
  });

  it("validates a minimal Location Details payload", () => {
    const payload = {
      project: {
        location: [
          {
            country_code: "GBR",
            country_name: "United Kingdom of Great Britain and Northern Ireland (the)",
            geographical_region_code: "154",
            geographical_region_name: "Northern Europe",
            country_subdivision_code: "GB-SCT",
            country_subdivision_name: "Scotland",
          },
        ],
      },
      project_stakeholder: {
        location: [
          {
            country_code: "GBR",
            country_name: "United Kingdom of Great Britain and Northern Ireland (the)",
          },
        ],
      },
      geolocation_file: {
        location: [
          {
            file_name: "boundary",
            file_format: "GeoJSON",
            validity_start_date: "2024-01-01",
            file_status: "ACTIVE",
            file_created_on: "2024-01-01T00:00:00Z",
          },
        ],
      },
    };
    const result = validatePayload("location-details", payload);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("documents CDOP-FB-004: four upstream examples do not validate against upstream schemas", () => {
    const failing = ["full-list", "unit-description", "co-benefits", "project-finance"] as const;
    for (const pod of failing) {
      expect(validatePayload(pod, loadExample(pod)).valid, pod).toBe(false);
    }
    const passing = [
      "location-details",
      "project-approach-details",
      "disclosures",
      "issuances",
      "crediting-period",
      "estimations",
      "durability-permanence",
    ] as const;
    for (const pod of passing) {
      expect(validatePayload(pod, loadExample(pod)).valid, pod).toBe(true);
    }
  });

  it("lint finds the known key defects (CDOP-FB-001/002)", () => {
    const findings = lintSchemas();
    const keyErrors = findings.filter((f) => f.rule === "key-format").map((f) => f.path);
    expect(keyErrors.some((p) => p.includes("crediting period"))).toBe(true);
    expect(
      keyErrors.some((p) => p.includes("overview_of_the_projects_approach_to_ track_and_quantify")),
    ).toBe(true);
    expect(
      findings.some((f) => f.rule === "key-mangled" && f.path.endsWith("credit_blockblock_start")),
    ).toBe(true);
  });
});
