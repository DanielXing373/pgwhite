import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256File } from "../runner/src/io.mjs";
import { createFakeEmbeddingProvider } from "../runner/src/providers/fake.mjs";
import {
  DEFAULT_LITERARY_TASK_INSTRUCTION,
  QWEN_BUILTIN_QUERY_PROMPT,
} from "../runner/src/qwenInstructionModes.mjs";
import { buildThemeCorpus } from "../runner/src/representations.mjs";
import { loadTagLibrary, selectActiveThemes } from "../runner/src/tagLibrary.mjs";
import { representationA, representationB, representationC } from "../../tag-library/src/representations.mjs";
import { FROZEN } from "../formal-study/runner/src/freeze.mjs";
import { executeFormalStudy } from "../formal-study/runner/src/execute.mjs";
import { calculateUsdCost } from "../formal-study/runner/src/cost.mjs";
import { percentile, summarizeLatency } from "../formal-study/runner/src/latency.mjs";
import {
  aggregateFormalRetrieval,
  scoreRetrievalQuote,
} from "../formal-study/runner/src/retrievalMetrics.mjs";
import { aggregateSelection } from "../formal-study/runner/src/selectionMetrics.mjs";
import {
  SELECTOR_TASK_INSTRUCTION,
  buildDeepSeekBody,
  buildGeminiBody,
  buildOllamaBody,
  buildOpenAIBody,
  buildSelectorPrompt,
} from "../formal-study/runner/src/selector/instruction.mjs";
import { parseSelectorResponse, validateSelection } from "../formal-study/runner/src/selector/validate.mjs";
import { createFakeSelector } from "../formal-study/runner/src/selector/providers/fake.mjs";
import { createOllamaSelector } from "../formal-study/runner/src/selector/providers/ollama.mjs";
import { createGeminiSelector } from "../formal-study/runner/src/selector/providers/gemini.mjs";
import { createSelectorProvider } from "../formal-study/runner/src/selector/registry.mjs";
import { selectThemes } from "../formal-study/runner/src/selector/select.mjs";
import { createBudgetGuard, redactDeep, redactSecrets } from "../formal-study/runner/src/safety.mjs";
import { runSelectionStage } from "../formal-study/runner/src/selectionStage.mjs";
import { readdirSync } from "node:fs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const configDir = join(repoRoot, "research/retrieval/formal-study/configs");

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "pgwhite-formal-"));
  return dir;
}

test("frozen ontology, benchmark, and pilot hashes match the study constants", () => {
  assert.equal(sha256File(join(repoRoot, FROZEN.ontology.path)), FROZEN.ontology.sha256);
  assert.equal(sha256File(join(repoRoot, FROZEN.benchmark.path)), FROZEN.benchmark.sha256);
  assert.equal(sha256File(join(repoRoot, FROZEN.pilot.path)), FROZEN.pilot.sha256);
});

test("frozen study JSON files are LF-only so SHA-256 is OS-independent", () => {
  for (const rel of [FROZEN.ontology.path, FROZEN.benchmark.path, FROZEN.pilot.path]) {
    const buf = readFileSync(join(repoRoot, rel));
    assert.equal(buf.includes(0x0d), false, `${rel} contains CR bytes`);
  }
});

test("nine retrieval configs cover A/B/C by none, query, and task_instruct", async () => {
  const files = [
    "P1-A-none", "P1-B-none", "P1-C-none",
    "P1-A-query", "P1-B-query", "P1-C-query",
    "P1-A-task", "P1-B-task", "P1-C-task",
  ];
  const seen = new Set();
  for (const id of files) {
    const plan = await executeFormalStudy({
      repoRoot,
      configPath: join(configDir, `${id}.retrieval.v1.json`),
      executionMode: "dry-run",
    });
    assert.equal(plan.plan.calls_provider, false);
    assert.equal(plan.plan.active_theme_count, 185);
    assert.equal(plan.plan.quote_count, 58);
    assert.equal(plan.plan.effective_config.provider.model, FROZEN.embedding_model);
    assert.equal(plan.plan.effective_config.reranker, null);
    assert.equal(plan.plan.effective_config.similarity, "cosine");
    assert.deepEqual(plan.plan.blockers, []);
    seen.add(`${plan.plan.representation}|${plan.plan.instruction_mode}`);
  }
  assert.equal(seen.size, 9);
  const task = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "P1-C-task.retrieval.v1.json"),
    executionMode: "dry-run",
  });
  assert.equal(task.plan.effective_query_instruction, DEFAULT_LITERARY_TASK_INSTRUCTION);
});

