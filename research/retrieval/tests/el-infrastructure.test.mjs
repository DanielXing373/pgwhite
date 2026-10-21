import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { archiveFormalRun, validateArchive } from "../formal-study/runner/src/archive.mjs";
import { calculateUsdCost } from "../formal-study/runner/src/cost.mjs";
import { executeFormalStudy } from "../formal-study/runner/src/execute.mjs";
import { FROZEN, PHASE2_RETRIEVAL } from "../formal-study/runner/src/freeze.mjs";
import { buildBlindedHumanEval } from "../formal-study/runner/src/humanEval.mjs";
import { scoreSelectionQuote } from "../formal-study/runner/src/selectionMetrics.mjs";
import { buildOpenAIBody, buildSelectorPrompt } from "../formal-study/runner/src/selector/instruction.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const configDir = join(repoRoot, "research/retrieval/formal-study/configs");
const cTaskArtifact = join(repoRoot, PHASE2_RETRIEVAL.path);

function tempDir() {
  return mkdtempSync(join(tmpdir(), "pgwhite-el-"));
}

test("EL configs share frozen inputs and differ only in model settings", () => {
  const mini = JSON.parse(readFileSync(join(configDir, "EL-P1-GPT5MINI.selection.v1.json"), "utf8"));
  const full = JSON.parse(readFileSync(join(configDir, "EL-P1-GPT52.selection.v1.json"), "utf8"));
  const miniSmoke = JSON.parse(readFileSync(join(configDir, "EL-P1-GPT5MINI.smoke.v1.json"), "utf8"));
  const fullSmoke = JSON.parse(readFileSync(join(configDir, "EL-P1-GPT52.smoke.v1.json"), "utf8"));
  for (const config of [mini, full, miniSmoke, fullSmoke]) {
    assert.equal(config.experiment_batch, "EL");
    assert.equal(config.expected_benchmark_sha256, FROZEN.pilot.sha256);
    assert.equal(config.expected_ontology_sha256, FROZEN.ontology.sha256);
    assert.equal(config.retrieval_artifact_path, PHASE2_RETRIEVAL.path);
    assert.equal(config.required_retrieval.artifact_sha256, PHASE2_RETRIEVAL.artifact_sha256);
    assert.equal(config.required_retrieval.effective_config_sha256, PHASE2_RETRIEVAL.effective_config_sha256);
    assert.equal(config.candidate_k, 20);
    assert.equal(config.max_selected, 3);
    assert.equal(config.include_aliases, false);
    assert.equal(config.openai_request.omit_temperature, true);
    assert.equal(config.execution.max_estimated_budget_usd, 1);
  }
  assert.equal(mini.expected_quote_count, 10);
  assert.equal(full.expected_quote_count, 10);
  assert.equal(mini.quote_ids, undefined);
  assert.equal(miniSmoke.expected_source_quote_count, 10);
  assert.equal(miniSmoke.expected_quote_count, 1);
  assert.deepEqual(miniSmoke.quote_ids, ["batch1-calib-005"]);
  assert.equal(mini.provider.model_id, "gpt-5-mini-2025-08-07");
  assert.equal(full.provider.model_id, "gpt-5.2-2025-12-11");
  assert.equal(mini.openai_request.reasoning_effort, "low");
  assert.equal(full.openai_request.reasoning_effort, "none");
  assert.equal(miniSmoke.comparison_set, null);
  assert.equal(fullSmoke.smoke_test, true);
});

