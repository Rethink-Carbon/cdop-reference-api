import type { OpenAPIHono } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import { mount } from "../http/mount.js";
import { isPodName, POD_NAMES, SCHEMA_FILES } from "@cdop/schemas";
import type { AppEnv } from "../app-env.js";
import type { AppDeps } from "../http/context.js";
import {
  HalResource,
  IdParam,
  PageQuery,
  halResponse,
  problemResponses,
  z,
} from "../http/schemas.js";
import { halJson, json, csv } from "../http/respond.js";
import { parsePage } from "../http/pagination.js";
import { pageLinks } from "../http/hal.js";
import { notModified, strongEtag, weakEtag } from "../http/etag.js";
import { ProblemError, notFound } from "../http/problems.js";
import { listProjects, getProjectAggregate, PROJECT_SORTS } from "../services/projects.js";
import { renderProject, renderProjectIndex, renderStatusHistory } from "../http/render/project.js";
import * as facets from "../http/render/facets.js";
import { renderUnitIndex } from "../http/render/unit.js";
import { contextForAggregates } from "../http/aggregate-context.js";
import { buildPodDocument, validateDocument } from "../domain/projection/cdop.js";
import { projectTemplates } from "../http/templates.js";
import { hal } from "../http/hal.js";
import { conformanceHeader } from "../http/conformance.js";
import { DOCUMENT_TYPES } from "../seed/vocab.js";
import { placeholderPdf } from "../http/placeholder-pdf.js";

const ProjectQuery = PageQuery.extend({
  status: z.string().optional().openapi({
    description: "CDOP project_status values, comma-separated",
    example: "Registered,Validated",
  }),
  lifecycle_stage: z.string().optional().openapi({
    description: "Canonical lifecycle states, comma-separated",
    example: "validated,verified",
  }),
  country_code: z.string().optional().openapi({ example: "GBR" }),
  registry: z.string().optional().openapi({ example: "ukl" }),
  standard: z.string().optional().openapi({ example: "wcc" }),
  crediting_program: z.string().optional(),
  project_type: z.string().optional().openapi({ example: "Afforestation" }),
  mitigation_type: z.string().optional().openapi({ example: "Removal - nature" }),
  methodology: z.string().optional(),
  program_type: z.string().optional(),
  project_identifier: z.string().optional().openapi({ example: "cdop:ukl:104000000027017" }),
  current_registry_project_id: z.string().optional(),
  master_project_id: z.string().optional(),
  developer_account_id: z
    .string()
    .optional()
    .openapi({ description: "Registry account of the project developer", example: "acc_…" }),
  q: z
    .string()
    .optional()
    .openapi({ description: "Free text over name/description, or an exact registry id" }),
  modified_since: z
    .string()
    .optional()
    .openapi({ description: "RFC 3339 timestamp, inclusive", example: "2026-09-01T00:00:00Z" }),
  bbox: z
    .string()
    .optional()
    .openapi({ description: "west,south,east,north in EPSG:4326", example: "-8,49,2,61" }),
  embed: z
    .string()
    .optional()
    .openapi({ description: "Comma-separated embeds: crediting-program,registry,summary" }),
});

const typeNames = new Map(
  DOCUMENT_TYPES.map((t) => [t.id, { name: t.name, kind: t.kind, cdop_type: t.cdop_type ?? null }]),
);

