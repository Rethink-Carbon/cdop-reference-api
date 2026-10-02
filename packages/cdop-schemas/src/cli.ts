import { lintSchemas } from "./lint.js";
import { driftReport, syncFromUpstream, verifyVendored } from "./sync.js";
import { loadUpstream } from "./index.js";

const [cmd, ...args] = process.argv.slice(2);

async function main(): Promise<number> {
  switch (cmd) {
    case "verify": {
      const r = await verifyVendored();
      const up = loadUpstream();
      if (r.ok) {
        console.log(
          `OK: ${Object.keys(up.files).length} vendored files match upstream ${up.repo}@${up.commit.slice(0, 7)}`,
        );
        return 0;
      }
      console.error(`MISMATCH: ${r.mismatches.join(", ")}`);
      return 1;
    }
    case "lint": {
      const findings = lintSchemas();
      const asJson = args.includes("--json");
      if (asJson) {
        console.log(JSON.stringify(findings, null, 2));
      } else {
        for (const f of findings)
          console.log(`${f.severity.padEnd(7)} ${f.rule.padEnd(22)} ${f.path}  ${f.message}`);
        const errors = findings.filter((f) => f.severity === "error").length;
        console.log(`\n${findings.length} findings (${errors} errors)`);
      }
      // Lint documents known upstream defects; it never fails the build.
      return 0;
    }
    case "sync": {
      const refIdx = args.indexOf("--ref");
      const ref = refIdx >= 0 ? args[refIdx + 1] : "main";
      const pin = await syncFromUpstream(ref);
      console.log(
        `vendored ${Object.keys(pin.files).length} files from ${pin.repo}@${pin.commit.slice(0, 7)}`,
      );
      return 0;
    }
    case "drift": {
      const r = await driftReport(args[0] ?? "main");
      const drifted = r.changed.length + r.added.length + r.removed.length > 0;
      console.log(JSON.stringify(r, null, 2));
      if (drifted) {
        console.error(
          `upstream ${r.upstreamCommit.slice(0, 7)} differs from pinned ${r.pinnedCommit.slice(0, 7)}`,
        );
        return args.includes("--fail-on-drift") ? 2 : 0;
      }
      console.log("no drift");
      return 0;
    }
    default:
      console.error(
        "usage: cli <verify|lint [--json]|sync [--ref x]|drift [ref] [--fail-on-drift]>",
      );
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error((err as Error).message);
    process.exit(1);
  });
