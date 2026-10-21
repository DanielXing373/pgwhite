import { performance } from "node:perf_hooks";
import { loadBenchmark } from "../../../runner/src/benchmark.mjs";
import { loadTagLibrary, selectActiveThemes } from "../../../runner/src/tagLibrary.mjs";
import { assertRequiredRetrieval, candidatesForQuotes, loadRetrievalArtifact } from "./candidates.mjs";
import { summarizeCosts } from "./cost.mjs";
import { FROZEN, verifyDeclaredAsset } from "./freeze.mjs";
import { collectEnvironment } from "./gitInfo.mjs";
import { summarizeLatency } from "./latency.mjs";
import { selectBenchmarkQuotes } from "./quotes.mjs";
import { aggregateSelection } from "./selectionMetrics.mjs";
import { selectThemes } from "./selector/select.mjs";

export async function runSelectionStage({
  repoRoot,
  effectiveConfig,
  effectiveConfigSha256,
  provider,
  pricing,
  safety,
  runId,
  git,
}) {
  const ontology = verifyDeclaredAsset(
    repoRoot,
    effectiveConfig.ontology_path,
    effectiveConfig.expected_ontology_sha256,
    "ontology",
  );
  const benchmark = verifyDeclaredAsset(
    repoRoot,
    effectiveConfig.benchmark_path,
    effectiveConfig.expected_benchmark_sha256,
    "benchmark",
  );
  const artifact = loadRetrievalArtifact(repoRoot, effectiveConfig.retrieval_artifact_path);
  assertRequiredRetrieval(artifact.run, effectiveConfig.required_retrieval, {
    sha256: artifact.sha256,
  });
  const loadedLib = loadTagLibrary(repoRoot, effectiveConfig.ontology_path);
  const themes = selectActiveThemes(loadedLib.library, {
    activeStatus: effectiveConfig.active_status ?? "active_candidate",
  });
  if (ontology.sha256 === FROZEN.ontology.sha256 && themes.length !== FROZEN.ontology.active_themes) {
    throw new Error(`STOP: frozen ontology resolved ${themes.length} active Themes.`);
  }
  const loadedBench = loadBenchmark(repoRoot, effectiveConfig.benchmark_path);
  const sourceExpected = effectiveConfig.expected_source_quote_count
    ?? (effectiveConfig.quote_ids ? null : effectiveConfig.expected_quote_count);
  if (sourceExpected != null && loadedBench.data.quotes.length !== sourceExpected) {
    throw new Error(
      `Source quote count ${loadedBench.data.quotes.length} != expected ${sourceExpected}`,
    );
  }
  const quotes = selectBenchmarkQuotes(loadedBench.data.quotes, effectiveConfig.quote_ids ?? null);
  if (
    effectiveConfig.expected_quote_count != null
    && quotes.length !== effectiveConfig.expected_quote_count
  ) {
    throw new Error(
      `Quote count ${quotes.length} != expected ${effectiveConfig.expected_quote_count}`,
    );
  }
  const rows = candidatesForQuotes({
    retrievalRun: artifact.run,
    quotes,
    themes,
    candidateK: effectiveConfig.candidate_k,
    includeAliases: effectiveConfig.include_aliases === true,
  });
  if (typeof provider.prepare === "function") {
    await provider.prepare({
      model: effectiveConfig.model_id,
      timeoutMs: effectiveConfig.execution?.timeout_ms ?? 60000,
    });
  }

  const wallStarted = performance.now();
  const results = [];
  let stopReason = null;
  for (const row of rows) {
    if (stopReason) {
      results.push({
        quote_id: row.quote_id,
        text_zh: row.text_zh,
        expected_theme_ids: row.expected_theme_ids,
        expected_theme_labels: row.expected_theme_labels,
        zero_theme: row.zero_theme,
        validation_status: "not_run",
        stop_reason: stopReason,
        selected_theme_ids: null,
        candidates: row.candidates,
      });
      continue;
    }
    const selected = await selectThemes({
      quote: row,
      candidates: row.candidates,
      config: effectiveConfig,
      provider,
      safety,
      pricing,
    });
    results.push({
      ...selected,
      expected_theme_ids: row.expected_theme_ids,
      expected_theme_labels: row.expected_theme_labels,
      zero_theme: row.zero_theme,
    });
    if (selected.validation_status === "not_run") {
      stopReason = selected.stop_reason;
    }
  }

  const status = stopReason ? "stopped_budget" : "completed";
  const metrics = aggregateSelection(results.map((row) => ({
    expectedIds: row.expected_theme_ids,
    selectedIds: row.selected_theme_ids,
    validationStatus: row.validation_status,
    candidateIds: (row.candidates ?? []).map((candidate) => candidate.id),
  })));
  const latencySamples = results
    .filter((row) => row.validation_status !== "not_run" && Number.isFinite(row.latency_ms))
    .map((row) => row.latency_ms);
  const run = {
    schema_version: "formal-study-run.v1",
    stage: "selection",
    status,
    run_id: runId,
    experiment_id: effectiveConfig.experiment_id,
    created_at: new Date().toISOString(),
    ...git,
    ontology_version: loadedLib.library_version,
    ontology_sha256: ontology.sha256,
    ontology_path: effectiveConfig.ontology_path,
    benchmark_version: loadedBench.data.benchmark_version,
    benchmark_sha256: benchmark.sha256,
    benchmark_path: effectiveConfig.benchmark_path,
    pilot_benchmark_sha256: benchmark.sha256 === FROZEN.pilot.sha256 ? FROZEN.pilot.sha256 : null,
    retrieval_artifact_path: effectiveConfig.retrieval_artifact_path,
    retrieval_artifact_sha256: artifact.sha256,
    retrieval_run_id: artifact.run.run_id ?? null,
    source_retrieval: {
      run_id: artifact.run.run_id ?? null,
      artifact_path: effectiveConfig.retrieval_artifact_path,
      artifact_sha256: artifact.sha256,
      effective_config_sha256: artifact.run.effective_config_sha256 ?? null,
      ontology_sha256: artifact.run.ontology_sha256 ?? null,
      benchmark_sha256: artifact.run.benchmark_sha256 ?? null,
      representation: artifact.run.representation ?? null,
      instruction_mode: artifact.run.instruction_mode ?? null,
      embedding_model: artifact.run.embedding_provider?.model_name
        ?? artifact.run.effective_config?.provider?.model
        ?? null,
      similarity: artifact.run.similarity ?? null,
      normalize_embeddings: artifact.run.normalize_embeddings ?? null,
      reranker: artifact.run.reranker ?? null,
      active_theme_count: artifact.run.active_theme_count ?? null,
    },
    quote_ids: effectiveConfig.quote_ids ?? null,
    source_quote_count: loadedBench.data.quotes.length,
    candidate_k: effectiveConfig.candidate_k,
    max_selected: effectiveConfig.max_selected,
    include_aliases: effectiveConfig.include_aliases === true,
    selector_task_instruction: results.find((row) => row.prompt)?.prompt?.task_instruction ?? null,
    selector_provider: {
      provider_id: effectiveConfig.provider.id,
      model_id: effectiveConfig.model_id,
      model_id_source: effectiveConfig.model_id_source,
    },
    effective_config: effectiveConfig,
    effective_config_sha256: effectiveConfigSha256,
    aggregate_metrics: metrics,
    cost_summary: summarizeCosts(results),
    performance_metrics: {
      ...summarizeLatency(latencySamples, { throughputMode: "sequential" }),
      total_wall_clock_ms: performance.now() - wallStarted,
    },
    budget: {
      requests_started: safety.requestsStarted,
      known_usd: safety.knownUsd,
      unknown_cost_calls: safety.unknownCostCalls,
      exceeded: safety.exceeded,
      stop_reason: stopReason,
    },
    local_runtime: results.find((row) => row.local_runtime)?.local_runtime ?? null,
    results,
    errors: results.flatMap((row) => row.errors ?? []),
  };
  return {
    run,
    environment: collectEnvironment({
      vram_bytes: run.local_runtime?.vram_bytes ?? null,
      notes: "Sequential selector calls. Concurrent throughput is not measured.",
    }),
  };
}