test("dry-run does not construct a provider, and a mismatched hash stops", async () => {
  let constructed = false;
  const plan = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "P1-A-none.retrieval.v1.json"),
    executionMode: "dry-run",
    providerFactory() {
      constructed = true;
      return createFakeEmbeddingProvider({ dimensions: 8 });
    },
  });
  assert.equal(constructed, false);
  assert.equal(plan.plan.calls_provider, false);
  const dir = tempDir();
  try {
    const source = JSON.parse(readFileSync(join(configDir, "P1-A-none.retrieval.v1.json"), "utf8"));
    source.expected_ontology_sha256 = "0".repeat(64);
    const configPath = join(dir, "bad.json");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(configPath, JSON.stringify(source));
    await assert.rejects(
      () => executeFormalStudy({
        repoRoot,
        configPath,
        executionMode: "dry-run",
      }),
      /STOP:/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI representation override is the effective config that gets hashed", async () => {
  const base = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "P1-A-none.retrieval.v1.json"),
    executionMode: "dry-run",
  });
  const overridden = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "P1-A-none.retrieval.v1.json"),
    executionMode: "dry-run",
    cli: { representation: "C" },
  });
  assert.equal(overridden.plan.effective_config.representation, "C");
  assert.equal(overridden.plan.effective_config.provenance.cli_overrides.representation, "C");
  assert.notEqual(base.plan.effective_config_sha256, overridden.plan.effective_config_sha256);
  assert.equal(overridden.plan.effective_config.provenance.source_config_sha256, sha256File(join(configDir, "P1-A-none.retrieval.v1.json")));
});

test("A/B/C representation texts follow the shared library helpers", () => {
  const { library } = loadTagLibrary(repoRoot, FROZEN.ontology.path);
  const themes = selectActiveThemes(library);
  assert.equal(themes.length, 185);
  const tag = themes.find((theme) => theme.aliases.length > 0);
  assert.ok(tag);
  for (const kind of ["A", "B", "C"]) {
    const [row] = buildThemeCorpus([tag], kind);
    const expected = kind === "A"
      ? representationA(tag.canonical_zh)
      : kind === "B"
        ? representationB(tag.canonical_zh, tag.definition)
        : representationC(tag.canonical_zh, tag.definition, tag.aliases);
    assert.equal(row.text, expected);
  }
  assert.equal(representationA(tag.canonical_zh).includes("｜别名："), false);
});

test("Recall@5/10/20 are slices of one ranking, and empty expected sets are not perfect", () => {
  const ranked = Array.from({ length: 20 }, (_, index) => ({
    tag_id: index === 5 ? "hit" : `other-${index}`,
    rank: index + 1,
  }));
  const recall = scoreRetrievalQuote(["hit"], ranked);
  assert.equal(recall[5].recall, 0);
  assert.equal(recall[10].recall, 1);
  assert.equal(recall[20].recall, 1);
  const empty = scoreRetrievalQuote([], ranked);
  assert.equal(empty[5].evaluated, false);
  assert.equal(empty[5].recall, null);
  const aggregate = aggregateFormalRetrieval([
    { quote_id: "empty", recall_at: empty, ranks_of_expected: [], expected_theme_ids: [] },
  ]);
  assert.equal(aggregate.mean_recall_at_5, null);
  assert.equal(aggregate.mean_recall_at_20, null);
  assert.equal(aggregate.skipped_empty_expected, 1);
  assert.equal(aggregate.evaluated_quotes, 0);
});

