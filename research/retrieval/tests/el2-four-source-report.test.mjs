import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const htmlPath = join(repoRoot, "research/retrieval/formal-study/el2/EL2-Four-Source-Theme-Report.html");
const goldPath = join(repoRoot, "research/retrieval/formal-study/el2/baselines/human-gold.v1.json");

test("EL2 four-source HTML lists 58 quotes and four sources without review widgets", () => {
  const html = readFileSync(htmlPath, "utf8");
  const gold = JSON.parse(readFileSync(goldPath, "utf8"));
  assert.equal(gold.quotes.length, 58);
  assert.match(html, /人工 Gold/);
  assert.match(html, /Embedding Top2/);
  assert.match(html, /GPT-6 Luna/);
  assert.match(html, /DeepSeek Flash/);
  assert.equal(html.includes("导出审阅"), false);
  assert.equal(html.includes('type="radio"'), false);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
  for (const quote of gold.quotes) {
    assert.equal(html.includes(esc(quote.text_zh)), true);
    assert.equal(html.includes(quote.quote_id), true);
  }
  assert.match(html, /id_not_in_candidates/);
  assert.match(html, /theme-0198/);
});
