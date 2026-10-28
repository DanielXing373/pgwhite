import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FROZEN } from "../formal-study/runner/src/freeze.mjs";
import { assertParticipantSafe } from "../formal-study/el2/human-study/src/dataset.mjs";
import {
  EXPECTED_ELIGIBLE_QUOTE_IDS,
  screenAllQuotes,
} from "../formal-study/el2/human-study/src/eligibility.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const hs = join(repoRoot, "research/retrieval/formal-study/el2/human-study");

function readJson(rel) {
  return JSON.parse(readFileSync(join(repoRoot, rel), "utf8"));
}

function shaOf(rel) {
  return createHash("sha256").update(readFileSync(join(repoRoot, rel))).digest("hex");
}

const ontology = readJson(FROZEN.ontology.path);
const goldDoc = readJson("research/retrieval/formal-study/el2/baselines/human-gold.v1.json");
const embedDoc = readJson("research/retrieval/formal-study/el2/baselines/embedding-top2.v1.json");
const lunaRun = readJson("research/retrieval/formal-study/runs/EL2-GPT6LUNA/run.json");
const flashRun = readJson("research/retrieval/formal-study/runs/EL2-DSFLASH/run.json");

test("recomputed eligibility is exactly the 20 expected quote IDs", () => {
  const screen = screenAllQuotes({ ontology, goldDoc, embedDoc, lunaRun, flashRun });
  assert.equal(screen.quote_count, 58);
  assert.equal(screen.eligible_count, 20);
  assert.deepEqual(screen.eligible_ids, [...EXPECTED_ELIGIBLE_QUOTE_IDS]);
  assert.equal(screen.expected_set_match, true);
});

test("each eligible quote has four valid pairwise-distinct Theme sets and frozen text", () => {
  const screen = screenAllQuotes({ ontology, goldDoc, embedDoc, lunaRun, flashRun });
  const goldBy = new Map(goldDoc.quotes.map((q) => [q.quote_id, q]));
  const master = readJson("research/retrieval/formal-study/el2/human-study/datasets/el2-hs-questions.internal.v1.json");
  const publicDoc = readJson("research/retrieval/formal-study/el2/human-study/datasets/el2-hs-questions.participant-content.v1.json");
  assert.equal(master.quotes.length, 20);
  assert.equal(publicDoc.quotes.length, 20);
  for (const id of EXPECTED_ELIGIBLE_QUOTE_IDS) {
    const row = screen.rows.find((r) => r.quote_id === id);
    assert.equal(row.eligible, true);
    assert.equal(row.colliding_pairs.length, 0);
    for (const source of ["human-gold", "embedding-top2", "gpt-6-luna", "deepseek-flash"]) {
      assert.equal(row.sources[source].valid, true);
    }
    const mq = master.quotes.find((q) => q.quote_id === id);
    const gold = goldBy.get(id);
    assert.equal(mq.text_zh, gold.text_zh);
    assert.deepEqual(mq.sources["human-gold"].selected_theme_ids, gold.selected_theme_ids);
    const luna = lunaRun.results.find((r) => r.quote_id === id);
    const flash = flashRun.results.find((r) => r.quote_id === id);
    assert.deepEqual(mq.sources["gpt-6-luna"].selected_theme_ids, luna.selected_theme_ids);
    assert.deepEqual(mq.sources["deepseek-flash"].selected_theme_ids, flash.selected_theme_ids);
    for (const theme of Object.values(mq.sources).flatMap((s) => s.themes)) {
      const ont = ontology.themes.find((t) => t.id === theme.theme_id);
      assert.equal(theme.label_zh, ont.canonical_zh);
      assert.equal(theme.definition_zh, ont.definition);
    }
  }
  const publicBy = new Map(publicDoc.quotes.map((q) => [q.quote_id, q]));
  for (const mq of master.quotes) {
    assert.equal(publicBy.get(mq.quote_id).text_zh, mq.text_zh);
  }
});

test("participant-safe projection omits source mapping keys", () => {
  const publicDoc = readJson("research/retrieval/formal-study/el2/human-study/datasets/el2-hs-questions.participant-content.v1.json");
  assertParticipantSafe(publicDoc, "participant-content");
});

test("dataset manifest hashes match files on disk", () => {
  const manifest = readJson("research/retrieval/formal-study/el2/human-study/DATASET-MANIFEST.json");
  assert.equal(manifest.freeze_status, "frozen");
  assert.deepEqual(manifest.unresolved_quote_ids, []);
  for (const file of manifest.files) {
    assert.equal(shaOf(file.path), file.sha256);
  }
});

test("attribution is complete for all 20 quotes after human adjudication", () => {
  const report = readJson("research/retrieval/formal-study/el2/human-study/ATTRIBUTION-REPORT.json");
  assert.equal(report.verified_count, 20);
  assert.equal(report.public_release_ready, true);
  assert.equal(report.quotes.length, 20);
  const byId = new Map(report.quotes.map((q) => [q.quote_id, q]));
  assert.equal(byId.get("batch2-batch2-004").book_title_zh, "索拉里斯星（译林幻系列）");
  assert.equal(byId.get("batch2-batch2-007").book_title_zh, "索拉里斯星（译林幻系列）");
  assert.equal(byId.get("batch2-batch2-013").book_title_zh, "荒原狼（果麦经典）");
  assert.equal(byId.get("batch2-batch2-004").verification_status, "human_adjudicated");
  assert.equal(byId.get("batch2-batch2-007").verification_status, "human_adjudicated");
  assert.equal(byId.get("batch2-batch2-013").verification_status, "human_adjudicated");
});

test("EL2 research tables are isolated in migration 0007", () => {
  const sql = readFileSync(join(repoRoot, "database/migrations/0007_el2_human_study.sql"), "utf8");
  assert.match(sql, /el2_hs_session/);
  assert.equal(/DROP TABLE\s+quotes/i.test(sql), false);
  assert.equal(/ALTER TABLE quotes/i.test(sql), false);
  const older = [
    "database/migrations/0001_baseline_current_schema.sql",
    "database/migrations/0006_canonical_matching_and_personal_layer.sql",
  ];
  for (const rel of older) {
    assert.equal(readFileSync(join(repoRoot, rel), "utf8").includes("el2_hs_session"), false);
  }
});
