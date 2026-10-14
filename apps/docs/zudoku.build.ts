import type { ZudokuBuildConfig } from "zudoku";

/**
 * The build writes a placeholder origin wherever the pages need this API's absolute URL: the
 * playground's server, the MCP endpoint, and links from the API description to pages outside
 * /docs (a root-relative link would be routed inside the docs and get /docs in front). The API
 * replaces the placeholder with its PUBLIC_BASE_URL when it serves the pages, so one build works on
 * the hosted demo, in `docker compose` and in tests. `DOCS_API_ORIGIN` overrides it for `zudoku dev`.
 */
export const API_ORIGIN = process.env.DOCS_API_ORIGIN ?? "https://api-origin.cdop.invalid";

type Doc = {
  info?: { description?: string };
  paths?: Record<string, unknown>;
  tags?: Array<{ name: string; description?: string }>;
};

const buildConfig: ZudokuBuildConfig = {
  processors: [
    ({ schema }) => {
      const doc = schema as Doc;
      return {
        ...schema,
        servers: [{ url: API_ORIGIN }],
        info: {
          ...doc.info,
          description: doc.info?.description?.replace(/\]\(\/(?!\/)/g, `](${API_ORIGIN}/`),
        },
        tags: [
          ...(doc.tags ?? []),
          { name: "MCP", description: "Model Context Protocol endpoint (Streamable HTTP)" },
        ],
        // The MCP endpoint is not a REST route, so the API's OpenAPI document leaves it out. Here
        // `x-mcp-server` makes Zudoku show its URL and how to add it to Claude, ChatGPT, Cursor or
        // VS Code, as Scalar's "Connect MCP" did.
        paths: {
          ...doc.paths,
          "/mcp": {
            post: {
              tags: ["MCP"],
              summary: "MCP server",
              operationId: "mcp",
              description:
                "Read tools, prompts and resources over the same data as the REST API: projects, units, issuances, accounts, CDOP documents, schemas and the schema feedback register. See the [MCP server guide](/guides/mcp).",
              "x-mcp-server": { name: "cdop-reference-api" },
              responses: { "200": { description: "MCP response" } },
            },
          },
        },
      } as unknown as typeof schema;
    },
  ],
};

export default buildConfig;
