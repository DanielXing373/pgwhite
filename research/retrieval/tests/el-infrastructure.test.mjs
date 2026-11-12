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
import { collectBlockers } from "../formal-study/runner/src/safety.mjs";
import { scoreSelectionQuote } from "../formal-study/runner/src/selectionMetrics.mjs";
import { buildDeepSeekBody, buildOpenAIBody, buildSelectorPrompt } from "../formal-study/runner/src/selector/instruction.mjs";

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
  const flash = JSON.parse(readFileSync(join(configDir, "EL-P1-DSFLASH.selection.v1.json"), "utf8"));
  const pro = JSON.parse(readFileSync(join(configDir, "EL-P1-DSPRO.selection.v1.json"), "utf8"));
  const flashSmoke = JSON.parse(readFileSync(join(configDir, "EL-P1-DSFLASH.smoke.v1.json"), "utf8"));
  const proSmoke = JSON.parse(readFileSync(join(configDir, "EL-P1-DSPRO.smoke.v1.json"), "utf8"));
  const luna = JSON.parse(readFileSync(join(configDir, "EL-P1-GPT6LUNA.selection.v1.json"), "utf8"));
  const lunaSmoke = JSON.parse(readFileSync(join(configDir, "EL-P1-GPT6LUNA.smoke.v1.json"), "utf8"));
  const all = [mini, full, miniSmoke, fullSmoke, flash, pro, flashSmoke, proSmoke, luna, lunaSmoke];
  for (const config of all) {
    assert.equal(config.experiment_batch, "EL");
    assert.equal(config.expected_benchmark_sha256, FROZEN.pilot.sha256);
    assert.equal(config.expected_ontology_sha256, FROZEN.ontology.sha256);
    assert.equal(config.retrieval_artifact_path, PHASE2_RETRIEVAL.path);
    assert.equal(config.required_retrieval.artifact_sha256, PHASE2_RETRIEVAL.artifact_sha256);
    assert.equal(config.required_retrieval.effective_config_sha256, PHASE2_RETRIEVAL.effective_config_sha256);
    assert.equal(config.candidate_k, 20);
    assert.equal(config.max_selected, 3);
    assert.equal(config.include_aliases, false);
    assert.equal(config.execution.max_estimated_budget_usd, 1);
  }
  for (const config of [mini, full, miniSmoke, fullSmoke, luna, lunaSmoke]) {
    assert.equal(config.openai_request.omit_temperature, true);
    assert.equal(config.provider.id, "openai");
  }
  for (const config of [flash, pro, flashSmoke, proSmoke]) {
    assert.equal(config.provider.id, "deepseek");
    assert.equal(config.deepseek_request.thinking.type, "disabled");
    assert.equal(config.deepseek_request.reasoning_effort, "none");
    assert.equal(config.deepseek_request.max_tokens, 512);
    assert.equal(config.deepseek_request.response_format, "json_object");
    assert.equal(config.deepseek_request.schema_enforcement, "local_validateSelection");
  }
  assert.equal(mini.expected_quote_count, 10);
  assert.equal(full.expected_quote_count, 10);
  assert.equal(flash.expected_quote_count, 10);
  assert.equal(pro.expected_quote_count, 10);
  assert.equal(luna.expected_quote_count, 10);
  assert.equal(mini.quote_ids, undefined);
  assert.equal(miniSmoke.expected_source_quote_count, 10);
  assert.equal(miniSmoke.expected_quote_count, 1);
  assert.deepEqual(miniSmoke.quote_ids, ["batch1-calib-005"]);
  assert.deepEqual(flashSmoke.quote_ids, ["batch1-calib-005"]);
  assert.deepEqual(lunaSmoke.quote_ids, ["batch1-calib-005"]);
  assert.equal(mini.provider.model_id, "gpt-5-mini-2025-08-07");
  assert.equal(full.provider.model_id, "gpt-5.2-2025-12-11");
  assert.equal(luna.provider.model_id, "gpt-6-luna");
  assert.equal(lunaSmoke.provider.model_id, "gpt-6-luna");
  assert.equal(flash.provider.model_id, "deepseek-flash");
  assert.equal(pro.provider.model_id, "deepseek-v4-pro");
  assert.equal(mini.openai_request.reasoning_effort, "low");
  assert.equal(full.openai_request.reasoning_effort, "none");
  assert.equal(luna.openai_request.reasoning_effort, "none");
  assert.equal(lunaSmoke.openai_request.reasoning_effort, "none");
  assert.equal(mini.execution.max_requests, 10);
  assert.equal(flash.execution.max_requests, 10);
  assert.equal(luna.execution.max_requests, 10);
  assert.equal(miniSmoke.execution.max_requests, 1);
  assert.equal(flashSmoke.execution.max_requests, 1);
  assert.equal(lunaSmoke.execution.max_requests, 1);
  assert.equal(miniSmoke.comparison_set, null);
  assert.equal(fullSmoke.smoke_test, true);
  assert.equal(flashSmoke.smoke_test, true);
  assert.equal(lunaSmoke.smoke_test, true);
  assert.equal(proSmoke.comparison_set, null);
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
  const luna = catalog.rates.find((row) => row.model_id === "gpt-6-luna");
  assert.equal(luna.input_usd_per_million, 0.10);
  assert.equal(luna.cached_input_usd_per_million, 0.01);
  assert.equal(luna.output_usd_per_million, 0.50);
  assert.equal(luna.reasoning_billed_as, "output");
  assert.equal(luna.billing_window, "flat");
  const flash = catalog.rates.find((row) => row.model_id === "deepseek-flash");
  const pro = catalog.rates.find((row) => row.model_id === "deepseek-v4-pro");
  assert.equal(flash.provider, "deepseek");
  assert.equal(flash.billing_window, "peak");
  assert.equal(flash.input_usd_per_million, 0.30);
  assert.equal(flash.cached_input_usd_per_million, 0.006);
  assert.equal(flash.output_usd_per_million, 1.20);
  assert.equal(pro.input_usd_per_million, 1.32);
  assert.equal(pro.output_usd_per_million, 3.96);
  assert.equal(pro.reasoning_billed_as, "output");
  const cost = calculateUsdCost({
    usage: { input_tokens: 1_000_000, output_tokens: 1_000_000, reasoning_tokens: 400_000, cached_tokens: 0 },
    pricing: mini,
  });
  assert.equal(cost.status, "calculated");
  assert.equal(cost.usd, 2.25);
  assert.equal(cost.components.reasoning_usd, 0);
  assert.equal(cost.estimate_kind, "catalog_token_estimate");
  assert.equal(cost.invoice_status, "not_provider_confirmed");
  const flashCost = calculateUsdCost({
    usage: { input_tokens: 1_000_000, output_tokens: 1_000_000, reasoning_tokens: 50_000, cached_tokens: 0 },
    pricing: flash,
  });
  assert.equal(flashCost.usd, 1.5);
  assert.equal(flashCost.billing_window, "peak");
  assert.equal(flashCost.components.reasoning_usd, 0);
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
  assert.equal(elBody.thinking, undefined);
});

