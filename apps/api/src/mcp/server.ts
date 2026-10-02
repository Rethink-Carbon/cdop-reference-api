/**
 * MCP server (Streamable HTTP, stateless). Tools are thin clients over the same Hono app: every
 * result is the HAL/JSON body the REST API would return, so `_links` travel with the data and an
 * agent can navigate exactly like an HTTP client.
 */
import {
  McpServer,
  ResourceTemplate,
  createMcpHandler,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  POD_NAMES,
  SCHEMA_FILES,
  buildFieldRegistry,
  enumValues,
  listEnums,
  loadSchemaText,
  validatePayload,
  isPodName,
} from "@cdop/schemas";
import type { AppDeps } from "../http/context.js";
import { MACHINES } from "../domain/lifecycle/index.js";
import { UNIT_TRANSITIONS } from "../domain/lifecycle/units.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoots = [path.resolve(here, "../../../.."), path.resolve(here, "../.."), process.cwd()];

async function readRepoFile(rel: string): Promise<string | undefined> {
  for (const root of repoRoots) {
    try {
      return await readFile(path.join(root, rel), "utf8");
    } catch {
      /* next */
    }
  }
  return undefined;
}

type Fetcher = (request: Request) => Promise<Response>;

const MAX_ITEMS = 50;

function text(value: unknown): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
} {
  const structured =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { value };
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: structured,
  };
}

function errorResult(message: string, extra?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message, ...extra }) }],
    isError: true,
  };
}