export function registerProjectRoutes(app: OpenAPIHono<AppEnv>, deps: AppDeps): void {
  const { linker } = deps;

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/projects",
      tags: ["Projects"],
      summary: "List projects",
      description:
        "Filterable, cursor-paginated index of projects. Filters use CDOP field names; enum values come from the vendored schema (see /v2/reference).",
      request: { query: ProjectQuery },
      responses: {
        200: halResponse(
          HalResource("ProjectPage", "HAL collection of project index rows"),
          "Project page",
        ),
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const q = input.query;
      const page = parsePage(q, { sorts: [...PROJECT_SORTS], defaultSort: "-modified_at" });
      const bboxParts = q.bbox ? q.bbox.split(",").map(Number) : undefined;
      if (bboxParts && (bboxParts.length !== 4 || bboxParts.some((n) => Number.isNaN(n))))
        throw new ProblemError("validation-failed", "bbox must be west,south,east,north");
      const modifiedSince = q.modified_since ? new Date(q.modified_since) : undefined;
      if (modifiedSince && Number.isNaN(modifiedSince.getTime()))
        throw new ProblemError("validation-failed", "modified_since must be an RFC 3339 timestamp");
      const result = await listProjects(
        deps.db,
        {
          status: csv(q.status),
          lifecycle: csv(q.lifecycle_stage),
          country_code: csv(q.country_code),
          registry: csv(q.registry),
          standard: csv(q.standard),
          crediting_program: csv(q.crediting_program),
          project_type: csv(q.project_type),
          mitigation_type: csv(q.mitigation_type),
          methodology: csv(q.methodology),
          program_type: csv(q.program_type),
          ...(q.project_identifier ? { project_identifier: q.project_identifier } : {}),
          ...(q.current_registry_project_id
            ? { current_registry_project_id: q.current_registry_project_id }
            : {}),
          ...(q.master_project_id ? { master_project_id: q.master_project_id } : {}),
          ...(q.developer_account_id ? { developer_account_id: q.developer_account_id } : {}),
          ...(q.q ? { q: q.q } : {}),
          ...(modifiedSince ? { modified_since: modifiedSince } : {}),
          ...(bboxParts ? { bbox: bboxParts as [number, number, number, number] } : {}),
        },
        page,
      );
      const items = result.items.map((row) => renderProjectIndex(row, linker));
      const links = pageLinks(linker, {
        selfUrl: c.req.url,
        nextCursor: result.nextCursor,
        searchTemplate:
          linker.url("/v2/projects") +
          "{?status,lifecycle_stage,country_code,registry,standard,crediting_program,project_type,mitigation_type,methodology,program_type,project_identifier,current_registry_project_id,master_project_id,developer_account_id,q,modified_since,bbox,sort,limit,cursor}",
        describedBy: linker.url(`/v2/schemas/${SCHEMA_FILES["project-approach-details"]}`),
      });
      links.up = linker.link("/v2");
      const etag = weakEtag([
        result.items[0]?.modified_at instanceof Date
          ? result.items[0].modified_at.toISOString()
          : "",
        result.total,
      ]);
      const nm = notModified(c, etag);
      if (nm) return nm;
      return halJson(
        c,
        hal({ total: result.total, limit: page.limit, count: items.length }, links, {
          embedded: { projects: items },
        }),
        200,
        { etag },
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/projects/{id}",
      tags: ["Projects"],
      summary: "Get a project",
      request: {
        params: IdParam("prj_01J8Z3K3M2Q9V7X4N6B8C0D1E2"),
        query: z.object({ embed: z.string().optional() }),
      },
      responses: {
        200: halResponse(
          HalResource(
            "Project",
            "Project resource with links, embedded summary and HAL-FORMS templates",
          ),
          "Project",
        ),
        304: { description: "Not modified" },
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const { id } = input.params;
      const agg = await getProjectAggregate(deps.db, id);
      const etag = strongEtag(await currentVersion(deps, id));
      const nm = notModified(c, etag);
      if (nm) return nm;
      const ctx = await contextForAggregates(deps, [agg]);
      const registry = ctx.registry(agg.registry_id);
      const mv = ctx.methodologyVersion(agg.methodology_version_id);
      const caller = c.get("caller");
      const showAll = deps.env.AFFORDANCES_FOR_ANONYMOUS === "all";
      const embeds = new Set(csv(input.query.embed) ?? ["summary"]);
      const embedded: Record<string, unknown> = {};
      if (embeds.has("summary")) {
        const active = agg.blocks.filter((b) => b.state === "active" || b.state === "pending");
        embedded.summary = {
          issuance_count: agg.issuances.length,
          units_issued: agg.issuances.reduce((s, i) => s + i.volume, 0),
          units_active: active.reduce((s, b) => s + (b.block_end - b.block_start + 1), 0),
          units_retired: agg.blocks
            .filter((b) => b.state === "retired")
            .reduce((s, b) => s + (b.block_end - b.block_start + 1), 0),
          units_buffer: agg.blocks
            .filter((b) => b.state === "buffer")
            .reduce((s, b) => s + (b.block_end - b.block_start + 1), 0),
          verifications_completed: agg.verifications.filter((v) => v.status === "completed").length,
          next_milestone: agg.milestones
            .filter((m) => !m.completed_at)
            .sort((a, b) => a.due_on.getTime() - b.due_on.getTime())[0]?.name,
        };
      }
      if (embeds.has("crediting-program"))
        embedded["crediting-program"] = facets.renderCreditingProgram(agg, ctx, linker);
      if (embeds.has("registry")) embedded.registry = facets.renderRegistry(agg, ctx, linker);
      const body = renderProject(agg, {
        linker,
        developerName: ctx.org(agg.developer_organisation_id)?.legal_name,
        vvbName: ctx.org(agg.vvb_organisation_id)?.legal_name,
        registryName: registry?.cdop_name,
        registryUrl: registry?.project_url_template
          ?.replace("{native_project_id}", agg.native_project_id)
          .replace("{standard}", agg.standard_id),
        programName: ctx.program(agg.crediting_program_id)?.cdop_name,
        standardName: ctx.standard(agg.standard_id)?.cdop_name,
        standardVersion: ctx.standardVersion(agg.standard_version_id),
        methodology: mv ? { name: mv.cdop_name, version: mv.version } : undefined,
        templates: projectTemplates(
          linker,
          agg.id,
          agg.standard_id,
          agg.native_state_code,
          caller.role,
          showAll && caller.role === "public",
        ),
        embedded,
      });
      return halJson(c, body, 200, { etag });
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/projects/{id}/status-history",
      tags: ["Projects"],
      summary: "Status records (newest first)",
      request: { params: IdParam("prj_…") },
      responses: {
        200: halResponse(
          HalResource("StatusHistory", "Versioned status records"),
          "Status history",
        ),
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const agg = await getProjectAggregate(deps.db, input.params.id);
      return halJson(c, renderStatusHistory(agg, linker));
    },
  );

  const facetRoutes: Array<
    [
      string,
      string,
      (
        agg: Parameters<typeof facets.renderStakeholders>[0],
        ctx: Parameters<typeof facets.renderStakeholders>[1],
      ) => unknown,
    ]
  > = [
    [
      "stakeholders",
      "Stakeholders (developer, organisations, landowners)",
      (agg, ctx) => facets.renderStakeholders(agg, ctx, linker),
    ],
    ["facilities", "Facilities", (agg) => facets.renderFacilities(agg, linker)],
    [
      "crediting-program",
      "Crediting program, standard and crediting periods",
      (agg, ctx) => facets.renderCreditingProgram(agg, ctx, linker),
    ],
    [
      "methodologies",
      "Methodology versions",
      (agg, ctx) => facets.renderMethodologies(agg, ctx, linker),
    ],
    ["registry", "Registry record", (agg, ctx) => facets.renderRegistry(agg, ctx, linker)],
    ["validations", "Validation events", (agg, ctx) => facets.renderValidations(agg, ctx, linker)],
    [
      "verifications",
      "Verification events (provisional pod shape)",
      (agg, ctx) => facets.renderVerifications(agg, ctx, linker),
    ],
    [
      "estimations",
      "Estimations with per-vintage rows",
      (agg) => facets.renderEstimations(agg, linker),
    ],
    ["issuances", "Issuance batches", (agg) => facets.renderIssuancesFacet(agg, linker)],
    ["cobenefits", "Co-benefits and SDGs", (agg) => facets.renderCobenefits(agg, linker)],
    ["agreements", "Financial agreements", (agg, ctx) => facets.renderAgreements(agg, ctx, linker)],
    ["labels", "Labels and certifications", (agg, ctx) => facets.renderLabels(agg, ctx, linker)],
    [
      "buffer-pool",
      "Buffer pool ledger and balance",
      (agg) => facets.renderBufferPool(agg, linker),
    ],
    ["finance", "Project finance summary", (agg, ctx) => facets.renderFinance(agg, ctx, linker)],
    ["documents", "Documents", (agg, ctx) => facets.renderDocuments(agg, ctx, linker, typeNames)],
    [
      "geolocation-files",
      "GIS files",
      (agg, ctx) => facets.renderGeolocationFiles(agg, ctx, linker),
    ],
    ["milestones", "Registry milestones", (agg) => facets.renderMilestones(agg, linker)],
  ];
  for (const [name, summary, render] of facetRoutes) {
    mount(
      app,
      createRoute({
        method: "get",
        path: `/v2/projects/{id}/${name}`,
        tags: ["Project facets"],
        summary,
        request: { params: IdParam("prj_…") },
        responses: {
          200: halResponse(HalResource(`Project_${name.replace(/-/g, "_")}`, summary), summary),
          ...problemResponses,
        },
      }),
      async (c, input) => {
        const agg = await getProjectAggregate(deps.db, input.params.id);
        const ctx = await contextForAggregates(deps, [agg]);
        return halJson(c, render(agg, ctx));
      },
    );
  }

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/projects/{id}/units",
      tags: ["Project facets"],
      summary: "Unit blocks of a project",
      request: {
        params: IdParam("prj_…"),
        query: z.object({ lifecycle_state: z.string().optional(), status: z.string().optional() }),
      },
      responses: {
        200: halResponse(HalResource("ProjectUnits", "Unit blocks"), "Units"),
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const agg = await getProjectAggregate(deps.db, input.params.id);
      const q = input.query;
      const states = csv(q.lifecycle_state);
      const statuses = csv(q.status);
      const blocks = agg.blocks.filter(
        (b) =>
          (!states || states.includes(b.state)) && (!statuses || statuses.includes(b.cdop_status)),
      );
      const items = blocks.map((b) => renderUnitIndex(b, agg.id, linker));
      return halJson(
        c,
        hal(
          { total: items.length, project_id: agg.id },
          {
            self: { href: linker.rebase(c.req.url) },
            curies: linker.curies(),
            up: linker.link(`/v2/projects/${agg.id}`),
            collection: linker.link("/v2/units", undefined, { project_id: agg.id }),
          },
          { embedded: { units: items } },
        ),
      );
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/projects/{id}/cdop/{pod}",
      tags: ["CDOP documents"],
      summary: "CDOP document for a project",
      description:
        "A schema-pure document validating against the named CDOP pod. `unit`/`vintage` sections use the block given by `unit_id` (default: most recent). `strict=1` fills required-but-unpublished fields with flagged placeholders. Conformance is reported in the X-CDOP-Conformance header.",
      request: {
        params: z.object({
          id: z.string().openapi({ param: { name: "id", in: "path" } }),
          pod: z
            .enum(POD_NAMES as [string, ...string[]])
            .openapi({ param: { name: "pod", in: "path" } }),
        }),
        query: z.object({ unit_id: z.string().optional(), strict: z.string().optional() }),
      },
      responses: {
        200: {
          description: "CDOP document",
          content: {
            "application/json": {
              schema: z.record(z.string(), z.unknown()).openapi("CdopDocument"),
            },
          },
        },
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const { id, pod } = input.params;
      if (!isPodName(pod))
        throw new ProblemError("unknown-pod", `Unknown pod ${pod}; one of ${POD_NAMES.join(", ")}`);
      const agg = await getProjectAggregate(deps.db, id);
      const ctx = await contextForAggregates(deps, [agg]);
      const q = input.query;
      const result = buildPodDocument(agg, ctx, pod, {
        unitId: q.unit_id,
        strict: q.strict === "1" || q.strict === "true",
      });
      const validation = validateDocument(pod, result.document);
      const etag = strongEtag(
        `${await currentVersion(deps, id)}-${pod}-${q.unit_id ?? ""}-${q.strict ?? ""}`,
      );
      const nm = notModified(c, etag);
      if (nm) return nm;
      return json(c, result.document, 200, {
        etag,
        link: `<${linker.url(`/v2/schemas/${SCHEMA_FILES[pod]}`)}>; rel="describedby"; type="application/schema+json", <${linker.url(`/v2/projects/${id}`)}>; rel="up"`,
        "x-cdop-schema-version": deps.schemaVersion,
        "x-cdop-conformance": conformanceHeader(validation, result),
      });
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/projects/{id}/documents/{docId}",
      tags: ["Project facets"],
      summary: "Document metadata",
      request: { params: z.object({ id: z.string(), docId: z.string() }) },
      responses: {
        200: halResponse(HalResource("Document", "Document metadata"), "Document"),
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const { id, docId } = input.params;
      const agg = await getProjectAggregate(deps.db, id);
      const ctx = await contextForAggregates(deps, [agg]);
      const page = facets.renderDocuments(agg, ctx, linker, typeNames);
      const doc = (page._embedded?.documents as Array<{ id: string }>).find((d) => d.id === docId);
      if (!doc) throw notFound("Document", docId);
      return halJson(c, doc);
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/projects/{id}/documents/{docId}/content",
      tags: ["Project facets"],
      summary: "Document content (synthetic placeholder PDF)",
      request: { params: z.object({ id: z.string(), docId: z.string() }) },
      responses: {
        200: {
          description: "PDF",
          content: { "application/pdf": { schema: z.string().openapi({ format: "binary" }) } },
        },
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const { id, docId } = input.params;
      const agg = await getProjectAggregate(deps.db, id);
      const doc = agg.documents.find((d) => d.id === docId);
      if (!doc) throw notFound("Document", docId);
      const pdf = placeholderPdf([
        doc.title,
        `Project: ${agg.name} (${agg.project_identifier})`,
        `Document type: ${typeNames.get(doc.document_type_id)?.name ?? doc.document_type_id}`,
        `Uploaded: ${doc.uploaded_at.toISOString()}`,
        "Synthetic document generated by the CDOP reference API.",
      ]);
      return c.body(pdf, 200, {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${doc.file_name.replace(/"/g, "")}"`,
        "cache-control": "public, max-age=3600",
      });
    },
  );

  mount(
    app,
    createRoute({
      method: "get",
      path: "/v2/projects/{id}/geolocation-files/{fileId}/content",
      tags: ["Project facets"],
      summary: "GIS file content (GeoJSON, EPSG:4326)",
      request: { params: z.object({ id: z.string(), fileId: z.string() }) },
      responses: {
        200: {
          description: "GeoJSON Feature",
          content: { "application/geo+json": { schema: z.record(z.string(), z.unknown()) } },
        },
        ...problemResponses,
      },
    }),
    async (c, input) => {
      const { id, fileId } = input.params;
      const agg = await getProjectAggregate(deps.db, id);
      const file = agg.geolocationFiles.find((g) => g.id === fileId);
      if (!file) throw notFound("Geolocation file", fileId);
      const feature = {
        ...file.geojson,
        id: file.id,
        bbox: file.bbox,
        properties: {
          ...file.geojson.properties,
          project_id: agg.id,
          project_identifier: agg.project_identifier,
          area_type: file.area_type,
          file_status: file.file_status,
          area_ha: file.area_ha,
        },
      };
      return c.body(JSON.stringify(feature), 200, {
        "content-type": "application/geo+json; charset=utf-8",
        "cache-control": "public, max-age=300",
      });
    },
  );
}

async function currentVersion(deps: AppDeps, id: string): Promise<number> {
  const row = await deps.db
    .selectFrom("project")
    .select("version")
    .where("id", "=", id)
    .executeTakeFirst();
  return row?.version ?? 0;
}
