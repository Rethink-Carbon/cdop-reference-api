import { loadUpstream } from "@cdop/schemas";
import type { AppDeps } from "./context.js";

// The CDOP schema's source repository, and the exact tree the vendored schemas were taken from.
const upstream = loadUpstream();
const CDOP_REPO_URL = `https://github.com/${upstream.repo}`;
const CDOP_SCHEMA_TREE_URL = `${CDOP_REPO_URL}/tree/${upstream.commit}/${upstream.paths["schemas/v2"] ?? ""}`;

export function openApiConfig(deps: AppDeps) {
  return {
    openapi: "3.1.0",
    info: {
      title: "CDOP reference API",
      version: deps.apiVersion,
      summary: "Reference implementation of an API for the Carbon Data Open Protocol (CDOP)",
      description: [
        "HAL + HAL-FORMS hypermedia over the CDOP v2 entity model, with schema-pure CDOP documents per pod, a CloudEvents stream and an MCP server.",
        "",
        `Built and run by [Rethink Carbon](https://rethinkcarbon.co.uk). It implements the [Carbon Data Open Protocol](${CDOP_REPO_URL}), the open, multi-stakeholder schema that standardises data about carbon crediting projects and carbon credits.`,
        "",
        `Embedded CDOP schema version: **[${deps.schemaVersion}](${CDOP_SCHEMA_TREE_URL})** (vendored verbatim from the [CDOP repository](${CDOP_REPO_URL}) under \`components.schemas.cdop.v2.*\`).`,
        "",
        "Every response carries `X-API-Version` and `X-CDOP-Schema-Version`; the API major (`/v2`) is independent of the schema version.",
        "",
        "**[Open the visual explorer](/atlas/)**: every project and registry account on a map, with status histories, issuances, units, documents and charts. It is built only on the public endpoints documented here.",
      ].join("\n"),
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
      contact: { name: "Rethink Carbon", url: "https://rethinkcarbon.co.uk" },
    },
    servers: [{ url: deps.linker.baseUrl }],
    tags: [
      { name: "Root", description: "Entry point and health" },
      { name: "Projects", description: "Project resources (HAL)" },
      { name: "Project facets", description: "Sub-resources of a project" },
      { name: "CDOP documents", description: "Schema-pure CDOP documents and validation" },
      { name: "Units", description: "Unit blocks (credits)" },
      { name: "Issuances", description: "Issuance batches" },
      { name: "Accounts", description: "Registry accounts" },
      { name: "Reference data", description: "Enums, schemas, state machines, identifiers" },
    ],
    externalDocs: {
      description: "Carbon Data Open Protocol",
      url: CDOP_REPO_URL,
    },
  };
}
