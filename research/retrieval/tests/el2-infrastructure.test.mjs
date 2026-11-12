import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectSourceCollisions, EL2_PILOT_QUOTE_IDS } from "../formal-study/el2/src/baselines.mjs";
import { planPreferenceDisplayOrder, sampleQuotesForParticipant } from "../formal-study/el2/src/preferencePrep.mjs";
import { executeFormalStudy } from "../formal-study/runner/src/execute.mjs";
import { FROZEN, PHASE2_RETRIEVAL } from "../formal-study/runner/src/freeze.mjs";
import { validateSelection } from "../formal-study/runner/src/selector/validate.mjs";
import {
  buildOpenAIBody,
  buildSelectorPrompt,
  EL2_PROMPT_VERSION,
  SELECTOR_TASK_INSTRUCTION,
  SELECTOR_TASK_INSTRUCTION_EL2,
} from "../formal-study/runner/src/selector/instruction.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const configDir = join(repoRoot, "research/retrieval/formal-study/configs");
const el2Dir = join(repoRoot, "research/retrieval/formal-study/el2");
const cTaskArtifact = join(repoRoot, PHASE2_RETRIEVAL.path);

function tempDir() {
  return mkdtempSync(join(tmpdir(), "pgwhite-el2-"));
}

test("EL2 configs lock the 58-quote freeze and max_selected 2", () => {
  const luna = JSON.parse(readFileSync(join(configDir, "EL2-GPT6LUNA.selection.v1.json"), "utf8"));
  const flash = JSON.parse(readFileSync(join(configDir, "EL2-DSFLASH.selection.v1.json"), "utf8"));
  const embed = JSON.parse(readFileSync(join(configDir, "EL2-EMBED-TOP2.selection.v1.json"), "utf8"));
  const lunaSmoke = JSON.parse(readFileSync(join(configDir, "EL2-GPT6LUNA.smoke.v1.json"), "utf8"));
  const flashSmoke = JSON.parse(readFileSync(join(configDir, "EL2-DSFLASH.smoke.v1.json"), "utf8"));
  const all = [luna, flash, embed, lunaSmoke, flashSmoke];
  for (const config of all) {
    assert.equal(config.experiment_batch, "EL2");
    assert.equal(config.expected_ontology_sha256, FROZEN.ontology.sha256);
    assert.equal(config.retrieval_artifact_path, PHASE2_RETRIEVAL.path);
    assert.equal(config.required_retrieval.artifact_sha256, PHASE2_RETRIEVAL.artifact_sha256);
    assert.equal(config.max_selected, 2);
    assert.equal(config.candidate_k, 20);
    assert.equal(config.prompt_version, EL2_PROMPT_VERSION);
    assert.equal(config.selector_task_instruction, SELECTOR_TASK_INSTRUCTION_EL2);
  }
  assert.equal(luna.expected_benchmark_sha256, FROZEN.benchmark.sha256);
  assert.equal(luna.expected_quote_count, 58);
  assert.equal(embed.provider.id, "embedding-top2");
  assert.equal(luna.provider.model_id, "gpt-6-luna");
  assert.equal(flash.provider.model_id, "deepseek-flash");
  assert.equal(luna.execution.max_requests, 58);
  assert.equal(lunaSmoke.execution.max_requests, 1);
  assert.deepEqual(lunaSmoke.quote_ids, ["batch1-calib-005"]);
  assert.equal(lunaSmoke.expected_source_quote_count, 58);
});

test("EL2 prompt is distinct from EL1 and json_schema maxItems is 2", () => {
  assert.notEqual(SELECTOR_TASK_INSTRUCTION_EL2, SELECTOR_TASK_INSTRUCTION);
  assert.match(SELECTOR_TASK_INSTRUCTION_EL2, /at most 2/);
  assert.match(SELECTOR_TASK_INSTRUCTION_EL2, /most to least important/);
  const prompt = buildSelectorPrompt({
    quoteId: "q",
    textZh: "原文",
    candidates: [{ id: "theme-a", canonical_zh: "时间", definition: "定义" }],
    maxSelected: 2,
    taskInstruction: SELECTOR_TASK_INSTRUCTION_EL2,
  });
  assert.equal(prompt.task_instruction, SELECTOR_TASK_INSTRUCTION_EL2);
  assert.match(prompt.user_text, /most to least important/);
  const body = buildOpenAIBody({
    model: "gpt-6-luna",
    prompt,
    candidateIds: ["theme-a", "theme-b"],
    omitTemperature: true,
    reasoningEffort: "none",
    maxSelected: 2,
  });
  assert.equal(body.response_format.json_schema.schema.properties.selected_theme_ids.maxItems, 2);
  assert.equal(body.temperature, undefined);
});

