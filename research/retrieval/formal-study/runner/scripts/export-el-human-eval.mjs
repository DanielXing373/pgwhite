#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBlindedHumanEval } from "../src/humanEval.mjs";
import { redactSecrets } from "../src/safety.mjs";

function take(argv, index, flag) {
  const value = argv[index];
  if (value == null || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(argv) {
  const out = { runs: [], seed: null, publicOut: null, privateOut: null, allowSynthetic: false };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--run") out.runs.push(take(argv, ++i, flag));
    else if (flag === "--seed") out.seed = Number(take(argv, ++i, flag));
    else if (flag === "--public-out") out.publicOut = take(argv, ++i, flag);
    else if (flag === "--private-out") out.privateOut = take(argv, ++i, flag);
    else if (flag === "--allow-synthetic-fixture") out.allowSynthetic = true;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (out.runs.length === 0 || out.seed == null || !out.publicOut || !out.privateOut) {
    throw new Error("Required: --run <path> [--run ...] --seed <int> --public-out --private-out");
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
  const runs = args.runs.map((rel) => JSON.parse(readFileSync(resolve(repoRoot, rel), "utf8")));
  for (const run of runs) {
    const provider = run.selector_provider?.provider_id;
    if (provider === "fake" && !args.allowSynthetic) {
      throw new Error("STOP: refusing to export fake-provider outputs as human evaluation. Use --allow-synthetic-fixture only in tests.");
    }
  }
  const { publicExport, privateMapping } = buildBlindedHumanEval({
    runs,
    seed: args.seed,
    experimentBatch: "EL",
  });
  const publicAbs = resolve(repoRoot, args.publicOut);
  const privateAbs = resolve(repoRoot, args.privateOut);
  mkdirSync(dirname(publicAbs), { recursive: true });
  mkdirSync(dirname(privateAbs), { recursive: true });
  writeFileSync(publicAbs, `${JSON.stringify(publicExport, null, 2)}\n`);
  writeFileSync(privateAbs, `${JSON.stringify(privateMapping, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    sample_count: publicExport.sample_count,
    public_out: publicAbs,
    private_out: privateAbs,
  }, null, 2));
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(redactSecrets(error?.stack || error?.message || String(error)));
    process.exitCode = 1;
  });
}
