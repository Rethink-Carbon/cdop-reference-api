// Writes dist/docs/licenses.txt after the build: the licence of every package in the docs site's
// production dependency tree, with its licence file. The build strips the libraries' own licence
// comments, so this file carries their notices instead. It is deliberately over-inclusive: the
// tree also holds build tools that are not shipped to browsers.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const byLicence = JSON.parse(
  execFileSync("pnpm", ["--filter", "@cdop/docs", "licenses", "list", "--prod", "--json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }),
);
const packages = Object.values(byLicence)
  .flat()
  .sort((a, b) => a.name.localeCompare(b.name));

function licenceText(dir) {
  const file = readdirSync(dir, { withFileTypes: true }).find(
    (entry) => entry.isFile() && /^(licen[cs]e|copying)(\..*)?$/i.test(entry.name),
  );
  return file ? readFileSync(path.join(dir, file.name), "utf8").trim() : undefined;
}

const sections = packages.map((pkg) => {
  const head = `${pkg.name} ${pkg.versions.join(", ")} | ${pkg.license}${pkg.homepage ? ` | ${pkg.homepage}` : ""}`;
  const text = pkg.paths.map(licenceText).find(Boolean);
  return `${head}\n\n${text ?? `(No licence file in the package; its package.json declares ${pkg.license}.)`}`;
});
const out = path.join(root, "dist/docs/licenses.txt");
writeFileSync(
  out,
  [
    "Third-party software in the CDOP reference API documentation (/docs)",
    "",
    "The documentation site is built with Zudoku (MIT, Copyright (c) Zuplo, Inc.). Its pages bundle",
    "open-source libraries whose licence comments the build removes, so their licences are listed",
    "here: every package in the site's production dependency tree, including build tools that are",
    "not shipped to browsers. The service's own notices are at /licenses.",
    "",
    ...sections.flatMap((section) => ["-".repeat(100), section, ""]),
  ].join("\n"),
);
console.log(`wrote ${packages.length} licences to ${path.relative(root, out)}`);