test("DeepSeek EL bodies disable thinking and do not send json_schema", () => {
  const prompt = buildSelectorPrompt({
    quoteId: "q",
    textZh: "原文",
    candidates: [{ id: "theme-a", canonical_zh: "时间", definition: "定义" }],
  });
  const body = buildDeepSeekBody({
    model: "deepseek-flash",
    prompt,
    candidateIds: ["theme-a"],
    deepseekRequest: {
      thinking: { type: "disabled" },
      reasoning_effort: "none",
      max_tokens: 512,
      temperature: 0,
    },
  });
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.equal(body.reasoning_effort, "none");
  assert.equal(body.max_tokens, 512);
  assert.equal(body.temperature, 0);
  assert.equal(body.response_format.type, "json_object");
  assert.equal(body.response_format.json_schema, undefined);
});

test("DeepSeek thinking-on configs are blocked before a request", () => {
  const blockers = collectBlockers(
    {
      stage: "selection",
      provider: { id: "deepseek", model_id: "deepseek-flash" },
      model_id: "deepseek-flash",
      retrieval_artifact_path: "x",
      execution: { max_requests: 1, max_estimated_budget_usd: 1 },
      deepseek_request: { thinking: { type: "enabled" } },
    },
    { artifactExists: true, pricingRate: { input_usd_per_million: 0.3 } },
  );
  assert.equal(blockers.some((row) => /thinking must be disabled/i.test(row)), true);
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

test("EL registry marks only completed Pilot-10 runs completed", () => {
  const registry = JSON.parse(
    readFileSync(join(repoRoot, "research/retrieval/formal-study/el/registry.json"), "utf8"),
  );
  assert.equal(registry.experiment_batch, "EL");
  const byId = Object.fromEntries(registry.experiments.map((row) => [row.experiment_id, row]));
  assert.equal(byId["EL-P1-GPT5MINI"].evaluation_status, "completed");
  assert.equal(byId["EL-P1-GPT52"].evaluation_status, "completed");
  assert.equal(byId["EL-P1-GPT5MINI"].run_id, "EL-P1-GPT5MINI");
  assert.equal(byId["EL-P1-GPT52"].run_id, "EL-P1-GPT52");
  assert.equal(byId["EL-P1-GPT5MINI-SMOKE"].comparison_set ?? null, null);
  assert.equal(byId["EL-P1-DSFLASH"].evaluation_status, "completed");
  assert.equal(byId["EL-P1-DSPRO"].evaluation_status, "completed");
  assert.equal(byId["EL-P1-DSFLASH"].run_id, "EL-P1-DSFLASH");
  assert.equal(byId["EL-P1-DSPRO"].run_id, "EL-P1-DSPRO");
  assert.equal(byId["EL-P1-GPT5MINI"].run_json_sha256, "7d1ab53a40e3848c97902df5450aa8e33175b4890cc1cf03e3c3aa7ec2e38630");
  assert.equal(byId["EL-P1-GPT52"].run_json_sha256, "020b2604aa06e722ea75ff0ec6c53689475d09ea70cb4e3630942ccfaf742d14");
  assert.equal(byId["EL-P1-DSPRO-SMOKE"].comparison_set ?? null, null);
  assert.equal(byId["EL-P1-GPT6LUNA"].evaluation_status, "completed");
  assert.equal(byId["EL-P1-GPT6LUNA"].run_id, "EL-P1-GPT6LUNA");
  assert.equal(byId["EL-P1-GPT6LUNA"].provider, "openai");
  assert.equal(byId["EL-P1-GPT6LUNA"].model_id, "gpt-6-luna");
  assert.equal(byId["EL-P1-GPT6LUNA"].run_json_sha256, "04391ab7b03e2337555b67da114b25f535f1d4d36c22ef531bb077b1c04d53db");
  assert.equal(byId["EL-P1-GPT6LUNA-SMOKE"].evaluation_status, "prepared_smoke");
  assert.equal(byId["EL-P1-GPT6LUNA-SMOKE"].comparison_set ?? null, null);
  assert.equal(registry.human_evaluation.planned_unified_pack.status, "exported_not_scored");
  assert.equal(registry.human_evaluation.sample_count, 20);
  assert.ok(Array.isArray(registry.smoke_history));
  assert.equal(
    registry.smoke_history.every((row) => row.comparison_set !== "EL-Pilot"),
    true,
  );
});

test("archive secret scan allows retrieval run ids and rejects API-key shaped tokens", () => {
  const dir = tempDir();
  try {
    const runDir = join(dir, "run");
    mkdirSync(runDir);
    writeFileSync(
      join(runDir, "config.snapshot.json"),
      `${JSON.stringify({
        retrieval_artifact_path: "research/retrieval/formal-study/runs/formal-p1-c-task-20261021/run.json",
        required_retrieval: { run_id: "formal-p1-c-task-20261021" },
      })}\n`,
    );
    const okDir = join(dir, "ok-archive");
    const ok = archiveFormalRun({
      runDir,
      archiveDir: okDir,
      experimentId: "EL-P1-GPT5MINI",
    });
    assert.equal(ok.validated.ok, true);
    writeFileSync(
      join(runDir, "config.snapshot.json"),
      `${JSON.stringify({ note: "Incorrect API key provided: sk-abcdefghijklmnopqrstuvwxyz" })}\n`,
    );
    assert.throws(
      () => archiveFormalRun({
        runDir,
        archiveDir: join(dir, "blocked-archive"),
        experimentId: "EL-P1-GPT5MINI",
      }),
      /looks like it contains a secret/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  const fetchImpl = () => {
    called += 1;
    throw new Error("must not fetch");
  };
  const mini = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "EL-P1-GPT5MINI.selection.v1.json"),
    executionMode: "dry-run",
    fetchImpl,
  });
  const flash = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "EL-P1-DSFLASH.selection.v1.json"),
    executionMode: "dry-run",
    fetchImpl,
  });
  const pro = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "EL-P1-DSPRO.selection.v1.json"),
    executionMode: "dry-run",
    fetchImpl,
  });
  assert.equal(mini.plan.calls_provider, false);
  assert.equal(mini.plan.experiment_id, "EL-P1-GPT5MINI");
  assert.equal(flash.plan.calls_provider, false);
  assert.equal(flash.plan.experiment_id, "EL-P1-DSFLASH");
  assert.equal(flash.plan.provider_id, "deepseek");
  assert.equal(pro.plan.experiment_id, "EL-P1-DSPRO");
  const luna = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "EL-P1-GPT6LUNA.selection.v1.json"),
    executionMode: "dry-run",
    fetchImpl,
  });
  assert.equal(luna.plan.calls_provider, false);
  assert.equal(luna.plan.experiment_id, "EL-P1-GPT6LUNA");
  assert.equal(luna.plan.provider_id, "openai");
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
    assert.equal(result.run.selector_provider.thinking, undefined);
    assert.equal(seen[0].thinking, undefined);
    assert.equal(seen[0].response_format.type, "json_schema");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EL GPT-6 Luna smoke config pins gpt-6-luna with reasoning none and json_schema", { skip: !existsSync(cTaskArtifact) }, async () => {
  const dir = tempDir();
  const seen = [];
  try {
    const result = await executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "EL-P1-GPT6LUNA.smoke.v1.json"),
      executionMode: "paid-api",
      allowPaidApi: true,
      runId: "EL-P1-GPT6LUNA-SMOKE-fixture",
      runsRoot: dir,
      env: { OPENAI_API_KEY: "sk-testsecretkeyvalue1234" },
      fetchImpl: async (url, init) => {
        assert.match(String(url), /api\.openai\.com\/v1\/chat\/completions/);
        const body = JSON.parse(init.body);
        seen.push(body);
        const candidateId = body.response_format.json_schema.schema.properties.selected_theme_ids.items.enum[0];
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              model: "gpt-6-luna",
              system_fingerprint: "fp-test-luna",
              choices: [{ message: { content: JSON.stringify({ selected_theme_ids: [candidateId] }) } }],
              usage: {
                prompt_tokens: 100,
                completion_tokens: 20,
                completion_tokens_details: { reasoning_tokens: 0 },
                prompt_tokens_details: { cached_tokens: 0 },
              },
            });
          },
        };
      },
    });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].model, "gpt-6-luna");
    assert.equal(seen[0].temperature, undefined);
    assert.equal(seen[0].reasoning_effort, "none");
    assert.equal(seen[0].response_format.type, "json_schema");
    assert.equal(seen[0].thinking, undefined);
    assert.equal(result.run.results.length, 1);
    assert.equal(result.run.results[0].quote_id, "batch1-calib-005");
    assert.equal(result.run.source_quote_count, 10);
    assert.equal(result.run.benchmark_sha256, FROZEN.pilot.sha256);
    assert.equal(result.run.cost_summary.total_usd_status, "calculated");
    assert.equal(result.run.experiment_id, "EL-P1-GPT6LUNA-SMOKE");
    assert.equal(result.run.selector_provider.model_id, "gpt-6-luna");
    assert.equal(result.run.results[0].system_fingerprint, "fp-test-luna");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EL DeepSeek smoke config sends thinking disabled over json_object", { skip: !existsSync(cTaskArtifact) }, async () => {
  const dir = tempDir();
  const seen = [];
  try {
    const result = await executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "EL-P1-DSFLASH.smoke.v1.json"),
      executionMode: "paid-api",
      allowPaidApi: true,
      runId: "EL-P1-DSFLASH-SMOKE-fixture",
      runsRoot: dir,
      env: { DEEPSEEK_API_KEY: "sk-testsecretkeyvalue1234" },
      fetchImpl: async (url, init) => {
        assert.equal(String(url).includes("api.deepseek.com/chat/completions"), true);
        assert.match(init.headers.authorization, /^Bearer /);
        const body = JSON.parse(init.body);
        seen.push(body);
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              model: "deepseek-flash",
              system_fingerprint: "fp-test-deepseek",
              choices: [{ message: { content: JSON.stringify({ selected_theme_ids: [] }) } }],
              usage: {
                prompt_tokens: 100,
                completion_tokens: 20,
                completion_tokens_details: { reasoning_tokens: 0 },
                prompt_cache_hit_tokens: 0,
              },
            });
          },
        };
      },
    });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].model, "deepseek-flash");
    assert.deepEqual(seen[0].thinking, { type: "disabled" });
    assert.equal(seen[0].reasoning_effort, "none");
    assert.equal(seen[0].max_tokens, 512);
    assert.equal(seen[0].temperature, 0);
    assert.equal(seen[0].response_format.type, "json_object");
    assert.equal(seen[0].response_format.json_schema, undefined);
    assert.equal(result.run.results.length, 1);
    assert.equal(result.run.results[0].quote_id, "batch1-calib-005");
    assert.equal(result.run.results[0].system_fingerprint, "fp-test-deepseek");
    assert.equal(result.run.results[0].request_body.thinking.type, "disabled");
    assert.equal(result.run.selector_provider.thinking.type, "disabled");
    assert.equal(result.run.selector_provider.schema_enforcement, "local_validateSelection");
    assert.equal(result.run.source_quote_count, 10);
    assert.equal(result.run.benchmark_sha256, FROZEN.pilot.sha256);
    assert.equal(result.run.cost_summary.total_usd_status, "calculated");
    assert.equal(result.run.results[0].cost.estimate_kind, "catalog_token_estimate");
    assert.equal(result.run.results[0].cost.invoice_status, "not_provider_confirmed");
    assert.equal(result.run.results[0].cost.billing_window, "peak");
    assert.equal(result.run.experiment_id, "EL-P1-DSFLASH-SMOKE");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
