#!/usr/bin/env node
/**
 * PGWhite 1.42 retrieval benchmark CLI (foundation).
 *
 * Examples:
 *   node research/retrieval/runner/scripts/run-retrieval-benchmark.mjs --representation A --run-id smoke-fake-A
 *   npm run research:retrieval:run -- --representation B --run-id smoke-fake-B
 *
 * Default config uses fake (no model download). For Qwen3 on the experiment machine,
 * pass --provider qwen3 and a CUDA-ready Python venv (see research/retrieval/docs/setup.md).
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadConfig,
  runRetrievalBenchmark,
} from "../src/pipeline.mjs";
import {
  assertRunNotCompleted,
  resolveRunDir,
  writeRunArtifacts,
  buildAnalysisStub,
  renderSummaryMarkdown,
} from "../src/runArtifact.mjs";

function parseArgs(argv) {
  const out = {
    config: "research/retrieval/config/default.retrieval.v1.json",
    representation: null,
    runId: null,
    provider: null,
    dryRun: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--config") out.config = argv[++i];
    else if (a === "--representation") out.representation = argv[++i];
    else if (a === "--run-id") out.runId = argv[++i];
    else if (a === "--provider") out.provider = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function usage() {
  return `Usage:
  run-retrieval-benchmark.mjs --representation A|B|C --run-id <id> [options]

Options:
  --config <path>          Config JSON (default: research/retrieval/config/default.retrieval.v1.json)
  --representation A|B|C   Override config representation
  --run-id <id>            Required unique run directory name under research/retrieval/runs/
  --provider fake|qwen3    Override provider (qwen3 requires local CUDA Sentence Transformers venv)
  --dry-run                Compute results but do not write run artifacts
  --help

Experiment 0.1 example:
  npm run research:retrieval:run -- --config research/retrieval/config/exp0.1-qwen06b.retrieval.v1.json --provider qwen3 --representation A --run-id exp0.1-qwen06b-A
`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.runId) {
    console.error("STOP: --run-id is required (immutable run directory name).");
    console.error(usage());
    process.exit(1);
  }

  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const { config } = loadConfig(repoRoot, args.config);

  if (args.provider) {
    config.provider = {
      ...(config.provider || {}),
      id: args.provider,
    };
  }

  const runDir = resolveRunDir(repoRoot, config.runs_dir || "research/retrieval/runs", args.runId);
  if (!args.dryRun) {
    assertRunNotCompleted(runDir, {
      allowOverwrite: config.overwrite_completed_runs === true,
    });
  }

  const { run, manifest } = await runRetrievalBenchmark({
    repoRoot,
    config,
    representation: args.representation ?? config.representation,
    runId: args.runId,
  });

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          dry_run: true,
          run_id: run.run_id,
          representation: run.representation,
          active_theme_count: run.active_theme_count,
          aggregate_metrics: run.aggregate_metrics,
        },
        null,
        2,
      ),
    );
    return;
  }

  writeRunArtifacts(runDir, {
    manifest,
    run,
    summaryMarkdown: renderSummaryMarkdown(run),
    analysisStub: buildAnalysisStub(run.results),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        run_dir: runDir,
        run_id: run.run_id,
        representation: run.representation,
        provider: run.embedding_provider.provider_id,
        active_theme_count: run.active_theme_count,
        aggregate_metrics: {
          evaluated_quotes: run.aggregate_metrics.evaluated_quotes,
          mean_recall_at_5: run.aggregate_metrics.mean_recall_at_5,
          mean_recall_at_10: run.aggregate_metrics.mean_recall_at_10,
          mean_recall_at_20: run.aggregate_metrics.mean_recall_at_20,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
