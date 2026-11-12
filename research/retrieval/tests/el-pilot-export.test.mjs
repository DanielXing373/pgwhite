import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const publicPath = join(repoRoot, "research/retrieval/formal-study/archives/EL-human-eval/public.json");
const privatePath = join(repoRoot, "research/retrieval/formal-study/archives/EL-human-eval/private-mapping.json");
const miniPath = join(repoRoot, "research/retrieval/formal-study/runs/EL-P1-GPT5MINI/run.json");
const fullPath = join(repoRoot, "research/retrieval/formal-study/runs/EL-P1-GPT52/run.json");
const present = existsSync(publicPath) && existsSync(privatePath) && existsSync(miniPath) && existsSync(fullPath);

test("EL human-eval export has 20 blinded samples mapped to original predictions", { skip: !present }, () => {
  const publicExport = JSON.parse(readFileSync(publicPath, "utf8"));
  const privateMapping = JSON.parse(readFileSync(privatePath, "utf8"));
  const mini = JSON.parse(readFileSync(miniPath, "utf8"));
  const full = JSON.parse(readFileSync(fullPath, "utf8"));
  const runs = { [mini.run_id]: mini, [full.run_id]: full };
  assert.equal(publicExport.sample_count, 20);
  assert.equal(publicExport.samples.length, 20);
  assert.equal(privateMapping.sample_count, 20);
  assert.equal(privateMapping.mapping.length, 20);
  assert.equal(privateMapping.seed, 20261021);

  const publicText = JSON.stringify(publicExport);
  assert.equal(/gpt-5|openai|EL-P1-GPT/i.test(publicText), false);
  assert.equal(publicText.includes("expected_theme"), false);
  assert.equal(publicText.includes("theme-"), false);
  assert.equal(Object.hasOwn(publicExport, "run_id"), false);

  const quoteIds = new Set();
  const zeroThemeQuotes = ["batch1-calib-008", "batch2-batch2-001"];
  for (const sample of publicExport.samples) {
    const map = privateMapping.mapping.find((row) => row.sample_id === sample.sample_id);
    assert.ok(map, sample.sample_id);
    const run = runs[map.run_id];
    const row = run.results.find((item) => item.quote_id === map.quote_id);
    assert.equal(sample.text_zh, row.text_zh);
    assert.equal(sample.selection_status, row.validation_status);
    assert.deepEqual(map.selected_theme_ids, row.selected_theme_ids);
    const labels = (row.selected_theme_ids ?? []).map((id) => {
      const candidate = row.candidates.find((item) => item.id === id);
      return candidate.canonical_zh;
    });
    assert.deepEqual(sample.selected_themes.map((theme) => theme.label), labels);
    quoteIds.add(map.quote_id);
  }
  assert.equal(quoteIds.size, 10);
  for (const quoteId of zeroThemeQuotes) {
    const maps = privateMapping.mapping.filter((row) => row.quote_id === quoteId);
    assert.equal(maps.length, 2);
    for (const map of maps) {
      const row = runs[map.run_id].results.find((item) => item.quote_id === quoteId);
      assert.deepEqual(map.selected_theme_ids, row.selected_theme_ids);
      assert.notEqual(map.selected_theme_ids.length, 0);
    }
  }
});
