import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function assertRunDirAvailable(runDir) {
  if (!existsSync(runDir)) return;
  const entries = readdirSync(runDir);
  if (entries.length > 0) {
    throw new Error(
      `Refusing to overwrite existing run directory ${runDir}. Choose a new run_id.`,
    );
  }
}

export function renderFormalSummary(run) {
  const lines = [
    `# ${run.run_id}`,
    "",
    `- status: ${run.status}`,
    `- stage: ${run.stage}`,
    `- experiment: ${run.experiment_id}`,
    `- git: ${run.git_commit_sha} (${run.git_branch}, dirty=${run.git_dirty})`,
    `- effective_config_sha256: ${run.effective_config_sha256}`,
    `- ontology_sha256: ${run.ontology_sha256}`,
    `- benchmark_sha256: ${run.benchmark_sha256}`,
  ];
  if (run.stage === "selection") {
    lines.push(
      `- retrieval_run_id: ${run.retrieval_run_id}`,
      `- retrieval_artifact_sha256: ${run.retrieval_artifact_sha256}`,
    );
  }
  if (run.stage === "retrieval") {
    const metrics = run.aggregate_metrics;
    lines.push(
      `- Recall@5/10/20: ${metrics.mean_recall_at_5} / ${metrics.mean_recall_at_10} / ${metrics.mean_recall_at_20}`,
      `- evaluated quotes: ${metrics.evaluated_quotes}; skipped empty expected: ${metrics.skipped_empty_expected}`,
      `- sequential P50/P95 ms: ${run.performance_metrics.sequential?.p50_ms} / ${run.performance_metrics.sequential?.p95_ms}`,
    );
  } else {
    const metrics = run.aggregate_metrics;
    lines.push(
      `- output validity: ${metrics.output_validity_rate} (valid ${metrics.valid_quotes} / attempted ${metrics.attempted_quotes})`,
      `- micro P/R/F1: ${metrics.micro.precision} / ${metrics.micro.recall} / ${metrics.micro.f1}`,
      `- exact match (valid only): ${metrics.exact_match_rate_valid_only} (n=${metrics.exact_match_valid_denominator})`,
      `- zero-theme accuracy: ${metrics.zero_theme_accuracy} (n=${metrics.zero_theme_denominator})`,
      `- total USD: ${run.cost_summary.total_usd_status} ${run.cost_summary.total_usd}`,
      `- sequential P50/P95 ms: ${run.performance_metrics.sequential?.p50_ms} / ${run.performance_metrics.sequential?.p95_ms}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function writeFormalRun(runDir, { run, environment, effectiveConfig }) {
  assertRunDirAvailable(runDir);
  mkdirSync(runDir, { recursive: true });
  const manifest = {
    schema_version: "formal-study-run-manifest.v1",
    run_id: run.run_id,
    stage: run.stage,
    status: run.status,
    experiment_id: run.experiment_id,
    created_at: run.created_at,
    git_commit_sha: run.git_commit_sha,
    git_branch: run.git_branch,
    git_dirty: run.git_dirty,
    ontology_sha256: run.ontology_sha256,
    benchmark_sha256: run.benchmark_sha256,
    pilot_benchmark_sha256: run.pilot_benchmark_sha256,
    effective_config_sha256: run.effective_config_sha256,
    aggregate_metrics: run.aggregate_metrics,
    performance_metrics: run.performance_metrics,
    cost_summary: run.cost_summary ?? null,
  };
  writeFileSync(join(runDir, "config.snapshot.json"), `${JSON.stringify(effectiveConfig, null, 2)}\n`);
  writeFileSync(join(runDir, "environment.json"), `${JSON.stringify(environment, null, 2)}\n`);
  writeFileSync(join(runDir, "run.json"), `${JSON.stringify(run, null, 2)}\n`);
  writeFileSync(join(runDir, "summary.md"), renderFormalSummary(run));
  writeFileSync(join(runDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { runDir, manifest };
}
