import { createFakeEmbeddingProvider } from "./providers/fake.mjs";
import { createQwen3EmbeddingProviderStub } from "./providers/interface.mjs";
import { loadTagLibrary, selectActiveThemes } from "./tagLibrary.mjs";
import { buildThemeCorpus } from "./representations.mjs";
import { findDeterministicHits } from "./deterministicMatch.mjs";
import { rankByCosine, takeTopK } from "./rank.mjs";
import { loadBenchmark, resolveExpectedThemeIds } from "./benchmark.mjs";
import {
  recallAtK,
  expectedRanks,
  aggregateRecalls,
} from "./evaluate.mjs";
import { readJsonFile, resolveRepoPath } from "./io.mjs";
import { execSync } from "node:child_process";
import os from "node:os";

export function loadConfig(repoRoot, configPath) {
  const path = resolveRepoPath(repoRoot, configPath);
  const config = readJsonFile(path);
  if (config.schema_version !== "retrieval-config.v1") {
    throw new Error(`Unexpected config schema_version: ${config.schema_version}`);
  }
  return { path, config };
}

export function createProvider(providerConfig) {
  const id = providerConfig?.id ?? "fake";
  if (id === "fake") {
    return createFakeEmbeddingProvider(providerConfig.options ?? {});
  }
  if (id === "qwen3" || id === "qwen" || id === "Qwen/Qwen3-Embedding-0.6B") {
    return createQwen3EmbeddingProviderStub({
      model: "Qwen/Qwen3-Embedding-0.6B",
      ...(providerConfig.options ?? {}),
    });
  }
  throw new Error(`Unknown embedding provider id: ${id}`);
}

export function detectGitSha(repoRoot) {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

export function collectHardwareMetadata() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    cpus: os.cpus()?.[0]?.model ?? null,
    total_mem_bytes: os.totalmem(),
    // Device ids intentionally not hardcoded; leave null until a real provider fills them.
    cuda_device_id: null,
    gpu_name: null,
  };
}

/**
 * Run retrieval benchmark end-to-end (provider may be fake or future Qwen).
 */
export async function runRetrievalBenchmark({
  repoRoot,
  config,
  representation,
  runId,
  providerOverride,
}) {
  const rep = String(representation ?? config.representation ?? "A").toUpperCase();
  if (!["A", "B", "C"].includes(rep)) {
    throw new Error(`representation must be A|B|C, got ${rep}`);
  }

  const loadedLib = loadTagLibrary(repoRoot, config.tag_library_path);
  const themes = selectActiveThemes(loadedLib.library, {
    activeStatus: config.active_status ?? "active_candidate",
  });
  if (themes.length < 1) {
    throw new Error("No active Theme candidates after filtering");
  }

  const loadedBench = loadBenchmark(repoRoot, config.benchmark_path);
  const provider = providerOverride ?? createProvider(config.provider ?? { id: "fake" });
  const providerMeta = provider.getMetadata();

  const corpus = buildThemeCorpus(themes, rep);
  const themeVectors = await provider.embed(corpus.map((c) => c.text));
  const libraryItems = corpus.map((c, i) => ({
    id: c.id,
    canonical_zh: c.canonical_zh,
    vector: themeVectors[i],
    text: c.text,
  }));

  const topKs = config.ranking?.top_k_report ?? [5, 10, 20];
  const storeFull = config.ranking?.store_full_ranking !== false;
  const detEnabled = config.deterministic_match?.enabled !== false;

  const results = [];
  for (const quote of loadedBench.data.quotes) {
    const expectedIds = resolveExpectedThemeIds(quote, themes);
    const expectedLabels = expectedIds.map(
      (id) => themes.find((t) => t.id === id).canonical_zh,
    );

    const deterministic_hits = detEnabled
      ? findDeterministicHits(quote.text_zh, themes)
      : [];

    const [qVec] = await provider.embed([quote.text_zh]);
    const ranked = rankByCosine(qVec, libraryItems);

    const recall_at = {};
    for (const k of topKs) {
      recall_at[k] = recallAtK(expectedIds, ranked, k);
    }

    results.push({
      quote_id: quote.quote_id,
      text_zh: quote.text_zh,
      source: quote.source ?? null,
      category: quote.category ?? null,
      notes: quote.notes ?? null,
      ambiguity_flags: quote.ambiguity_flags ?? [],
      expected_theme_ids: expectedIds,
      expected_theme_labels: expectedLabels,
      deterministic_hits,
      // Keep deterministic evidence structurally separate from semantic ranking.
      semantic_ranking: {
        top_5: takeTopK(ranked, 5),
        top_10: takeTopK(ranked, 10),
        top_20: takeTopK(ranked, 20),
        full: storeFull ? ranked : null,
      },
      ranks_of_expected: expectedRanks(expectedIds, ranked),
      recall_at,
      // Placeholder slots for later human failure analysis (not auto-filled).
      analysis_hints: {
        possible_retrieval_failure: expectedIds.some((id) => {
          const row = ranked.find((r) => r.tag_id === id);
          return !row || row.rank > 20;
        }),
        taxonomy_gap: null,
        benchmark_ambiguity: (quote.ambiguity_flags ?? []).length > 0,
      },
    });
  }

  const aggregate_metrics = aggregateRecalls(
    results.map((r) => ({ recall_at: r.recall_at })),
    topKs,
  );

  const created_at = new Date().toISOString();
  const git_commit_sha = detectGitSha(repoRoot);
  const hardware = collectHardwareMetadata();

  const run = {
    schema_version: "retrieval-run.v1",
    run_id: runId,
    created_at,
    git_commit_sha,
    tag_library_version: loadedLib.library_version,
    tag_library_hash: loadedLib.hash,
    tag_library_path: config.tag_library_path,
    active_theme_count: themes.length,
    benchmark_version: loadedBench.data.benchmark_version,
    benchmark_hash: loadedBench.hash,
    benchmark_path: config.benchmark_path,
    representation: rep,
    embedding_provider: providerMeta,
    config,
    hardware,
    aggregate_metrics,
    results,
    notes: [
      "Research-only retrieval benchmark. No production Tag assignment.",
      "Deterministic hits are separate from semantic similarity scores.",
      "Fake provider results are not semantic quality evidence.",
    ],
  };

  const manifest = {
    schema_version: "retrieval-run-manifest.v1",
    run_id: runId,
    created_at,
    git_commit_sha,
    representation: rep,
    provider_id: providerMeta.provider_id,
    model_name: providerMeta.model_name,
    benchmark_version: loadedBench.data.benchmark_version,
    benchmark_hash: loadedBench.hash,
    tag_library_version: loadedLib.library_version,
    tag_library_hash: loadedLib.hash,
    active_theme_count: themes.length,
    aggregate_metrics: {
      evaluated_quotes: aggregate_metrics.evaluated_quotes,
      mean_recall_at_5: aggregate_metrics.mean_recall_at_5,
      mean_recall_at_10: aggregate_metrics.mean_recall_at_10,
      mean_recall_at_20: aggregate_metrics.mean_recall_at_20,
    },
    completed: true,
  };

  return { run, manifest, themes, libraryItems };
}
