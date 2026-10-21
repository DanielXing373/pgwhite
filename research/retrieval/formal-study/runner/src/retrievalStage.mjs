import { performance } from "node:perf_hooks";
import { loadTagLibrary, selectActiveThemes, indexThemesById } from "../../../runner/src/tagLibrary.mjs";
import { loadBenchmark, resolveExpectedThemeIds } from "../../../runner/src/benchmark.mjs";
import { buildThemeCorpus } from "../../../runner/src/representations.mjs";
import { findDeterministicHits } from "../../../runner/src/deterministicMatch.mjs";
import { l2Normalize, rankByCosine } from "../../../runner/src/rank.mjs";
import {
  QWEN_BUILTIN_QUERY_PROMPT,
  resolveQwenQueryEncoding,
} from "../../../runner/src/qwenInstructionModes.mjs";
import { FROZEN, verifyDeclaredAsset } from "./freeze.mjs";
import { collectEnvironment } from "./gitInfo.mjs";
import { summarizeLatency } from "./latency.mjs";
import {
  aggregateFormalRetrieval,
  formalExpectedRanks,
  scoreRetrievalQuote,
} from "./retrievalMetrics.mjs";

function encodingForQuote(mode, quote, taskInstruction, providerMeta) {
  const encoding = resolveQwenQueryEncoding(mode, quote, {
    task_instruction: taskInstruction ?? undefined,
  });
  if (mode !== "prompt_name=query") {
    return {
      ...encoding,
      builtin_query_prompt_source: null,
      documented_builtin_query_prompt: null,
      runtime_builtin_query_prompt: null,
      builtin_query_prompt_matches_documented: null,
    };
  }
  const runtime = providerMeta?.builtin_query_prompt
    ? String(providerMeta.builtin_query_prompt)
    : null;
  if (!runtime) {
    return {
      ...encoding,
      builtin_query_prompt_source: "documented_sentence_transformers_default",
      documented_builtin_query_prompt: QWEN_BUILTIN_QUERY_PROMPT,
      runtime_builtin_query_prompt: null,
      builtin_query_prompt_matches_documented: null,
    };
  }
  const instruction = runtime.replace(/^Instruct:\s*/, "").replace(/\nQuery:$/, "");
  return {
    ...encoding,
    effective_prompt_prefix: runtime,
    effective_query_instruction: instruction,
    effective_query_preview: `${runtime}${quote}`,
    builtin_query_prompt_source: "loaded_model",
    documented_builtin_query_prompt: QWEN_BUILTIN_QUERY_PROMPT,
    runtime_builtin_query_prompt: runtime,
    builtin_query_prompt_matches_documented: runtime === QWEN_BUILTIN_QUERY_PROMPT,
  };
}

