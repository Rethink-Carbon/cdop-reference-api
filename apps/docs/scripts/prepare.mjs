// Copies the repository's guides into pages/guides/, and the Rethink Carbon logos and favicon into public/, for
// the Zudoku build, so docs/ and the API's public/ stay the only sources. Links between guides
// become portal paths.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const out = path.resolve(here, "../pages/guides");
const GUIDES = {
  "hateoas-tour": "docs/hateoas-tour.md",
  "api-profile": "docs/api-profile.md",
  projection: "docs/projection.md",
  mcp: "docs/mcp.md",
  "schema-feedback": "SCHEMA-FEEDBACK.md",
};
mkdirSync(out, { recursive: true });
for (const [slug, source] of Object.entries(GUIDES)) {
  const md = readFileSync(path.join(repo, source), "utf8").replace(
    /\]\((hateoas-tour|api-profile|projection|mcp)\.md(#[^)]*)?\)/g,
    "](./$1$2)",
  );
  writeFileSync(path.join(out, `${slug}.md`), md);
}
const publicDir = path.resolve(here, "../public");
mkdirSync(publicDir, { recursive: true });
for (const logo of ["rethink-logo-black.svg", "rethink-logo-white.svg"])
  copyFileSync(path.join(repo, "apps/api/public/atlas", logo), path.join(publicDir, logo));
// Zudoku serves the favicon under /docs, so it gets its own copy of the API's.
copyFileSync(
  path.join(repo, "apps/api/public/brand/favicon-32.png"),
  path.join(publicDir, "favicon.png"),
);
console.log(`copied ${Object.keys(GUIDES).length} guides, the logos and the favicon`);