/** In-process call to the REST API; forwards the MCP caller's Authorization header. */
async function api(
  fetcher: Fetcher,
  deps: AppDeps,
  pathname: string,
  query: Record<string, string | number | boolean | undefined>,
  authorization: string | undefined,
  init?: { method?: string; body?: unknown },
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const url = deps.linker.url(pathname, query);
  const headers: Record<string, string> = { accept: "application/hal+json, application/json" };
  if (authorization) headers.authorization = authorization;
  if (init?.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetcher(
    new Request(url, {
      method: init?.method ?? "GET",
      headers,
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      redirect: "manual",
    }),
  );
  const ctype = res.headers.get("content-type") ?? "";
  const body: unknown = ctype.includes("json") ? await res.json() : await res.text();
  return { status: res.status, body, headers: res.headers };
}

function trim(page: unknown, key: string, limit: number): unknown {
  if (!page || typeof page !== "object") return page;
  const p = page as { _embedded?: Record<string, unknown[]>; total?: number };
  const items = p._embedded?.[key];
  if (Array.isArray(items) && items.length > limit) {
    return {
      ...p,
      _embedded: { ...p._embedded, [key]: items.slice(0, limit) },
      data_truncated: true,
      total_items_in_page: items.length,
      hint: `Showing ${limit} of ${items.length}; pass a smaller limit or follow _links.next.`,
    };
  }
  return page;
}

export function buildMcpServer(
  deps: AppDeps,
  fetcher: Fetcher,
  authorization: string | undefined,
): McpServer {
  const server = new McpServer({ name: "cdop-reference-api", version: deps.apiVersion });
  const call = (
    pathname: string,
    query: Record<string, string | number | boolean | undefined> = {},
    init?: { method?: string; body?: unknown },
  ) => api(fetcher, deps, pathname, query, authorization, init);

  server.registerTool(
    "search_projects",
    {
      title: "Search projects",
      description:
        "Filterable index of carbon projects (HAL page). Filters use CDOP field names; enum values are listed by list_enum. Returns compact rows with _links; call get_project for detail.",
      inputSchema: z.object({
        q: z
          .string()
          .optional()
          .describe("Free text over name/description, or an exact registry id"),
        status: z.string().optional().describe("Comma-separated CDOP project_status values"),
        lifecycle_stage: z
          .string()
          .optional()
          .describe(
            "Comma-separated canonical states: draft, listed, registered, validated, verified, retired, withdrawn, rejected",
          ),
        country_code: z.string().optional().describe("ISO 3166-1 alpha-3, comma-separated"),
        registry: z.string().optional().describe("Registry slug, e.g. ukl, verra"),
        standard: z
          .string()
          .optional()
          .describe("Standard id: wcc, pc, vcs, gs4gg, acr, plan-vivo, puro"),
        project_type: z.string().optional(),
        modified_since: z.string().optional().describe("RFC 3339 timestamp"),
        sort: z
          .string()
          .optional()
          .describe("modified_at | name | project_registration_date; prefix - for descending"),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional().describe("Opaque cursor from a previous page"),
      }),
    },
    async (input) => {
      const { status, body } = await call("/v2/projects", { ...input, limit: input.limit ?? 20 });
      if (status !== 200) return errorResult(`HTTP ${status}`, { body });
      return text(trim(body, "projects", MAX_ITEMS));
    },
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description:
        "Full HAL project resource (links, embedded summary, HAL-FORMS templates for legal actions). Accepts an API id (prj_…), a CDOP URN (cdop:<registry>:<id>) or a registry project id.",
      inputSchema: z.object({
        id: z.string().describe("prj_… id, CDOP URN, or registry id"),
        embed: z
          .string()
          .optional()
          .describe("Comma-separated: summary, crediting-program, registry"),
      }),
    },
    async ({ id, embed }) => {
      let projectId = id;
      if (!id.startsWith("prj_")) {
        const resolved = await call(`/v2/identifiers/${encodeURIComponent(id)}`);
        const location = resolved.headers.get("location");
        if (resolved.status !== 303 || !location)
          return errorResult(`Could not resolve identifier ${id}`, { body: resolved.body });
        projectId = location.split("/").pop() ?? id;
      }
      const { status, body } = await call(`/v2/projects/${projectId}`, { embed });
      if (status !== 200) return errorResult(`HTTP ${status}`, { body });
      return text(body);
    },
  );

  server.registerTool(
    "get_cdop_document",
    {
      title: "Get CDOP document",
      description:
        "Schema-pure CDOP document for a project (or a unit block) plus the Ajv conformance result. Pods: " +
        POD_NAMES.join(", ") +
        ".",
      inputSchema: z.object({
        project_id: z.string().optional(),
        unit_id: z.string().optional(),
        pod: z.enum(POD_NAMES as [string, ...string[]]).default("full-list"),
        strict: z
          .boolean()
          .optional()
          .describe("Fill required-but-unpublished fields with flagged placeholders"),
      }),
    },
    async ({ project_id, unit_id, pod, strict }) => {
      if (!project_id && !unit_id) return errorResult("Provide project_id or unit_id");
      const pathname = unit_id
        ? `/v2/units/${unit_id}/cdop/${pod}`
        : `/v2/projects/${project_id}/cdop/${pod}`;
      const { status, body, headers } = await call(pathname, {
        strict: strict ? "1" : undefined,
        unit_id: unit_id ? undefined : undefined,
      });
      if (status !== 200) return errorResult(`HTTP ${status}`, { body });
      const conformance = isPodName(pod) ? validatePayload(pod, body) : undefined;
      return text({
        pod,
        schema: SCHEMA_FILES[pod as keyof typeof SCHEMA_FILES],
        schema_version: deps.schemaVersion,
        conformance: conformance
          ? {
              valid: conformance.valid,
              errors: conformance.errors.slice(0, 20),
              header: headers.get("x-cdop-conformance"),
            }
          : undefined,
        document: body,
      });
    },
  );

  server.registerTool(
    "list_units",
    {
      title: "List unit blocks",
      description:
        "Unit blocks (credits) with filters. Returns compact rows; call get_unit for detail.",
      inputSchema: z.object({
        project_id: z.string().optional(),
        status: z.string().optional().describe("CDOP unit status values"),
        lifecycle_state: z
          .string()
          .optional()
          .describe("pending, active, on_hold, buffer, retired, cancelled, expired"),
        vintage: z.string().optional().describe("Vintage start year"),
        type: z.string().optional(),
        owner_account_id: z.string().optional(),
        serial_number: z.string().optional(),
        issuance_id: z.string().optional(),
        limit: z.number().int().min(1).max(250).optional(),
        cursor: z.string().optional(),
      }),
    },
    async (input) => {
      const { status, body } = await call("/v2/units", { ...input, limit: input.limit ?? 25 });
      if (status !== 200) return errorResult(`HTTP ${status}`, { body });
      return text(trim(body, "units", MAX_ITEMS));
    },
  );

  server.registerTool(
    "get_unit",
    {
      title: "Get unit block",
      description: "HAL unit block with status record, lineage links and HAL-FORMS templates.",
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      const { status, body } = await call(`/v2/units/${id}`);
      return status === 200 ? text(body) : errorResult(`HTTP ${status}`, { body });
    },
  );

  server.registerTool(
    "list_issuances",
    {
      title: "List issuance batches",
      description: "Issuance batches, optionally for one project.",
      inputSchema: z.object({
        project_id: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    },
    async (input) => {
      const { status, body } = await call("/v2/issuances", { ...input, limit: input.limit ?? 20 });
      return status === 200
        ? text(trim(body, "issuances", MAX_ITEMS))
        : errorResult(`HTTP ${status}`, { body });
    },
  );

  server.registerTool(
    "get_project_facet",
    {
      title: "Get a project facet",
      description:
        "One sub-resource of a project: status-history, stakeholders, facilities, crediting-program, methodologies, registry, validations, verifications, estimations, issuances, units, cobenefits, agreements, labels, buffer-pool, finance, documents, geolocation-files, milestones.",
      inputSchema: z.object({
        project_id: z.string(),
        facet: z.enum([
          "status-history",
          "stakeholders",
          "facilities",
          "crediting-program",
          "methodologies",
          "registry",
          "validations",
          "verifications",
          "estimations",
          "issuances",
          "units",
          "cobenefits",
          "agreements",
          "labels",
          "buffer-pool",
          "finance",
          "documents",
          "geolocation-files",
          "milestones",
        ]),
      }),
    },
    async ({ project_id, facet }) => {
      const { status, body } = await call(`/v2/projects/${project_id}/${facet}`);
      return status === 200 ? text(body) : errorResult(`HTTP ${status}`, { body });
    },
  );

  server.registerTool(
    "explain_schema",
    {
      title: "Explain a CDOP schema field",
      description:
        "Look up a field path (e.g. project.status[].project_status) or an entity (e.g. unit) in the vendored CDOP schema: type, format, enum size, cardinality, mutability, visibility, data source, description.",
      inputSchema: z.object({
        path: z.string().describe("Dotted field path or entity name"),
        limit: z.number().int().min(1).max(200).optional(),
      }),
    },
    async ({ path: p, limit }) => {
      const registry = buildFieldRegistry();
      const norm = p.replace(/\[\]/g, "");
      const hits = registry.filter(
        (f) =>
          f.path.replace(/\[\]/g, "") === norm ||
          f.entity === p ||
          f.path.replace(/\[\]/g, "").startsWith(norm + "."),
      );
      if (!hits.length)
        return errorResult(`No field or entity matches ${p}`, {
          hint: "Try an entity name such as project, unit, issuance, validation, estimations, cobenefits, agreement.",
        });
      const cap = limit ?? 60;
      return text({
        query: p,
        matches: hits.length,
        data_truncated: hits.length > cap,
        fields: hits.slice(0, cap).map((f) => ({
          ...f,
          enum: f.enum ? { count: f.enum.length, sample: f.enum.slice(0, 10) } : undefined,
        })),
        hint: hits.length > cap ? "Narrow the path or raise limit." : undefined,
      });
    },
  );

  server.registerTool(
    "list_enum",
    {
      title: "List enum values",
      description: "Values of one CDOP enum by field path (see explain_schema), paged.",
      inputSchema: z.object({
        path: z.string(),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      }),
    },
    async ({ path: p, offset, limit }) => {
      const values = enumValues(p);
      if (!values)
        return errorResult(`No enum at ${p}`, {
          available: listEnums()
            .map((e) => e.path)
            .slice(0, 80),
        });
      const start = offset ?? 0;
      const end = start + (limit ?? 100);
      return text({
        path: p,
        total: values.length,
        offset: start,
        values: values.slice(start, end),
        data_truncated: end < values.length,
      });
    },
  );

  server.registerTool(
    "validate_payload",
    {
      title: "Validate a CDOP payload",
      description:
        "Validate any JSON payload against one CDOP pod schema (Ajv, JSON Schema 2020-12).",
      inputSchema: z.object({
        pod: z.enum(POD_NAMES as [string, ...string[]]),
        payload: z.record(z.string(), z.unknown()),
      }),
    },
    async ({ pod, payload }) => {
      if (!isPodName(pod)) return errorResult(`Unknown pod ${pod}`);
      const result = validatePayload(pod, payload);
      return text({
        pod,
        schema_version: deps.schemaVersion,
        valid: result.valid,
        errors: result.errors.slice(0, 50),
        data_truncated: result.errors.length > 50,
      });
    },
  );

  server.registerTool(
    "get_state_machine",
    {
      title: "Get a state machine",
      description:
        "Transition tables: project (per standard, with the canonical lifecycle mapping) or unit.",
      inputSchema: z.object({
        entity: z.enum(["project", "unit"]),
        standard: z.string().optional(),
      }),
    },
    async ({ entity, standard }) => {
      const { status, body } = await call(`/v2/state-machines/${entity}`, { standard });
      return status === 200 ? text(body) : errorResult(`HTTP ${status}`, { body });
    },
  );

  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description: "The role this MCP connection has on the API and what it may do.",
      inputSchema: z.object({}),
    },
    async () => {
      const role = authorization
        ? "keyed (role resolved per request by the API)"
        : "public (anonymous read)";
      return text({
        authorization: role,
        api_version: deps.apiVersion,
        schema_version: deps.schemaVersion,
        base_url: deps.linker.baseUrl,
        write_tools: "M2: propose_transition and actions land with the event stream",
      });
    },
  );

  server.registerResource(
    "openapi",
    "cdop://openapi",
    {
      title: "OpenAPI 3.1 document",
      description: "The API description with the CDOP schemas embedded",
      mimeType: "application/openapi+json",
    },
    async () => {
      const { body } = await call("/v2/openapi.json");
      return {
        contents: [
          {
            uri: "cdop://openapi",
            mimeType: "application/openapi+json",
            text: JSON.stringify(body),
          },
        ],
      };
    },
  );
  server.registerResource(
    "feedback",
    "cdop://feedback",
    {
      title: "Schema feedback register",
      description: "SCHEMA-FEEDBACK.md: every implementation conflict with the CDOP schema",
      mimeType: "text/markdown",
    },
    async () => {
      const md =
        (await readRepoFile("SCHEMA-FEEDBACK.md")) ??
        "SCHEMA-FEEDBACK.md not available in this build";
      return { contents: [{ uri: "cdop://feedback", mimeType: "text/markdown", text: md }] };
    },
  );
  server.registerResource(
    "schema",
    new ResourceTemplate("cdop://schemas/{file}", {
      list: async () => ({
        resources: POD_NAMES.map((pod) => ({
          uri: `cdop://schemas/${SCHEMA_FILES[pod]}`,
          name: SCHEMA_FILES[pod],
          mimeType: "application/schema+json",
        })),
      }),
    }),
    {
      title: "Vendored CDOP JSON Schema",
      description: "One CDOP pod schema, verbatim",
      mimeType: "application/schema+json",
    },
    async (uri, variables) => {
      const file = String(variables.file ?? "");
      const pod = POD_NAMES.find((p) => SCHEMA_FILES[p] === file);
      if (!pod) throw new Error(`unknown schema ${file}`);
      return {
        contents: [
          { uri: uri.href, mimeType: "application/schema+json", text: loadSchemaText(pod) },
        ],
      };
    },
  );
  server.registerResource(
    "enum",
    new ResourceTemplate("cdop://enums/{path}", {
      list: async () => ({
        resources: listEnums().map((e) => ({
          uri: `cdop://enums/${e.path}`,
          name: e.path,
          mimeType: "application/json",
        })),
      }),
    }),
    {
      title: "CDOP enum list",
      description: "Values of one enum, by field path",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const p = decodeURIComponent(String(variables.path ?? ""));
      const values = enumValues(p);
      if (!values) throw new Error(`no enum at ${p}`);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ path: p, values }),
          },
        ],
      };
    },
  );
  server.registerResource(
    "state-machine",
    new ResourceTemplate("cdop://state-machines/{entity}", {
      list: async () => ({
        resources: [
          { uri: "cdop://state-machines/unit", name: "unit", mimeType: "application/json" },
          ...Object.keys(MACHINES).map((s) => ({
            uri: `cdop://state-machines/project-${s}`,
            name: `project (${s})`,
            mimeType: "application/json",
          })),
        ],
      }),
    }),
    {
      title: "State machine",
      description: "Transition table as data",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const entity = String(variables.entity ?? "");
      if (entity === "unit")
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ entity: "unit", transitions: UNIT_TRANSITIONS }),
            },
          ],
        };
      const standard = entity.replace(/^project-?/, "");
      const machine = MACHINES[standard];
      if (!machine) throw new Error(`unknown state machine ${entity}`);
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(machine) }],
      };
    },
  );
  server.registerResource(
    "rel",
    new ResourceTemplate("cdop://rels/{rel}", { list: undefined }),
    {
      title: "Link relation documentation",
      description: "Meaning of a cdop:* link relation",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const rel = String(variables.rel ?? "").replace(/[^a-z0-9-]/g, "");
      const md = (await readRepoFile(`docs/rels/${rel}.md`)) ?? `Unknown relation ${rel}`;
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: md }] };
    },
  );
  server.registerResource(
    "project",
    new ResourceTemplate("cdop://projects/{id}", { list: undefined }),
    {
      title: "Project (HAL)",
      description: "The HAL project resource",
      mimeType: "application/hal+json",
    },
    async (uri, variables) => {
      const { body } = await call(`/v2/projects/${String(variables.id ?? "")}`);
      return {
        contents: [{ uri: uri.href, mimeType: "application/hal+json", text: JSON.stringify(body) }],
      };
    },
  );

  server.registerPrompt(
    "explore_project",
    {
      title: "Explore a project",
      description: "Walk a project's links and summarise its lifecycle, units and evidence.",
      argsSchema: z.object({ project: z.string().describe("prj_… id, CDOP URN or registry id") }),
    },
    ({ project }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Use get_project for "${project}", then follow its cdop:status-history, cdop:validations, cdop:verifications, cdop:issuances and cdop:units links with get_project_facet. Summarise: where the project is in its lifecycle (native registry state, CDOP status, canonical stage), what has been validated and verified, how many units exist by state, and what the next milestone is. Quote identifiers exactly.`,
          },
        },
      ],
    }),
  );
  server.registerPrompt(
    "schema_gap_report",
    {
      title: "Schema gap report",
      description: "Compare a registry payload with a CDOP pod and list unmapped fields.",
      argsSchema: z.object({
        pod: z.string().describe("CDOP pod, e.g. project-approach-details"),
        payload: z.string().describe("The registry payload as JSON text"),
      }),
    },
    ({ pod, payload }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Here is a registry payload:\n\n${payload}\n\nUse explain_schema on the CDOP pod "${pod}" to list its fields, then produce a table: CDOP field → source field (or "unmapped"), noting type/enum mismatches. Finish with the fields the registry publishes that CDOP has no home for. Validate your mapped document with validate_payload.`,
          },
        },
      ],
    }),
  );

  return server;
}

export function createMcpHttpHandler(
  deps: AppDeps,
  fetcher: Fetcher,
): (request: Request) => Promise<Response> {
  const handlers = new Map<string, McpHttpHandler>();
  return async (request: Request) => {
    const authorization = request.headers.get("authorization") ?? undefined;
    const key = authorization ?? "";
    let handler = handlers.get(key);
    if (!handler) {
      handler = createMcpHandler(() => buildMcpServer(deps, fetcher, authorization), {
        onerror: (err) => deps.log.warn({ err }, "mcp error"),
      });
      handlers.set(key, handler);
    }
    return handler.fetch(request);
  };
}
