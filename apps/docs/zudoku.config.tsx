import type { ZudokuConfig } from "zudoku";

// The documentation at /docs: the guides from docs/ and the API reference, built by Zudoku into
// static pages that the API serves (src/routes/docs.ts, ADR 0012). Everything that would leave this
// origin is off: the "powered by" badge, the "open in ChatGPT or Claude" links, Zudoku's default
// favicon and its Google Fonts option (no theme font is set, so the bundled Geist files are used).
const config: ZudokuConfig = {
  basePath: "/docs",
  site: {
    title: "CDOP reference API",
    showPoweredBy: false,
    logo: {
      src: { light: "/rethink-logo-black.svg", dark: "/rethink-logo-white.svg" },
      alt: "Rethink Carbon",
      width: 101,
      height: 20,
      href: "https://rethinkcarbon.co.uk/",
    },
  },
  metadata: {
    title: "%s | CDOP reference API",
    description:
      "Guides and the API reference for the CDOP reference API, built and run by Rethink Carbon.",
    favicon: "/favicon.png",
  },
  aiAssistants: false,
  // Pagefind: a static index built with the site and searched in the browser; no service.
  search: { type: "pagefind" },
  docs: { files: "/pages/**/*.{md,mdx}" },
  navigation: [
    {
      type: "category",
      label: "Guides",
      icon: "book-open",
      items: [
        { type: "doc", file: "index", path: "/", label: "Overview" },
        { type: "doc", file: "guides/hateoas-tour", label: "HATEOAS tour" },
        { type: "doc", file: "guides/api-profile", label: "CDOP API profile" },
        { type: "doc", file: "guides/projection", label: "Projection map" },
        { type: "doc", file: "guides/mcp", label: "MCP server" },
        { type: "doc", file: "guides/schema-feedback", label: "Schema feedback register" },
      ],
    },
    { type: "link", to: "/api", label: "API reference", icon: "code" },
  ],
  apis: { type: "file", input: "../api/openapi/openapi.json", path: "/api" },
};

export default config;
