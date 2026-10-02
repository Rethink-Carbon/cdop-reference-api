// Downloads toedter/hal-explorer (MIT) into public/explorer/vendor for the /explorer HAL browser.
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = process.env.HAL_EXPLORER_VERSION ?? "2.3.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.resolve(here, "../public/explorer/vendor");
if (existsSync(path.join(vendor, "index.html"))) {
  console.log(`hal-explorer already present in ${vendor}`);
  process.exit(0);
}
mkdirSync(vendor, { recursive: true });
const url = `https://github.com/toedter/hal-explorer/releases/download/v${VERSION}/hal-explorer-${VERSION}.zip`;
const zip = path.join(vendor, "hal-explorer.zip");
console.log(`downloading ${url}`);
const res = await fetch(url, { redirect: "follow" });
if (!res.ok || !res.body) {
  console.error(`download failed: ${res.status}`);
  process.exit(1);
}
await pipeline(res.body, createWriteStream(zip));
execFileSync("unzip", ["-oq", zip, "-d", vendor]);
execFileSync("rm", ["-f", zip]);
console.log(`hal-explorer ${VERSION} unpacked into ${vendor}`);
