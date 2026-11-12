import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FROZEN, PHASE2_RETRIEVAL } from "../formal-study/runner/src/freeze.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const htmlPath = join(repoRoot, "research/retrieval/formal-study/el/EL-Four-Model-Theme-Visual-Report.html");
const runsRoot = join(repoRoot, "research/retrieval/formal-study/runs");

const RUNS = ["EL-P1-GPT5MINI", "EL-P1-GPT52", "EL-P1-DSFLASH", "EL-P1-DSPRO"];

test("four-model HTML report embeds all frozen quotes and four model outputs", () => {
  const html = readFileSync(htmlPath, "utf8");
  assert.equal(/https?:\/\/|cdn\.|unpkg|jsdelivr|googleapis/i.test(html.replace(/https:\/\/api-docs\.deepseek\.com[^\s<"]*/g, "")), false);
  const jsonText = html.match(/<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/)[1];
  const data = JSON.parse(jsonText);
  assert.equal(data.quotes.length, 10);
  assert.equal(data.exploratory, true);
  assert.equal(data.freeze.ontology_sha256, FROZEN.ontology.sha256);
  assert.equal(data.freeze.pilot_sha256, FROZEN.pilot.sha256);
  assert.equal(data.freeze.retrieval_run_id, PHASE2_RETRIEVAL.run_id);
  assert.equal(data.models.map((row) => row.run_id).join(","), RUNS.join(","));

  const mini = JSON.parse(readFileSync(join(runsRoot, "EL-P1-GPT5MINI/run.json"), "utf8"));
  const flash = JSON.parse(readFileSync(join(runsRoot, "EL-P1-DSFLASH/run.json"), "utf8"));
  assert.deepEqual(data.quotes.map((row) => row.quote_id), mini.results.map((row) => row.quote_id));
  for (const quote of data.quotes) {
    assert.ok(quote.text_zh && quote.text_zh.length > 8);
    assert.equal(quote.top20.length, 20);
    for (const key of ["mini", "gpt52", "flash", "pro"]) {
      assert.ok(quote.models[key]);
      assert.ok(quote.models[key].validation_status);
    }
    const archived = mini.results.find((row) => row.quote_id === quote.quote_id);
    assert.equal(quote.text_zh, archived.text_zh);
    assert.deepEqual(quote.gold.map((row) => row.id), archived.expected_theme_ids);
  }
  const invalid = data.quotes.find((row) => row.quote_id === "batch1-calib-027");
  assert.equal(invalid.models.flash.validation_status, "invalid");
  assert.equal(invalid.models.flash.validation_reason, flash.results.find((row) => row.quote_id === "batch1-calib-027").validation_reason);
  assert.deepEqual(invalid.models.flash.invented_theme_ids, ["theme-0124", "theme-0114"]);
  assert.equal(invalid.models.pro.validation_status, "valid");
  assert.match(html, /合理/);
  assert.match(html, /不合理/);
  assert.match(html, /导出审阅 JSON/);
  for (const quote of mini.results) {
    assert.equal(html.includes(quote.text_zh), true);
  }
  const hypocrisy = invalid.gold.find((row) => row.id === "theme-0026-虚伪");
  assert.equal(hypocrisy.label, "虚伪");
  assert.equal(hypocrisy.definition, "表里不一或假装道德。");
  assert.equal(hypocrisy.in_top20, false);
});
