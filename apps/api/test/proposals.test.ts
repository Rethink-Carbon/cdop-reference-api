import { readFileSync } from "node:fs";
import pino from "pino";
import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { afterAll, describe, expect, it } from "vitest";
import { schemaVersionLabel } from "@cdop/schemas";
import { createApp } from "../src/app.js";
import { createDb, createPool } from "../src/db/kysely.js";
import { loadEnv } from "../src/env.js";
import { createLinker } from "../src/http/context.js";
import { generateDataset } from "../src/seed/generate.js";
import {
  buildProposal,
  proposalProjectId,
  validateProposal,
  PROPOSAL_SCHEMA,
  type Proposal,
} from "../src/domain/projection/proposal.js";

type AjvCtor = typeof Ajv2020Module extends { default: infer D } ? D : typeof Ajv2020Module;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: unknown }).default ??
  Ajv2020Module) as AjvCtor;
type AddFormats = typeof addFormatsModule extends { default: infer D }
  ? D
  : typeof addFormatsModule;
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ??
  addFormatsModule) as AddFormats;

const ds = generateDataset({
  seed: "2026",
  counts: { wcc: 40, pc: 30, vcs: 30, gs4gg: 8, acr: 8, "plan-vivo": 6, puro: 4 },
});
const example = JSON.parse(
  readFileSync(new URL("../../../examples/proposals/0.1.0/vcs.json", import.meta.url), "utf8"),
) as { proposed: { document: Proposal } };
const base = example.proposed.document;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture");
  return value;
}

describe("TWG proposal: FB-010 and FB-012–015", () => {
  it("publishes a JSON Schema that independently validates the worked examples", () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(PROPOSAL_SCHEMA);
    for (const name of ["wcc", "pc", "vcs"]) {
      const fixture = JSON.parse(
        readFileSync(
          new URL(`../../../examples/proposals/0.1.0/${name}.json`, import.meta.url),
          "utf8",
        ),
      ) as { proposed: { document: Proposal } };
      expect(validate(fixture.proposed.document), JSON.stringify(validate.errors)).toBe(true);
    }
    expect(validate({ ...base, unexpected: true })).toBe(false);
  });
  it("projects every standard without unresolved references or broken histories", () => {
    for (const p of ds.projects)
      expect(validateProposal(buildProposal(p)).errors, p.id).toEqual([]);
  });

  it("preserves identity on registry transfer, without changing the source", () => {
    const p = required(ds.projects[0]);
    const original = structuredClone(p);
    const before = buildProposal(p);
    const after = buildProposal({
      ...p,
      registry_id: "another-registry",
      native_project_id: "123",
    });
    expect(after.project.project_id).toBe(before.project.project_id);
    expect(after.project.registry).not.toEqual(before.project.registry);
    expect(proposalProjectId("project-a")).not.toBe(proposalProjectId("project-b"));
    expect(p).toEqual(original);
  });

  it("preserves native status and separates hold and authorization from lifecycle", () => {
    const p = required(ds.projects[0]);
    const d = buildProposal({ ...p, is_on_hold: true });
    expect(d.project.registry_status.code).toBe(p.native_state_code);
    expect(d.project.lifecycle_stage).toBe(p.lifecycle_state);
    expect(d.project.is_on_hold).toBe(true);
    expect(d.project.authorization.status).toBe("not_reported");
  });

  it("uses recorded time separately from business time and orders by sequence", () => {
    const p = structuredClone(required(ds.projects[0]));
    required(p.statusHistory[0]).recorded_at = new Date("2026-11-13T12:00:00Z");
    p.statusHistory.reverse();
    const d = buildProposal(p);
    expect(d.project.status_history[0]?.recorded_at).toBe("2026-11-13T12:00:00.000Z");
    expect(d.project.status_history[0]?.effective_at).not.toBe(
      d.project.status_history[0]?.recorded_at,
    );
    expect(validateProposal(d).errors).toEqual([]);
  });

  it.each([
    "sequence",
    "initial",
    "chain",
    "current",
    "reference",
    "project",
    "duplicate",
    "verification",
    "completion-date",
    "unknown-property",
  ])("rejects a corrupted %s", (kind) => {
    const d = structuredClone(base);
    const rows = d.project.status_history;
    if (kind === "sequence") required(rows[0]).sequence = 9;
    if (kind === "initial") required(rows[0]).from_state = "missing-predecessor";
    if (kind === "chain") required(rows[1]).from_state = "not-the-previous-state";
    if (kind === "current") required(rows[0]).is_current = true;
    if (kind === "reference") required(d.units[0]).issuance_id = "missing";
    if (kind === "project") required(d.units[0]).project_id = proposalProjectId("another-project");
    if (kind === "duplicate") d.units.push(structuredClone(required(d.units[0])));
    if (kind === "verification") d.verifications.length = 0;
    if (kind === "completion-date")
      delete required(d.verifications.find((v) => v.status === "completed")).verified_on;
    if (kind === "unknown-property") Object.assign(d.project, { lifecyle_stage: "verified" });
    expect(validateProposal(d).valid).toBe(false);
  });

  it("does not reinterpret the ambiguous Verified issuance status", () => {
    const p = structuredClone(required(ds.projects.find((p) => p.issuances.length > 0)));
    required(p.issuances[0]).status = "Verified";
    expect(() => buildProposal(p)).toThrow("precondition");
  });
});

const env = loadEnv({
  DATABASE_URL: "postgres://unused@127.0.0.1:1/unused",
  PUBLIC_BASE_URL: "http://localhost:3000",
  LOG_LEVEL: "silent",
});
const pool = createPool(env.DATABASE_URL, 1);
const app = createApp({
  env,
  db: createDb(pool),
  log: pino({ level: "silent" }),
  linker: createLinker(env),
  schemaVersion: schemaVersionLabel(),
  apiVersion: "test",
  startedAt: new Date(),
});
afterAll(async () => {
  await pool.end();
});

describe("proposal discovery and validation HTTP endpoints", () => {
  it("serves the review examples without a database and labels them as proposals", async () => {
    for (const path of [
      "/v2/proposals",
      "/v2/proposals/0.1.0",
      "/v2/proposals/0.1.0/schema",
      "/v2/proposals/0.1.0/examples/wcc",
      "/v2/proposals/0.1.0/examples/registry-transfer",
    ]) {
      const r = await app.request(path);
      expect(r.status, path).toBe(200);
      expect(r.headers.get("x-cdop-schema-version")).toBe("rethink-proposal-0.1.0");
    }
    expect((await app.request("/v2/proposals/9.0.0/schema")).status).toBe(404);
  });
  it("validates documents and returns a problem for malformed JSON", async () => {
    const send = (body: string) =>
      app.request("/v2/proposals/0.1.0/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
    expect(await (await send(JSON.stringify(base))).json()).toEqual({ valid: true, errors: [] });
    expect(await (await send("{}")).json()).toMatchObject({ valid: false });
    expect((await send("{")).status).toBe(422);
  });
});
