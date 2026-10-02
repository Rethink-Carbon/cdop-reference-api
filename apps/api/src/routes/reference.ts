import type { OpenAPIHono } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import { mount } from "../http/mount.js";
import {
  POD_NAMES,
  POD_TITLES,
  SCHEMA_FILES,
  isPodName,
  listEnums,
  loadSchemaText,
  loadUpstream,
  buildFieldRegistry,
  validatePayload,
} from "@cdop/schemas";
import type { AppEnv } from "../app-env.js";
import type { AppDeps } from "../http/context.js";
import { HalResource, halResponse, problemResponses, z } from "../http/schemas.js";
import { halJson, json } from "../http/respond.js";
import { hal } from "../http/hal.js";
import { ProblemError, notFound } from "../http/problems.js";
import { resolveIdentifier } from "../services/projects.js";
import {
  MACHINES,
  CADT_PROJECT_STATUS_TO_LIFECYCLE,
  CDOP_PROJECT_STATUS_TO_LIFECYCLE,
  LIFECYCLE_LADDER,
} from "../domain/lifecycle/index.js";
import { UNIT_TRANSITIONS, CADT_UNIT_STATUS, cdopUnitStatus } from "../domain/lifecycle/units.js";
import {
  LABELS,
  DOCUMENT_TYPES,
  REGISTRIES,
  PROGRAMS,
  STANDARDS,
  METHODOLOGIES,
} from "../seed/vocab.js";

const STATIC_LISTS: Record<string, () => unknown[]> = {
  registries: () => REGISTRIES,
  "crediting-programs": () => PROGRAMS,
  standards: () => STANDARDS,
  methodologies: () => METHODOLOGIES,
  labels: () => LABELS,
  "document-types": () => DOCUMENT_TYPES,
};