test("selection metrics keep zero denominators null", () => {
  const correctEmpty = aggregateSelection([
    { expectedIds: [], selectedIds: [], validationStatus: "valid" },
  ]);
  assert.equal(correctEmpty.micro.precision, null);
  assert.equal(correctEmpty.micro.recall, null);
  assert.equal(correctEmpty.macro.precision, null);
  assert.equal(correctEmpty.zero_theme_accuracy, 1);
  assert.equal(correctEmpty.zero_theme_denominator, 1);
  assert.equal(correctEmpty.exact_match_rate_valid_only, 1);
  assert.equal(correctEmpty.average_selected_theme_count, 0);

  const mixed = aggregateSelection([
    { expectedIds: ["a", "b"], selectedIds: ["a"], validationStatus: "valid" },
    { expectedIds: [], selectedIds: ["a"], validationStatus: "valid" },
    { expectedIds: ["a"], selectedIds: null, validationStatus: "invalid" },
    { expectedIds: [], selectedIds: null, validationStatus: "not_run" },
  ]);
  assert.equal(mixed.not_run_quotes, 1);
  assert.equal(mixed.invalid_output_rate, 1 / 3);
  assert.equal(mixed.micro.fp, 1);
  assert.equal(mixed.zero_theme_denominator, 1);
  assert.equal(mixed.zero_theme_accuracy, 0);
  assert.equal(mixed.exact_match_rate_all_quotes, 0);
  assert.ok(mixed.macro.precision != null && mixed.macro.precision < 1);
});

test("selector validation rejects invented, duplicate, oversized, and malformed output", () => {
  const candidates = ["theme-a", "theme-b"];
  assert.deepEqual(validateSelection([], candidates).selected_theme_ids, []);
  assert.equal(validateSelection(["theme-a", "theme-a"], candidates).reason, "duplicate");
  assert.equal(validateSelection(["theme-a", "theme-b", "theme-a", "theme-b"], candidates).reason, "too_many");
  assert.equal(validateSelection(["theme-missing"], candidates).reason, "id_not_in_candidates");
  assert.equal(parseSelectorResponse("not json").reason, "malformed_json");
  assert.equal(parseSelectorResponse("{\"selected_theme_ids\":[]}").ok, true);
});

test("fake selector records retries, unknown cost, and calculated cost", async () => {
  const candidates = [{ id: "theme-a", canonical_zh: "甲", definition: "定义" }];
  const quote = { quote_id: "q1", text_zh: "一句" };
  const safety = createBudgetGuard({ maxRequests: 5 });
  const retried = await selectThemes({
    quote,
    candidates,
    config: { model_id: "fake-model", max_selected: 3, execution: { retry_limit: 1, timeout_ms: 1000 } },
    provider: createFakeSelector({
      failTimes: 1,
      respond: () => ({ response_text: "[]", usage: { input_tokens: null, output_tokens: null } }),
    }),
    safety,
    pricing: null,
  });
  assert.equal(retried.retries, 1);
  assert.equal(retried.validation_status, "invalid");
  assert.equal(retried.validation_reason, "malformed_json");
  assert.equal(safety.requestsStarted, 2);
  assert.equal(retried.cost.status, "unknown");

  const priced = await selectThemes({
    quote,
    candidates,
    config: { model_id: "fake-model", max_selected: 3, execution: { retry_limit: 0 } },
    provider: createFakeSelector({
      respond: () => ({
        selected_theme_ids: [],
        usage: { input_tokens: 1_000_000, output_tokens: 500_000, reasoning_tokens: 0, cached_tokens: 0 },
      }),
    }),
    safety: createBudgetGuard({ maxRequests: 2 }),
    pricing: {
      input_usd_per_million: 3,
      output_usd_per_million: 2,
      source: "unit-test",
      version: "t1",
    },
  });
  assert.equal(priced.validation_status, "valid");
  assert.deepEqual(priced.selected_theme_ids, []);
  assert.equal(priced.cost.status, "calculated");
  assert.equal(priced.cost.usd, 4);
  assert.equal(priced.cost.pricing_source, "unit-test");

  const missingPrice = calculateUsdCost({
    usage: { input_tokens: 10, output_tokens: 2, reasoning_tokens: 4 },
    pricing: { input_usd_per_million: 1, output_usd_per_million: 1, source: "partial" },
  });
  assert.equal(missingPrice.status, "unknown");
  assert.equal(missingPrice.reason, "reasoning_pricing_unavailable");
});