test("EL2 validation preserves order and rejects more than two or invented IDs", () => {
  const allowed = ["theme-a", "theme-b", "theme-c"];
  assert.deepEqual(
    validateSelection(["theme-c", "theme-a"], allowed, { maxSelected: 2 }).selected_theme_ids,
    ["theme-c", "theme-a"],
  );
  assert.equal(validateSelection([], allowed, { maxSelected: 2 }).status, "valid");
  assert.equal(validateSelection(["theme-a", "theme-b", "theme-c"], allowed, { maxSelected: 2 }).reason, "too_many");
  assert.equal(validateSelection(["theme-a", "theme-a"], allowed, { maxSelected: 2 }).reason, "duplicate");
  assert.equal(validateSelection(["theme-z"], allowed, { maxSelected: 2 }).reason, "id_not_in_candidates");
  assert.equal(validateSelection("nope", allowed, { maxSelected: 2 }).reason, "not_array");
});

test("EL2 baselines reproduce Gold order and Embedding Top2 from frozen retrieval", () => {
  const gold = JSON.parse(readFileSync(join(el2Dir, "baselines/human-gold.v1.json"), "utf8"));
  const embed = JSON.parse(readFileSync(join(el2Dir, "baselines/embedding-top2.v1.json"), "utf8"));
  const coverage = JSON.parse(readFileSync(join(el2Dir, "baselines/coverage.v1.json"), "utf8"));
  const bench = JSON.parse(readFileSync(join(repoRoot, FROZEN.benchmark.path), "utf8"));
  const retr = JSON.parse(readFileSync(cTaskArtifact, "utf8"));
  assert.equal(gold.quotes.length, 58);
  assert.equal(embed.quotes.length, 58);
  assert.deepEqual(coverage.missing_retrieval_quote_ids, []);
  assert.equal(coverage.gold_distribution.by_theme_count["0"], 3);
  assert.equal(coverage.gold_distribution.by_theme_count["5"], 3);
  const retrById = new Map(retr.results.map((row) => [row.quote_id, row]));
  for (const quote of bench.quotes) {
    const goldRow = gold.quotes.find((row) => row.quote_id === quote.quote_id);
    assert.deepEqual(goldRow.selected_theme_ids, quote.expected_theme_ids);
    assert.equal(goldRow.theme_count, quote.expected_theme_ids.length);
    assert.equal(goldRow.el1_pilot, EL2_PILOT_QUOTE_IDS.includes(quote.quote_id));
    const embedRow = embed.quotes.find((row) => row.quote_id === quote.quote_id);
    const top2 = retrById.get(quote.quote_id).ranking.slice(0, 2).map((item) => item.tag_id);
    assert.deepEqual(embedRow.selected_theme_ids, top2);
    assert.equal(embedRow.theme_count, 2);
  }
  assert.equal(gold.quotes.filter((row) => row.el1_pilot).length, 10);
});

test("EL2 preference planner blinds source order without equalizing Theme counts", () => {
  const gold = JSON.parse(readFileSync(join(el2Dir, "baselines/human-gold.v1.json"), "utf8"));
  const quoteIds = gold.quotes.map((row) => row.quote_id);
  const plan = planPreferenceDisplayOrder({ quoteIds, seed: 20261022 });
  assert.equal(plan.length, 58);
  assert.equal(plan.every((row) => new Set(row.display_order).size === 4), true);
  assert.equal(plan.some((row) => row.display_order[0] !== "human-gold"), true);
  const sample = sampleQuotesForParticipant({ quoteIds, seed: 20261022, participantIndex: 0, count: 12 });
  assert.equal(sample.length, 12);
  assert.equal(new Set(sample).size, 12);
});