export function registerReferenceRoutes(app: OpenAPIHono<AppEnv>, deps: AppDeps): void {
  const { linker } = deps;

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/reference",
      tags: ["Reference data"],
      summary: "Reference lists (schema enums + id authorities)",
      responses: { 200: halResponse(HalResource("ReferenceIndex", "Reference lists"), "Index") },
    }),
    (c, _input) => {
      const enums = listEnums().map((e) => ({
        list: e.path,
        entity: e.entity,
        values: e.values.length,
        source: "cdop-schema",
        href: linker.url(`/v2/reference/${encodeURIComponent(e.path)}`),
      }));
      const statics = Object.keys(STATIC_LISTS).map((k) => ({
        list: k,
        source: "id-authority",
        href: linker.url(`/v2/reference/${k}`),
      }));
      return halJson(
        c,
        hal(
          {
            total: enums.length + statics.length,
            note: "Enum lists are generated from the vendored CDOP schema; id-authority lists are this API's extensions.",
          },
          {
            self: linker.link("/v2/reference"),
            curies: linker.curies(),
            up: linker.link("/v2"),
            [linker.rel("reference")]: linker.templated("/v2/reference/{list}"),
          },
          { embedded: { lists: [...statics, ...enums] } },
        ),
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/reference/{list}",
      tags: ["Reference data"],
      summary: "One reference list",
      request: {
        params: z.object({
          list: z.string().openapi({ example: "project.status[].project_status" }),
        }),
      },
      responses: {
        200: halResponse(HalResource("ReferenceList", "Values of one list"), "List"),
        ...problemResponses,
      },
    }),
    (c, input) => {
      const list = decodeURIComponent(input.params.list);
      const staticList = STATIC_LISTS[list];
      if (staticList)
        return halJson(
          c,
          hal(
            { list, source: "id-authority", values: staticList() },
            {
              self: linker.link(`/v2/reference/${list}`),
              curies: linker.curies(),
              up: linker.link("/v2/reference"),
            },
          ),
        );
      const hit = listEnums().find(
        (e) => e.path === list || e.path.replace(/\[\]/g, "") === list.replace(/\[\]/g, ""),
      );
      if (!hit) throw notFound("Reference list", list);
      return halJson(
        c,
        hal(
          {
            list: hit.path,
            entity: hit.entity,
            source: "cdop-schema",
            field_id: hit.fieldId,
            values: hit.values,
          },
          {
            self: linker.link(`/v2/reference/${encodeURIComponent(hit.path)}`),
            curies: linker.curies(),
            up: linker.link("/v2/reference"),
            describedby: linker.link(`/v2/schemas/${SCHEMA_FILES["full-list"]}`),
          },
        ),
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/schemas",
      tags: ["Reference data"],
      summary: "Vendored CDOP JSON Schemas",
      responses: { 200: halResponse(HalResource("SchemaIndex", "Schema index"), "Index") },
    }),
    (c, _input) => {
      const up = loadUpstream();
      const items = POD_NAMES.map((pod) => ({
        pod,
        title: POD_TITLES[pod],
        file: SCHEMA_FILES[pod],
        href: linker.url(`/v2/schemas/${SCHEMA_FILES[pod]}`),
        sha256: up.files[`schemas/v2/${SCHEMA_FILES[pod]}`],
      }));
      return halJson(
        c,
        hal(
          {
            schema_version: deps.schemaVersion,
            upstream: {
              repo: up.repo,
              commit: up.commit,
              commit_date: up.commit_date,
              url: `https://github.com/${up.repo}/tree/${up.commit}/json_schema`,
            },
            fields: buildFieldRegistry().length,
          },
          { self: linker.link("/v2/schemas"), curies: linker.curies(), up: linker.link("/v2") },
          { embedded: { schemas: items } },
        ),
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/schemas/{file}",
      tags: ["Reference data"],
      summary: "One vendored schema (verbatim, $id rewritten to this host)",
      request: {
        params: z.object({ file: z.string().openapi({ example: "Full_List.schema.json" }) }),
      },
      responses: {
        200: {
          description: "JSON Schema",
          content: { "application/schema+json": { schema: z.record(z.string(), z.unknown()) } },
        },
        ...problemResponses,
      },
    }),
    (c, input) => {
      const file = input.params.file;
      const pod = POD_NAMES.find((p) => SCHEMA_FILES[p] === file);
      if (!pod) throw notFound("Schema", file);
      const text = loadSchemaText(pod).replace(
        /"\$id":\s*"[^"]*"/,
        `"$id": "${linker.url(`/v2/schemas/${file}`)}"`,
      );
      return c.body(text, 200, {
        "content-type": "application/schema+json; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "x-cdop-schema-version": deps.schemaVersion,
      });
    },
  );

  mount(
    app,
    createRoute({
      method: "post",
      path: "/v2/validate",
      tags: ["CDOP documents"],
      summary: "Validate a payload against a CDOP schema",
      request: {
        query: z.object({
          schema: z.enum(POD_NAMES as [string, ...string[]]).openapi({ example: "disclosures" }),
        }),
        body: {
          content: { "application/json": { schema: z.record(z.string(), z.unknown()) } },
          required: true,
        },
      },
      responses: {
        200: {
          description: "Validation result",
          content: {
            "application/json": {
              schema: z
                .object({
                  valid: z.boolean(),
                  schema: z.string(),
                  schema_version: z.string(),
                  errors: z.array(z.record(z.string(), z.unknown())),
                })
                .openapi("ValidationResult"),
            },
          },
        },
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const pod = input.query.schema;
      if (!isPodName(pod)) throw new ProblemError("unknown-pod", `Unknown schema ${pod}`);
      let payload: unknown;
      try {
        payload = await c.req.json();
      } catch {
        throw new ProblemError("validation-failed", "Body must be JSON");
      }
      const result = validatePayload(pod, payload);
      return json(
        c,
        {
          valid: result.valid,
          schema: SCHEMA_FILES[pod],
          schema_version: deps.schemaVersion,
          errors: result.errors,
        },
        200,
        { "x-cdop-schema-version": deps.schemaVersion },
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/state-machines",
      tags: ["Reference data"],
      summary: "State machines as data",
      responses: { 200: halResponse(HalResource("StateMachineIndex", "Index"), "Index") },
    }),
    (c, _input) =>
      halJson(
        c,
        hal(
          { entities: ["project", "unit"], standards: Object.keys(MACHINES) },
          {
            self: linker.link("/v2/state-machines"),
            curies: linker.curies(),
            up: linker.link("/v2"),
            project: linker.templated("/v2/state-machines/project{?standard}"),
            unit: linker.link("/v2/state-machines/unit"),
          },
        ),
      ),
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/state-machines/{entity}",
      tags: ["Reference data"],
      summary: "Transition table for an entity",
      request: {
        params: z.object({ entity: z.enum(["project", "unit"]) }),
        query: z.object({ standard: z.string().optional().openapi({ example: "wcc" }) }),
      },
      responses: {
        200: halResponse(HalResource("StateMachine", "Transition table"), "Machine"),
        ...problemResponses,
      },
    }),
    (c, input) => {
      const { entity } = input.params;
      if (entity === "unit") {
        return halJson(
          c,
          hal(
            {
              entity: "unit",
              states: ["pending", "active", "on_hold", "buffer", "retired", "cancelled", "expired"],
              transitions: UNIT_TRANSITIONS,
              projections: {
                cdop: Object.fromEntries(
                  (
                    [
                      "pending",
                      "active",
                      "on_hold",
                      "buffer",
                      "retired",
                      "cancelled",
                      "expired",
                    ] as const
                  ).map((s) => [s, cdopUnitStatus(s)]),
                ),
                cadt: CADT_UNIT_STATUS,
              },
            },
            {
              self: linker.link("/v2/state-machines/unit"),
              curies: linker.curies(),
              up: linker.link("/v2/state-machines"),
            },
          ),
        );
      }
      const standard = input.query.standard;
      const machines = standard ? [MACHINES[standard]] : Object.values(MACHINES);
      if (!machines[0]) throw notFound("Standard", standard);
      return halJson(
        c,
        hal(
          {
            entity: "project",
            lifecycle_ladder: LIFECYCLE_LADDER,
            exits: ["withdrawn", "rejected"],
            mappings: {
              cdop_project_status: CDOP_PROJECT_STATUS_TO_LIFECYCLE,
              cadt_project_status: CADT_PROJECT_STATUS_TO_LIFECYCLE,
            },
            machines: machines
              .map((m) =>
                m
                  ? { standard: m.standardId, states: m.states, transitions: m.transitions }
                  : undefined,
              )
              .filter(Boolean),
          },
          {
            self: linker.link("/v2/state-machines/project", undefined, { standard }),
            curies: linker.curies(),
            up: linker.link("/v2/state-machines"),
          },
        ),
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/identifiers/{urn}",
      tags: ["Reference data"],
      summary: "Resolve a CDOP URN or registry id",
      request: {
        params: z.object({ urn: z.string().openapi({ example: "cdop:ukl:104000000027017" }) }),
      },
      responses: { 303: { description: "See Other → the resource" }, ...problemResponses },
    }),
    async (c, input) => {
      const value = decodeURIComponent(input.params.urn);
      const target = await resolveIdentifier(deps.db, value);
      return c.redirect(
        linker.url(
          target.kind === "project" ? `/v2/projects/${target.id}` : `/v2/issuances/${target.id}`,
        ),
        303,
      );
    },
  );
}