test("budget guard stops later quotes without another provider call", async () => {
  const calls = [];
  const provider = {
    provider_id: "fake",
    async complete() {
      calls.push("call");
      return {
        provider_id: "fake",
        model_id: "m",
        request_body: {},
        raw_response: {},
        response_text: JSON.stringify({ selected_theme_ids: [] }),
        usage: { input_tokens: 1_000_000, output_tokens: 0, reasoning_tokens: null, cached_tokens: null },
        local_runtime: null,
        http_status: 200,
      };
    },
  };
  const retrievalRun = {
    schema_version: "formal-study-run.v1",
    stage: "retrieval",
    run_id: "retrieval-fixture",
    results: ["q1", "q2"].map((quoteId) => ({
      quote_id: quoteId,
      text_zh: quoteId,
      expected_theme_ids: [],
      ranking: [{ rank: 1, tag_id: "theme-0039-时间", canonical_zh: "时间", representation_text: "时间", similarity: 0.1 }],
    })),
  };
  const dir = tempDir();
  try {
    const { writeFileSync } = await import("node:fs");
    const artifactPath = join(dir, "retrieval.json");
    writeFileSync(artifactPath, JSON.stringify(retrievalRun));
    const bench = {
      schema_version: "retrieval-benchmark.v1",
      benchmark_version: "temp-bench",
      quotes: [
        { quote_id: "q1", text_zh: "q1", expected_theme_ids: [], expected_theme_labels: [] },
        { quote_id: "q2", text_zh: "q2", expected_theme_ids: [], expected_theme_labels: [] },
      ],
    };
    const benchPath = join(dir, "bench.json");
    writeFileSync(benchPath, JSON.stringify(bench));
    const effective = {
      experiment_id: "budget-test",
      stage: "selection",
      provider: { id: "fake", model_id: "m" },
      model_id: "m",
      model_id_source: "test",
      ontology_path: FROZEN.ontology.path,
      expected_ontology_sha256: FROZEN.ontology.sha256,
      benchmark_path: benchPath,
      expected_benchmark_sha256: sha256File(benchPath),
      expected_quote_count: 2,
      retrieval_artifact_path: artifactPath,
      candidate_k: 1,
      max_selected: 3,
      include_aliases: false,
      execution: { max_requests: 5, max_estimated_budget_usd: 0.5, timeout_ms: 1000, retry_limit: 0 },
    };
    const safety = createBudgetGuard({ maxRequests: 5, maxEstimatedBudgetUsd: 0.5 });
    const { run } = await runSelectionStage({
      repoRoot,
      effectiveConfig: effective,
      effectiveConfigSha256: "abc",
      provider,
      pricing: { input_usd_per_million: 1, output_usd_per_million: 1, source: "unit-test", version: "t1" },
      safety,
      runId: "budget-test",
      git: { git_commit_sha: "abc", git_branch: "test", git_dirty: false },
    });
    assert.equal(calls.length, 1);
    assert.equal(run.status, "stopped_budget");
    assert.equal(run.results[1].validation_status, "not_run");
    assert.equal(run.cost_summary.total_usd_status, "calculated");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("paid-api is refused without opt-in and does not call fetch", async () => {
  let called = 0;
  await assert.rejects(
    () => executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "selector-openai.pilot.v1.json"),
      executionMode: "paid-api",
      allowPaidApi: false,
      env: { OPENAI_API_KEY: "sk-testsecretkeyvalue1234" },
      fetchImpl() {
        called += 1;
        throw new Error("should not fetch");
      },
    }),
    /allow-paid-api/,
  );
  assert.equal(called, 0);
  await assert.rejects(
    () => executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "selector-openai.pilot.v1.json"),
      executionMode: "local",
      allowPaidApi: true,
    }),
    /local mode cannot run provider openai/,
  );
});