test("EL2 dry-run does not call fetch", async () => {
  let called = 0;
  const fetchImpl = () => {
    called += 1;
    throw new Error("must not fetch");
  };
  const luna = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "EL2-GPT6LUNA.selection.v1.json"),
    executionMode: "dry-run",
    fetchImpl,
  });
  const flash = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "EL2-DSFLASH.selection.v1.json"),
    executionMode: "dry-run",
    fetchImpl,
  });
  const embed = await executeFormalStudy({
    repoRoot,
    configPath: join(configDir, "EL2-EMBED-TOP2.selection.v1.json"),
    executionMode: "dry-run",
    fetchImpl,
  });
  assert.equal(luna.plan.calls_provider, false);
  assert.equal(luna.plan.experiment_id, "EL2-GPT6LUNA");
  assert.equal(luna.plan.quote_count, 58);
  assert.equal(luna.plan.effective_config.max_selected, 2);
  assert.deepEqual(luna.plan.blockers, []);
  assert.equal(flash.plan.provider_id, "deepseek");
  assert.equal(embed.plan.provider_id, "embedding-top2");
  assert.equal(called, 0);
});

test("EL2 embedding-top2 local run matches frozen Top2 and does not call APIs", { skip: !existsSync(cTaskArtifact) }, async () => {
  const dir = tempDir();
  let called = 0;
  try {
    const result = await executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "EL2-EMBED-TOP2.selection.v1.json"),
      executionMode: "local",
      runId: "EL2-EMBED-TOP2-fixture",
      runsRoot: dir,
      fetchImpl: async () => {
        called += 1;
        throw new Error("must not fetch");
      },
    });
    const embed = JSON.parse(readFileSync(join(el2Dir, "baselines/embedding-top2.v1.json"), "utf8"));
    assert.equal(result.run.results.length, 58);
    assert.equal(result.run.max_selected, 2);
    assert.equal(result.run.selector_provider.prompt_version, EL2_PROMPT_VERSION);
    for (const row of result.run.results) {
      assert.equal(row.validation_status, "valid");
      assert.equal(row.selected_theme_ids.length, 2);
      const expected = embed.quotes.find((item) => item.quote_id === row.quote_id);
      assert.deepEqual(row.selected_theme_ids, expected.selected_theme_ids);
    }
    assert.equal(called, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EL2 Luna smoke fake-provider preserves 0-2 order and records EL2 prompt", { skip: !existsSync(cTaskArtifact) }, async () => {
  const dir = tempDir();
  const seen = [];
  try {
    const result = await executeFormalStudy({
      repoRoot,
      configPath: join(configDir, "EL2-GPT6LUNA.smoke.v1.json"),
      executionMode: "paid-api",
      allowPaidApi: true,
      runId: "EL2-GPT6LUNA-SMOKE-fixture",
      runsRoot: dir,
      env: { OPENAI_API_KEY: "sk-testsecretkeyvalue1234" },
      fetchImpl: async (url, init) => {
        const body = JSON.parse(init.body);
        seen.push(body);
        const enumIds = body.response_format.json_schema.schema.properties.selected_theme_ids.items.enum;
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              model: "gpt-6-luna",
              system_fingerprint: "fp-el2",
              choices: [{ message: { content: JSON.stringify({ selected_theme_ids: [enumIds[1], enumIds[0]] }) } }],
              usage: { prompt_tokens: 80, completion_tokens: 12, completion_tokens_details: { reasoning_tokens: 0 } },
            });
          },
        };
      },
    });
    assert.equal(seen[0].model, "gpt-6-luna");
    assert.equal(seen[0].reasoning_effort, "none");
    assert.equal(seen[0].response_format.json_schema.schema.properties.selected_theme_ids.maxItems, 2);
    assert.equal(seen[0].messages[0].content, SELECTOR_TASK_INSTRUCTION_EL2);
    assert.equal(result.run.results[0].quote_id, "batch1-calib-005");
    assert.equal(result.run.source_quote_count, 58);
    assert.equal(result.run.results[0].selected_theme_ids.length, 2);
    assert.equal(result.run.results[0].selected_theme_ids[0] !== result.run.results[0].selected_theme_ids[1], true);
    assert.equal(result.run.cost_summary.total_usd_status, "calculated");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EL2 collision helper reports identical ordered Theme sets", () => {
  const collisions = detectSourceCollisions({
    q1: { "human-gold": ["a", "b"], "embedding-top2": ["a", "b"] },
    q2: { "human-gold": ["a"], "embedding-top2": ["b", "a"] },
  });
  assert.equal(collisions.some((row) => row.quote_id === "q1" && row.identical_ordered), true);
  assert.equal(collisions.some((row) => row.quote_id === "q2"), false);
});

test("EL1 configs still require max_selected 3", () => {
  const mini = JSON.parse(readFileSync(join(configDir, "EL-P1-GPT5MINI.selection.v1.json"), "utf8"));
  assert.equal(mini.max_selected, 3);
  assert.equal(mini.experiment_batch, "EL");
});
