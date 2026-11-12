import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const publicPath = join(repoRoot, "research/retrieval/formal-study/archives/EL-human-eval-five-model/public.json");
const privatePath = join(repoRoot, "research/retrieval/formal-study/archives/EL-human-eval-five-model/private-mapping.json");
const twoModelPublic = join(repoRoot, "research/retrieval/formal-study/archives/EL-human-eval/public.json");
const runIds = ["EL-P1-GPT5MINI", "EL-P1-GPT52", "EL-P1-DSFLASH", "EL-P1-DSPRO", "EL-P1-GPT6LUNA"];
const present = existsSync(publicPath) && existsSync(privatePath) && runIds.every((id) => (
  existsSync(join(repoRoot, `research/retrieval/formal-study/runs/${id}/run.json`))
));

test("five-model human-eval export is blinded and preserves Flash invalid output", { skip: !present }, () => {
  const publicExport = JSON.parse(readFileSync(publicPath, "utf8"));
  const privateMapping = JSON.parse(readFileSync(privatePath, "utf8"));
  const runs = Object.fromEntries(runIds.map((id) => [
    id,
    JSON.parse(readFileSync(join(repoRoot, `research/retrieval/formal-study/runs/${id}/run.json`), "utf8")),
  ]));
  assert.equal(publicExport.sample_count, 50);
  assert.equal(privateMapping.sample_count, 50);
  assert.equal(privateMapping.seed, 20261021);
  const publicText = JSON.stringify(publicExport);
  assert.equal(/gpt-5|gpt-6|openai|deepseek|EL-P1-/i.test(publicText), false);
  assert.equal(publicText.includes("expected_theme"), false);
  assert.equal(Object.hasOwn(publicExport, "run_id"), false);

  const quoteIds = new Set();
  const modelIds = new Set();
  for (const sample of publicExport.samples) {
    const map = privateMapping.mapping.find((row) => row.sample_id === sample.sample_id);
    assert.ok(map, sample.sample_id);
    const run = runs[map.run_id];
    const row = run.results.find((item) => item.quote_id === map.quote_id);
    assert.equal(sample.text_zh, row.text_zh);
    assert.equal(sample.selection_status, row.validation_status);
    assert.deepEqual(map.selected_theme_ids, row.selected_theme_ids);
    quoteIds.add(map.quote_id);
    modelIds.add(map.model_id);
  }
  assert.equal(quoteIds.size, 10);
  assert.equal(modelIds.size, 5);
  assert.equal(modelIds.has("gpt-6-luna"), true);
  assert.equal(modelIds.has("deepseek-flash"), true);

  const invalidMaps = privateMapping.mapping.filter((row) => row.quote_id === "batch1-calib-027" && row.run_id === "EL-P1-DSFLASH");
  assert.equal(invalidMaps.length, 1);
  assert.equal(invalidMaps[0].validation_status, "invalid");
  assert.equal(invalidMaps[0].validation_reason, "id_not_in_candidates");
  assert.deepEqual(invalidMaps[0].invented_theme_ids, ["theme-0124", "theme-0114"]);
  const invalidPublic = publicExport.samples.find((row) => row.sample_id === invalidMaps[0].sample_id);
  assert.equal(invalidPublic.selection_status, "invalid");
  assert.equal(invalidPublic.validation_reason, "id_not_in_candidates");
  assert.deepEqual(invalidPublic.selected_themes.map((theme) => theme.label), ["theme-0124", "theme-0114"]);

  if (existsSync(twoModelPublic)) {
    const two = JSON.parse(readFileSync(twoModelPublic, "utf8"));
    assert.equal(two.sample_count, 20);
  }
});
