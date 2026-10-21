#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { archiveFormalRun } from "../src/archive.mjs";
import { redactSecrets } from "../src/safety.mjs";

function take(argv, index, flag) {
  const value = argv[index];
  if (value == null || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(argv) {
  const out = { runDir: null, archiveDir: null, experimentId: null };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--run-dir") out.runDir = take(argv, ++i, flag);
    else if (flag === "--archive-dir") out.archiveDir = take(argv, ++i, flag);
    else if (flag === "--experiment-id") out.experimentId = take(argv, ++i, flag);
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!out.runDir || !out.archiveDir || !out.experimentId) {
    throw new Error("Required: --run-dir --archive-dir --experiment-id");
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
  const result = archiveFormalRun({
    runDir: resolve(repoRoot, args.runDir),
    archiveDir: resolve(repoRoot, args.archiveDir),
    experimentId: args.experimentId,
  });
  console.log(JSON.stringify({
    ok: result.validated.ok,
    archive_dir: result.archiveDir,
    file_count: result.validated.file_count,
  }, null, 2));
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(redactSecrets(error?.stack || error?.message || String(error)));
    process.exitCode = 1;
  });
}