test("provider adapters share one task and do not fall back", () => {
  const prompt = buildSelectorPrompt({
    quoteId: "q",
    textZh: "原文",
    candidates: [{ id: "theme-a", canonical_zh: "时间", definition: "定义" }],
  });
  const ids = ["theme-a"];
  const openai = buildOpenAIBody({ model: "operator-model", prompt, candidateIds: ids });
  const deepseek = buildDeepSeekBody({ model: "operator-model", prompt, candidateIds: ids });
  const gemini = buildGeminiBody({ prompt, candidateIds: ids });
  const ollama = buildOllamaBody({ model: "operator-model", prompt, candidateIds: ids });
  assert.equal(openai.messages[0].content, SELECTOR_TASK_INSTRUCTION);
  assert.equal(deepseek.messages[0].content, openai.messages[0].content);
  assert.equal(deepseek.messages[1].content, openai.messages[1].content);
  assert.equal(gemini.systemInstruction.parts[0].text, SELECTOR_TASK_INSTRUCTION);
  assert.equal(gemini.contents[0].parts[0].text, openai.messages[1].content);
  assert.equal(ollama.messages[1].content, openai.messages[1].content);
  assert.equal(openai.response_format.json_schema.schema.properties.selected_theme_ids.maxItems, 3);
  assert.throws(() => createSelectorProvider("anthropic"), /No fallback/);
});

test("gemini keeps the API key out of the URL and ollama records local runtime", async () => {
  let geminiUrl = "";
  const gemini = createGeminiSelector({
    env: { GEMINI_API_KEY: "AIzaSecretValue1234567890" },
    fetchImpl: async (url, init) => {
      geminiUrl = url;
      assert.equal(init.headers["x-goog-api-key"], "AIzaSecretValue1234567890");
      assert.equal(init.headers.authorization, undefined);
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            candidates: [{ content: { parts: [{ text: "{\"selected_theme_ids\":[]}" }] } }],
            usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1 },
          });
        },
      };
    },
  });
  const prompt = buildSelectorPrompt({
    quoteId: "q",
    textZh: "原文",
    candidates: [{ id: "theme-a", canonical_zh: "时间", definition: "定义" }],
  });
  const geminiResult = await gemini.complete({
    model: "operator-gemini",
    prompt,
    candidates: [{ id: "theme-a" }],
    timeoutMs: 1000,
  });
  assert.equal(geminiUrl.includes("AIza"), false);
  assert.equal(geminiResult.usage.input_tokens, 3);
  assert.equal(geminiResult.usage.reasoning_tokens, null);

  const ollama = createOllamaSelector({
    env: { OLLAMA_HOST: "http://127.0.0.1:9" },
    fetchImpl: async (url, init) => {
      if (url.endsWith("/api/show")) {
        return { ok: true, status: 200, async text() { return JSON.stringify({ details: { quantization_level: "Q4_K_M" } }); } };
      }
      if (url.endsWith("/api/ps")) {
        return { ok: true, async json() { return { models: [{ name: "operator-local", size_vram: 1234 }] }; } };
      }
      assert.equal(JSON.parse(init.body).messages[0].content, SELECTOR_TASK_INSTRUCTION);
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            model: "operator-local",
            message: { content: "{\"selected_theme_ids\":[]}" },
            prompt_eval_count: 8,
            eval_count: 2,
            eval_duration: 2e9,
            total_duration: 3e6,
          });
        },
      };
    },
  });
  await ollama.prepare({ model: "operator-local", timeoutMs: 1000 });
  const local = await ollama.complete({
    model: "operator-local",
    prompt,
    candidates: [{ id: "theme-a" }],
    timeoutMs: 1000,
  });
  assert.equal(local.local_runtime.quantization, "Q4_K_M");
  assert.equal(local.local_runtime.vram_bytes, 1234);
  assert.equal(local.local_runtime.tokens_per_second, 1);
  assert.equal(local.usage.input_tokens, 8);
});