test("pricing catalog has verified OpenAI EL rates and GPT-5 reasoning is billed as output", () => {
  const catalog = JSON.parse(
    readFileSync(join(repoRoot, "research/retrieval/formal-study/pricing/pricing-catalog.v1.json"), "utf8"),
  );
  const mini = catalog.rates.find((row) => row.model_id === "gpt-5-mini-2025-08-07");
  const full = catalog.rates.find((row) => row.model_id === "gpt-5.2-2025-12-11");
  assert.equal(mini.input_usd_per_million, 0.25);
  assert.equal(mini.cached_input_usd_per_million, 0.025);
  assert.equal(mini.output_usd_per_million, 2);
  assert.equal(full.input_usd_per_million, 1.75);
  assert.equal(full.output_usd_per_million, 14);
  assert.equal(mini.reasoning_billed_as, "output");
  const cost = calculateUsdCost({
    usage: { input_tokens: 1_000_000, output_tokens: 1_000_000, reasoning_tokens: 400_000, cached_tokens: 0 },
    pricing: mini,
  });
  assert.equal(cost.status, "calculated");
  assert.equal(cost.usd, 2.25);
  assert.equal(cost.components.reasoning_usd, 0);
});

test("GPT-5 OpenAI bodies omit temperature and can set reasoning_effort", () => {
  const prompt = buildSelectorPrompt({
    quoteId: "q",
    textZh: "原文",
    candidates: [{ id: "theme-a", canonical_zh: "时间", definition: "定义" }],
  });
  const defaultBody = buildOpenAIBody({ model: "operator-model", prompt, candidateIds: ["theme-a"] });
  assert.equal(defaultBody.temperature, 0);
  const elBody = buildOpenAIBody({
    model: "gpt-5-mini-2025-08-07",
    prompt,
    candidateIds: ["theme-a"],
    omitTemperature: true,
    reasoningEffort: "low",
  });
  assert.equal(elBody.temperature, undefined);
  assert.equal(elBody.reasoning_effort, "low");
  assert.equal(elBody.response_format.json_schema.schema.properties.selected_theme_ids.maxItems, 3);
});

test("error attribution separates retrieval miss from selector miss without changing F1", () => {
  const scored = scoreSelectionQuote({
    expectedIds: ["gold-in", "gold-out"],
    selectedIds: ["gold-in", "fp"],
    validationStatus: "valid",
    candidateIds: ["gold-in", "fp", "other"],
  });
  assert.deepEqual(scored.retrieval_miss_ids, ["gold-out"]);
  assert.deepEqual(scored.selector_miss_ids, []);
  assert.deepEqual(scored.false_positive_ids, ["fp"]);
  assert.equal(scored.tp, 1);
  assert.equal(scored.fp, 1);
  assert.equal(scored.fn, 1);
});

test("EL registry is planned until a run exists", () => {
  const registry = JSON.parse(
    readFileSync(join(repoRoot, "research/retrieval/formal-study/el/registry.json"), "utf8"),
  );
  assert.equal(registry.experiment_batch, "EL");
  assert.equal(registry.experiments.every((row) => row.evaluation_status === "planned"), true);
  assert.equal(registry.experiments.every((row) => row.run_id == null), true);
});