export async function runRetrievalStage({
  repoRoot,
  effectiveConfig,
  effectiveConfigSha256,
  provider,
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
  const loadedLib = loadTagLibrary(repoRoot, effectiveConfig.ontology_path);
  const themes = selectActiveThemes(loadedLib.library, {
    activeStatus: effectiveConfig.active_status ?? "active_candidate",
  });
  if (ontology.sha256 === FROZEN.ontology.sha256 && themes.length !== FROZEN.ontology.active_themes) {
    throw new Error(
      `STOP: frozen ontology resolved ${themes.length} active Themes, expected ${FROZEN.ontology.active_themes}.`,
    );
  }
  const loadedBench = loadBenchmark(repoRoot, effectiveConfig.benchmark_path);
  if (
    effectiveConfig.expected_quote_count != null
    && loadedBench.data.quotes.length !== effectiveConfig.expected_quote_count
  ) {
    throw new Error(
      `Quote count ${loadedBench.data.quotes.length} != expected ${effectiveConfig.expected_quote_count}`,
    );
  }
  const labelsById = indexThemesById(themes);
  const corpus = buildThemeCorpus(themes, effectiveConfig.representation);
  const textById = new Map(corpus.map((item) => [item.id, item.text]));

  const wallStarted = performance.now();
  const indexStarted = performance.now();
  const documentVectors = await provider.embed(corpus.map((item) => item.text), { role: "document" });
  const libraryItems = corpus.map((item, index) => ({
    id: item.id,
    canonical_zh: item.canonical_zh,
    vector: Array.from(l2Normalize(documentVectors[index])),
    text: item.text,
  }));
  const themeIndexPreparationMs = performance.now() - indexStarted;
  const providerMeta = provider.getMetadata?.() ?? {};

  const results = [];
  for (const quote of loadedBench.data.quotes) {
    const resolved = resolveExpectedThemeIds(quote, themes);
    const declared = [...(quote.expected_theme_ids ?? [])];
    const sameSet = declared.length === resolved.length
      && declared.every((id) => resolved.includes(id));
    if (!sameSet) {
      throw new Error(
        `Quote ${quote.quote_id}: expected_theme_ids do not match expected_theme_labels`,
      );
    }
    const expectedIds = declared;
    const encoding = encodingForQuote(
      effectiveConfig.instruction_mode,
      quote.text_zh,
      effectiveConfig.task_instruction,
      providerMeta,
    );
    const started = performance.now();
    const deterministicHits = findDeterministicHits(quote.text_zh, themes);
    const [queryVector] = await provider.embed([quote.text_zh], { role: "query" });
    const ranked = rankByCosine(Array.from(l2Normalize(queryVector)), libraryItems);
    if (ranked.length !== themes.length) {
      throw new Error(
        `Full ranking length ${ranked.length} != active Themes ${themes.length} for ${quote.quote_id}`,
      );
    }
    const ranking = ranked.map((row) => ({
      rank: row.rank,
      tag_id: row.tag_id,
      canonical_zh: row.canonical_zh,
      representation_text: textById.get(row.tag_id),
      similarity: row.similarity,
    }));
    const taggingLatencyMs = performance.now() - started;
    const ranksOfExpected = formalExpectedRanks(expectedIds, ranking, new Map(
      [...labelsById].map(([id, theme]) => [id, theme.canonical_zh]),
    ));
    results.push({
      quote_id: quote.quote_id,
      text_zh: quote.text_zh,
      expected_theme_ids: expectedIds,
      expected_theme_labels: expectedIds.map((id) => labelsById.get(id).canonical_zh),
      zero_theme: expectedIds.length === 0,
      instruction_mode: encoding.instruction_mode,
      effective_query_instruction: encoding.effective_query_instruction,
      effective_prompt_prefix: encoding.effective_prompt_prefix,
      effective_query_text: encoding.effective_query_preview,
      query_encoding_description: encoding.query_encoding_description,
      document_encoding_description: encoding.document_encoding,
      builtin_query_prompt_source: encoding.builtin_query_prompt_source,
      documented_builtin_query_prompt: encoding.documented_builtin_query_prompt,
      runtime_builtin_query_prompt: encoding.runtime_builtin_query_prompt,
      builtin_query_prompt_matches_documented: encoding.builtin_query_prompt_matches_documented,
      deterministic_hits: deterministicHits,
      tagging_latency_ms: taggingLatencyMs,
      ranking,
      ranks_of_expected: ranksOfExpected,
      recall_at: scoreRetrievalQuote(expectedIds, ranking),
      errors: [],
      retries: 0,
    });
  }

  const headerEncoding = encodingForQuote(
    effectiveConfig.instruction_mode,
    "",
    effectiveConfig.task_instruction,
    provider.getMetadata?.() ?? providerMeta,
  );
  const aggregate = aggregateFormalRetrieval(results);
  const latency = summarizeLatency(
    results.map((row) => row.tagging_latency_ms),
    { throughputMode: "sequential" },
  );
  const run = {
    schema_version: "formal-study-run.v1",
    stage: "retrieval",
    status: "completed",
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
    representation: effectiveConfig.representation,
    instruction_mode: effectiveConfig.instruction_mode,
    effective_query_instruction: headerEncoding.effective_query_instruction,
    effective_prompt_prefix: headerEncoding.effective_prompt_prefix,
    query_encoding_description: headerEncoding.query_encoding_description,
    document_encoding_description: headerEncoding.document_encoding,
    builtin_query_prompt_source: headerEncoding.builtin_query_prompt_source,
    runtime_builtin_query_prompt: headerEncoding.runtime_builtin_query_prompt,
    similarity: "cosine",
    normalize_embeddings: true,
    reranker: null,
    active_theme_count: themes.length,
    embedding_provider: provider.getMetadata?.() ?? providerMeta,
    effective_config: effectiveConfig,
    effective_config_sha256: effectiveConfigSha256,
    hardware: {
      declared_gpu: effectiveConfig.declared_gpu ?? null,
      gpu_name: providerMeta.gpu_name ?? null,
      cuda_device_id: providerMeta.cuda_device_id ?? null,
      cuda_available: providerMeta.cuda_available ?? null,
    },
    aggregate_metrics: aggregate,
    performance_metrics: {
      ...latency,
      total_wall_clock_ms: performance.now() - wallStarted,
      theme_index_preparation_ms: themeIndexPreparationMs,
    },
    theme_documents: corpus.map((item) => ({
      tag_id: item.id,
      canonical_zh: item.canonical_zh,
      representation: effectiveConfig.representation,
      representation_text: item.text,
    })),
    results,
    errors: [],
  };
  const environment = collectEnvironment({
    gpu_name: providerMeta.gpu_name ?? null,
    cuda_device_id: providerMeta.cuda_device_id ?? null,
    cuda_available: providerMeta.cuda_available ?? null,
    torch_version: providerMeta.torch_version ?? null,
    sentence_transformers_version: providerMeta.sentence_transformers_version ?? null,
    python_executable: providerMeta.python_executable ?? null,
    notes: "VRAM is recorded only when the provider reports it.",
  });
  return { run, environment };
}
