#!/usr/bin/env node
/**
 * Validate a calibration benchmark fixture against the active 1.41 Theme library.
 *
 * Usage:
 *   npm run research:retrieval:validate-calib
 *   npm run research:retrieval:validate-calib -- --benchmark research/retrieval/benchmark/fixtures/calib-zh-themes.v1.json
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateCalibrationBenchmark,
  assertCalibrationValid,
} from "../src/validateCalibration.mjs";

function parseArgs(argv) {
  const out = {
    benchmark: "research/retrieval/benchmark/fixtures/calib-zh-themes.v1.json",
    tagLibrary:
      "research/tag-library/data/library/atomic-tag-library.v1.json",
    strict: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--benchmark") out.benchmark = argv[++i];
    else if (a === "--tag-library") out.tagLibrary = argv[++i];
    else if (a === "--strict") out.strict = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: validate-calibration.mjs [--benchmark <path>] [--strict]

Draft scaffolds with empty quotes[] pass with warnings unless --strict.
`);
    return;
  }
  const repoRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const result = validateCalibrationBenchmark({
    repoRoot,
    benchmarkPath: args.benchmark,
    tagLibraryPath: args.tagLibrary,
  });

  if (args.strict) {
    // Treat warnings as failures under --strict (blocks empty draft from "passing").
    if (result.warnings.length > 0) {
      result.ok = false;
      result.errors = [
        ...result.errors,
        ...result.warnings.map((w) => ({ ...w, severity: "error" })),
      ];
    }
    assertCalibrationValid(result);
  }

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        status: result.status,
        benchmark_version: result.benchmark_version,
        quote_count: result.quote_count,
        active_theme_count: result.active_theme_count,
        error_count: result.errors.length,
        warning_count: result.warnings.length,
        issues: result.issues,
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exit(1);
}

main();
