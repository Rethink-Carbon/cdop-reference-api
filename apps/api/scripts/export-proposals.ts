import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PROPOSAL_SCHEMA, PROPOSAL_VERSION } from "../src/domain/projection/proposal.js";
import { proposalExamples } from "../src/domain/projection/proposal-examples.js";

const root = new URL(`../../../examples/proposals/${PROPOSAL_VERSION}/`, import.meta.url);
const files = { schema: PROPOSAL_SCHEMA, ...proposalExamples() };
await mkdir(root, { recursive: true });
for (const [name, value] of Object.entries(files)) {
  const file = new URL(`${name}.json`, root);
  const text = JSON.stringify(value, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if ((await readFile(file, "utf8")) !== text) throw new Error(`Stale proposal example: ${name}`);
  } else await writeFile(file, text);
}
console.log(
  `${Object.keys(files).length} proposal files ${process.argv.includes("--check") ? "verified" : "exported"}`,
);
