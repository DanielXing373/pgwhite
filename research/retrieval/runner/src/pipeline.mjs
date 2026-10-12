import { createFakeEmbeddingProvider } from "./providers/fake.mjs";
import { createQwen3EmbeddingProvider } from "./providers/qwen3.mjs";
import { createOllamaConceptProvider } from "./providers/ollamaConcepts.mjs";
import { createQwen3Reranker } from "./providers/qwen3Reranker.mjs";
import { loadTagLibrary, selectActiveThemes } from "./tagLibrary.mjs";
import { buildThemeCorpus } from "./representations.mjs";
import { findDeterministicHits } from "./deterministicMatch.mjs";
import { cosineSimilarity, rankByCosine, takeTopK } from "./rank.mjs";
import { loadBenchmark, resolveExpectedThemeIds } from "./benchmark.mjs";
import {
  recallAtK,
  expectedRanks,
  aggregateRecalls,
  summarizeTaggingLatency,
} from "./evaluate.mjs";
import { readJsonFile, resolveRepoPath } from "./io.mjs";
import { execSync } from "node:child_process";
import os from "node:os";
import { performance } from "node:perf_hooks";

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
    return createQwen3EmbeddingProvider({
      normalize_embeddings: true,
      require_cuda: true,
      ...(providerConfig.options ?? {}),
      model:
        process.env.PGWHITE_QWEN_MODEL ??
        providerConfig.options?.model ??
        "Qwen/Qwen3-Embedding-0.6B",
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
  const routeId = String(config.route_id ?? "direct");
  if (!["direct", "generate-map", "retrieve-rerank"].includes(routeId)) {
    throw new Error(`route_id must be direct|generate-map|retrieve-rerank, got ${routeId}`);
  }
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
  const routeModel = routeId === "generate-map"
    ? createOllamaConceptProvider(config.generation_provider ?? {})
    : routeId === "retrieve-rerank"
      ? createQwen3Reranker(config.reranker_provider ?? {})
      : null;

  try {
    const indexPreparationStarted = performance.now();
    const corpus = buildThemeCorpus(themes, rep);
    const themeVectors = await provider.embed(corpus.map((c) => c.text), {
      role: "document",
    });
    const libraryItems = corpus.map((c, i) => ({
      id: c.id,
      canonical_zh: c.canonical_zh,
      vector: themeVectors[i],
      text: c.text,
    }));
    const themeIndexPreparationMs = performance.now() - indexPreparationStarted;

    // Warm route-specific models before timing individual quotes. Reuse the
    // first generated concept response so the warm-up is not duplicate work.
    let routeModelPreparationMs = 0;
    let firstQuoteConcepts = null;
    if (routeId === "generate-map" && loadedBench.data.quotes.length > 0) {
      const started = performance.now();
      firstQuoteConcepts = await routeModel.generateConcepts(loadedBench.data.quotes[0].text_zh);
      routeModelPreparationMs = performance.now() - started;
    } else if (routeId === "retrieve-rerank") {
      const started = performance.now();
      await routeModel.ready();
      routeModelPreparationMs = performance.now() - started;
    }

    // Report only the conservative Top 3 and standard Top 5 scores. The full
    // ranking remains stored for broader search and later analysis.
    const topKs = [3, 5];
    const storeFull = config.ranking?.store_full_ranking !== false;
    const detEnabled = config.deterministic_match?.enabled !== false;
    const providerMeta = provider.getMetadata();

    const results = [];
    for (let quoteIndex = 0; quoteIndex < loadedBench.data.quotes.length; quoteIndex++) {
      const quote = loadedBench.data.quotes[quoteIndex];
      const expectedIds = resolveExpectedThemeIds(quote, themes);
      const expectedLabels = expectedIds.map(
        (id) => themes.find((t) => t.id === id).canonical_zh,
      );

      const taggingStarted = performance.now();
      const deterministic_hits = detEnabled
        ? findDeterministicHits(quote.text_zh, themes)
        : [];

      let ranked;
      let generated_concepts = null;
      let candidate_pool_size = null;
      if (routeId === "generate-map") {
        generated_concepts = quoteIndex === 0
          ? firstQuoteConcepts
          : await routeModel.generateConcepts(quote.text_zh);
        if (generated_concepts.length === 0) {
          ranked = [];
        } else {
          const conceptVectors = await provider.embed(generated_concepts, { role: "query" });
          ranked = rankByMaxConceptSimilarity(conceptVectors, libraryItems);
        }
      } else {
        const [qVec] = await provider.embed([quote.text_zh], { role: "query" });
        const retrievalRanking = rankByCosine(qVec, libraryItems);
        if (routeId === "retrieve-rerank") {
          candidate_pool_size = Math.min(
            config.route_options?.candidate_pool ?? 20,
            retrievalRanking.length,
          );
          const candidates = retrievalRanking.slice(0, candidate_pool_size);
          const candidateById = new Map(libraryItems.map((item) => [item.id, item]));
          const scores = await routeModel.rerank(
            quote.text_zh,
            candidates.map((candidate) => candidateById.get(candidate.tag_id).text),
          );
          ranked = candidates.map((candidate, index) => ({
            ...candidate,
            retrieval_similarity: candidate.similarity,
            similarity: scores[index],
          })).sort((a, b) => {
            if (b.similarity !== a.similarity) return b.similarity - a.similarity;
            return a.tag_id.localeCompare(b.tag_id);
          }).map((row, index) => ({ ...row, rank: index + 1 }));
        } else {
          ranked = retrievalRanking;
        }
      }
      const tagging_latency_ms = performance.now() - taggingStarted;

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
        ...(generated_concepts == null ? {} : { generated_concepts }),
        ...(candidate_pool_size == null ? {} : { candidate_pool_size }),
        tagging_latency_ms,
        // Keep deterministic evidence structurally separate from semantic ranking.
        semantic_ranking: {
          top_3: takeTopK(ranked, 3),
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
    const performance_metrics = summarizeTaggingLatency(results, {
      theme_index_preparation_ms: themeIndexPreparationMs,
      route_model_preparation_ms: routeModelPreparationMs,
    });

    const created_at = new Date().toISOString();
    const git_commit_sha = detectGitSha(repoRoot);
    const hardware = {
      ...collectHardwareMetadata(),
      // Prefer runtime values reported by the embedding provider (no hardcoded GPU ids).
      cuda_device_id: providerMeta.cuda_device_id ?? null,
      gpu_name: providerMeta.gpu_name ?? null,
      cuda_available: providerMeta.cuda_available ?? null,
      torch_version: providerMeta.torch_version ?? null,
      sentence_transformers_version:
        providerMeta.sentence_transformers_version ?? null,
      embedding_device: providerMeta.device ?? null,
    };

    const exploratory =
      Boolean(loadedBench.data.exploratory) ||
      results.every((r) => (r.expected_theme_ids || []).length === 0);

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
      route_id: routeId,
      embedding_provider: providerMeta,
      route_model_provider: routeModel?.getMetadata?.() ?? null,
      config,
      hardware,
      aggregate_metrics,
      performance_metrics,
      results,
      notes: [
        "Research-only retrieval benchmark. No production Tag assignment.",
        "Deterministic hits are separate from semantic similarity scores.",
        "Fake provider results are not semantic quality evidence.",
        ...(exploratory
          ? [
              "EXPLORATORY fixture/run: no expected Theme ground truth; Recall@K is not interpretable as calibration quality.",
            ]
          : []),
      ],
    };

    const manifest = {
      schema_version: "retrieval-run-manifest.v1",
      run_id: runId,
      created_at,
      git_commit_sha,
      representation: rep,
      route_id: routeId,
      provider_id: providerMeta.provider_id,
      route_model_provider_id: routeModel?.getMetadata?.().provider_id ?? null,
      model_name: providerMeta.model_name,
      model_identifier: providerMeta.model_identifier ?? providerMeta.model_name,
      benchmark_version: loadedBench.data.benchmark_version,
      benchmark_hash: loadedBench.hash,
      tag_library_version: loadedLib.library_version,
      tag_library_hash: loadedLib.hash,
      active_theme_count: themes.length,
      exploratory,
      aggregate_metrics: {
        evaluated_quotes: aggregate_metrics.evaluated_quotes,
        mean_recall_at_3: aggregate_metrics.mean_recall_at_3,
        mean_recall_at_5: aggregate_metrics.mean_recall_at_5,
        success_at_3: aggregate_metrics.success_at_3,
        success_at_3_count: aggregate_metrics.success_at_3_count,
      },
      performance_metrics,
      completed: true,
    };

    return { run, manifest, themes, libraryItems };
  } finally {
    if (routeModel && typeof routeModel.close === "function") {
      try {
        await routeModel.close();
      } catch {
        // ignore close errors
      }
    }
    if (typeof provider.close === "function") {
      try {
        await provider.close();
      } catch {
        // ignore close errors
      }
    }
  }
}

function rankByMaxConceptSimilarity(queryVectors, libraryItems) {
  const scored = libraryItems.map((item) => ({
    tag_id: item.id,
    canonical_zh: item.canonical_zh,
    similarity: Math.max(...queryVectors.map((vector) => cosineSimilarity(vector, item.vector))),
  }));
  scored.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    return a.tag_id.localeCompare(b.tag_id);
  });
  return scored.map((row, index) => ({ ...row, rank: index + 1 }));
}
