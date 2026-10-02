import type { AppDeps } from "./context.js";

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
        `Embedded CDOP schema version: **${deps.schemaVersion}** (vendored verbatim under \`components.schemas.cdop.v2.*\`).`,
        "",
        "Every response carries `X-API-Version` and `X-CDOP-Schema-Version`; the API major (`/v2`) is independent of the schema version.",
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
      url: "https://github.com/Carbon-Data-Open-Protocol/Carbon-Data-Open-Protocol",
    },
  };
}