test("secrets are redacted and latency modes stay separate", () => {
  const cleaned = redactDeep({
    authorization: "Bearer sk-testsecretkeyvalue1234",
    note: "failed sk-testsecretkeyvalue1234",
    nested: [{ api_key: "abc" }],
  });
  assert.equal(cleaned.authorization, undefined);
  assert.equal(cleaned.note.includes("sk-test"), false);
  assert.equal(cleaned.nested[0].api_key, undefined);
  assert.equal(redactSecrets("Bearer sk-testsecretkeyvalue1234").includes("sk-test"), false);
  const sequential = summarizeLatency([10, 20, 30, 40], { throughputMode: "sequential" });
  assert.equal(sequential.concurrent, null);
  assert.equal(sequential.sequential.p50_ms, percentile([10, 20, 30, 40], 50));
  const concurrent = summarizeLatency([5], { throughputMode: "concurrent" });
  assert.equal(concurrent.sequential, null);
  assert.equal(concurrent.concurrent.count, 1);
});

test("fake full-benchmark retrieval is reproducible and selector reads that artifact", async () => {
  const dir = tempDir();
  const seen = [];
  try {
    const first = await executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "P1-A-none.retrieval.v1.json"),
      executionMode: "local",
      runId: "fake-full-a",
      runsRoot: dir,
      cli: { provider: "fake" },
    });
    const second = await executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "P1-A-none.retrieval.v1.json"),
      executionMode: "local",
      runId: "fake-full-b",
      runsRoot: dir,
      cli: { provider: "fake" },
    });
    assert.equal(first.run.results.length, 58);
    assert.equal(first.run.active_theme_count, 185);
    assert.equal(first.run.benchmark_sha256, FROZEN.benchmark.sha256);
    assert.equal(first.run.ontology_sha256, FROZEN.ontology.sha256);
    assert.equal(first.run.effective_config.provider.id, "fake");
    assert.equal(first.run.effective_config.provenance.cli_overrides.provider_id, "fake");
    assert.equal(first.run.reranker, null);
    assert.equal(first.run.performance_metrics.concurrent, null);
    for (const row of first.run.results) {
      assert.equal(row.ranking.length, 185);
      assert.equal(row.effective_query_text, row.text_zh);
      assert.equal(row.ranking[0].representation_text, row.ranking[0].canonical_zh);
      const top5 = new Set(row.ranking.slice(0, 5).map((item) => item.tag_id));
      const top20 = new Set(row.ranking.slice(0, 20).map((item) => item.tag_id));
      for (const id of row.recall_at[5].hits) assert.ok(top5.has(id));
      for (const id of row.recall_at[20].hits) assert.ok(top20.has(id));
      if (row.zero_theme) {
        assert.equal(row.recall_at[5].evaluated, false);
        assert.equal(row.recall_at[5].recall, null);
      }
    }
    const signature = (run) => run.results.map((row) => row.ranking.map((item) => [item.tag_id, item.similarity]));
    assert.deepEqual(signature(first.run), signature(second.run));
    const snapshot = JSON.parse(readFileSync(join(dir, "fake-full-a", "config.snapshot.json"), "utf8"));
    assert.equal(snapshot.provider.id, "fake");
    assert.equal(snapshot.execution_mode, "local");
    await assert.rejects(
      () => executeFormalStudy({
        repoRoot,
        configPath: join(configDir, "P1-A-none.retrieval.v1.json"),
        executionMode: "local",
        runId: "fake-full-a",
        runsRoot: dir,
        cli: { provider: "fake" },
      }),
      /Refusing to overwrite/,
    );

    const runtimeProvider = createFakeEmbeddingProvider({ dimensions: 8 });
    const wrapped = {
      embed: runtimeProvider.embed,
      getMetadata: () => ({
        ...runtimeProvider.getMetadata(),
        builtin_query_prompt: "Instruct: RUNTIME PROMPT\nQuery:",
      }),
    };
    const prompted = await executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "P1-B-query.retrieval.v1.json"),
      executionMode: "local",
      runId: "fake-query-runtime",
      runsRoot: dir,
      providerFactory: () => wrapped,
    });
    assert.equal(prompted.run.results[0].effective_query_text.startsWith("Instruct: RUNTIME PROMPT\nQuery:"), true);
    assert.equal(prompted.run.results[0].builtin_query_prompt_matches_documented, false);
    assert.ok(prompted.run.results[0].ranking[0].representation_text.includes("："));

    const selected = await executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "selector-openai.pilot.v1.json"),
      executionMode: "paid-api",
      allowPaidApi: true,
      runId: "openai-pilot-fake-http",
      runsRoot: dir,
      env: {
        OPENAI_API_KEY: "sk-testsecretkeyvalue1234",
        PGWHITE_SELECTOR_MODEL: "operator-chosen-model",
      },
      cli: { retrieval_artifact: join(dir, "fake-full-a", "run.json") },
      fetchImpl: async (url, init) => {
        seen.push({ url, body: JSON.parse(init.body) });
        const candidateId = seen.at(-1).body.response_format.json_schema.schema.properties.selected_theme_ids.items.enum[0];
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              model: "operator-chosen-model",
              choices: [{ message: { content: JSON.stringify({ selected_theme_ids: [candidateId] }) } }],
              usage: { prompt_tokens: 100, completion_tokens: 10 },
            });
          },
        };
      },
    });
    assert.equal(seen.length, 10);
    assert.equal(seen[0].url, "https://api.openai.com/v1/chat/completions");
    assert.equal(seen[0].body.model, "operator-chosen-model");
    assert.equal(seen[0].body.messages[0].content, SELECTOR_TASK_INSTRUCTION);
    assert.equal(seen[0].body.messages[1].content.includes("aliases:"), false);
    assert.equal(selected.run.results.length, 10);
    assert.equal(selected.run.retrieval_artifact_sha256.length, 64);
    assert.equal(selected.run.benchmark_sha256, FROZEN.pilot.sha256);
    assert.equal(selected.run.results.every((row) => row.validation_status === "valid"), true);
    assert.equal(selected.run.cost_summary.total_usd_status, "unknown");
    const stored = readFileSync(join(dir, "openai-pilot-fake-http", "run.json"), "utf8");
    assert.equal(stored.includes("sk-testsecretkeyvalue1234"), false);
    assert.equal(stored.includes("authorization"), false);
    const names = readdirSync(join(dir, "openai-pilot-fake-http"));
    for (const name of ["manifest.json", "run.json", "summary.md", "environment.json", "config.snapshot.json"]) {
      assert.ok(names.includes(name));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("documented query prompt is stored when the runtime prompt is unavailable", async () => {
  const dir = tempDir();
  try {
    const run = await executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "P1-A-query.retrieval.v1.json"),
      executionMode: "local",
      runId: "fake-query-doc",
      runsRoot: dir,
      cli: { provider: "fake" },
    });
    const row = run.run.results[0];
    assert.equal(row.effective_prompt_prefix, QWEN_BUILTIN_QUERY_PROMPT);
    assert.equal(row.effective_query_text, `${QWEN_BUILTIN_QUERY_PROMPT}${row.text_zh}`);
    assert.equal(row.builtin_query_prompt_source, "documented_sentence_transformers_default");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