test("archives copy without mutating the run and refuse overwrite", () => {
  const dir = tempDir();
  try {
    const runDir = join(dir, "run");
    mkdirSync(runDir);
    writeFileSync(join(runDir, "run.json"), `${JSON.stringify({ run_id: "EL-P1-GPT5MINI", status: "completed" })}\n`);
    const archiveDir = join(dir, "archive");
    const first = archiveFormalRun({
      runDir,
      archiveDir,
      experimentId: "EL-P1-GPT5MINI",
    });
    writeFileSync(join(runDir, "run.json"), `${JSON.stringify({ run_id: "EL-P1-GPT5MINI", status: "tampered" })}\n`);
    const archived = JSON.parse(readFileSync(join(archiveDir, "run", "run.json"), "utf8"));
    assert.equal(archived.status, "completed");
    assert.equal(validateArchive(archiveDir).ok, true);
    assert.equal(first.validated.ok, true);
    assert.throws(
      () => archiveFormalRun({ runDir, archiveDir, experimentId: "EL-P1-GPT5MINI" }),
      /Refusing to overwrite/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("blinded human eval uses model predictions and keeps identity private", () => {
  const fixture = (modelId, selected) => ({
    run_id: `run-${modelId}`,
    experiment_id: "EL-P1-TEST",
    selector_provider: { provider_id: "openai", model_id: modelId },
    results: [
      {
        quote_id: "batch1-calib-005",
        text_zh: "柳比歇夫的时间酷似物质。",
        validation_status: "valid",
        selected_theme_ids: selected,
        expected_theme_ids: ["theme-0039-时间"],
        candidates: [
          { id: "theme-0039-时间", canonical_zh: "时间", definition: "时间的流逝或度量" },
        ],
      },
    ],
  });
  const { publicExport, privateMapping } = buildBlindedHumanEval({
    runs: [fixture("gpt-5-mini-2025-08-07", ["theme-0039-时间"]), fixture("gpt-5.2-2025-12-11", [])],
    seed: 20261021,
  });
  assert.equal(publicExport.sample_count, 2);
  assert.equal(publicExport.samples.every((sample) => sample.text_zh.includes("柳比歇夫")), true);
  const publicText = JSON.stringify(publicExport);
  assert.equal(publicText.includes("gpt-5"), false);
  assert.equal(publicText.includes("openai"), false);
  assert.equal(publicText.includes("run-"), false);
  assert.equal(publicText.includes("expected_theme"), false);
  assert.equal(publicText.includes("theme-0039"), false);
  const labels = publicExport.samples.flatMap((sample) => sample.selected_themes.map((theme) => theme.label));
  assert.ok(labels.includes("时间"));
  assert.equal(privateMapping.seed, 20261021);
  assert.equal(privateMapping.mapping.length, 2);
  assert.ok(privateMapping.mapping.some((row) => row.model_id === "gpt-5.2-2025-12-11"));
});

test("EL dry-run does not call fetch", async () => {
  let called = 0;
  const plan = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "EL-P1-GPT5MINI.selection.v1.json"),
    executionMode: "dry-run",
    fetchImpl() {
      called += 1;
      throw new Error("must not fetch");
    },
  });
  assert.equal(plan.plan.calls_provider, false);
  assert.equal(plan.plan.experiment_id, "EL-P1-GPT5MINI");
  assert.equal(called, 0);
});

test("EL smoke config requests one frozen quote without changing the 10-quote file", { skip: !existsSync(cTaskArtifact) }, async () => {
  const dir = tempDir();
  const seen = [];
  try {
    const result = await executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "EL-P1-GPT5MINI.smoke.v1.json"),
      executionMode: "paid-api",
      allowPaidApi: true,
      runId: "EL-P1-GPT5MINI-SMOKE-fixture",
      runsRoot: dir,
      env: { OPENAI_API_KEY: "sk-testsecretkeyvalue1234" },
      fetchImpl: async (url, init) => {
        const body = JSON.parse(init.body);
        seen.push(body);
        const candidateId = body.response_format.json_schema.schema.properties.selected_theme_ids.items.enum[0];
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              model: "gpt-5-mini-2025-08-07",
              choices: [{ message: { content: JSON.stringify({ selected_theme_ids: [candidateId] }) } }],
              usage: {
                prompt_tokens: 100,
                completion_tokens: 20,
                completion_tokens_details: { reasoning_tokens: 8 },
                prompt_tokens_details: { cached_tokens: 0 },
              },
            });
          },
        };
      },
    });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].model, "gpt-5-mini-2025-08-07");
    assert.equal(seen[0].temperature, undefined);
    assert.equal(seen[0].reasoning_effort, "low");
    assert.equal(result.run.results.length, 1);
    assert.equal(result.run.results[0].quote_id, "batch1-calib-005");
    assert.equal(result.run.source_quote_count, 10);
    assert.equal(result.run.benchmark_sha256, FROZEN.pilot.sha256);
    assert.equal(result.run.cost_summary.total_usd_status, "calculated");
    assert.equal(result.run.experiment_id, "EL-P1-GPT5MINI-SMOKE");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
