import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadTagLibrary,
  selectActiveThemes,
  assertTagShape,
} from "../runner/src/tagLibrary.mjs";
import {
  representationA,
  representationB,
  representationC,
  buildRepresentationText,
} from "../runner/src/representations.mjs";
import { findDeterministicHits } from "../runner/src/deterministicMatch.mjs";
import { createFakeEmbeddingProvider } from "../runner/src/providers/fake.mjs";
import { createQwen3EmbeddingProviderStub } from "../runner/src/providers/interface.mjs";
import { cosineSimilarity, rankByCosine, takeTopK } from "../runner/src/rank.mjs";
import { recallAtK, aggregateRecalls } from "../runner/src/evaluate.mjs";
import { loadBenchmark, resolveExpectedThemeIds } from "../runner/src/benchmark.mjs";
import {
  assertRunNotCompleted,
  resolveRunDir,
  writeRunArtifacts,
} from "../runner/src/runArtifact.mjs";
import { runRetrievalBenchmark, loadConfig } from "../runner/src/pipeline.mjs";

const repoRoot = resolveRepoRoot();
function resolveRepoRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "../../..");
}

const LIB_PATH = "research/tag-library/data/library/atomic-tag-library.v1.json";

test("loads 1.41 tag library and filters active Themes only", () => {
  const loaded = loadTagLibrary(repoRoot, LIB_PATH);
  assert.equal(loaded.library_version, "atomic-tag-library.v1.41");
  const themes = selectActiveThemes(loaded.library);
  assert.equal(themes.length, 217);
  assert.ok(themes.every((t) => t.dimension === "theme"));
  assert.ok(themes.every((t) => t.status === "active_candidate"));
  assert.ok(!themes.some((t) => t.canonical_zh === "时间"));
  // Devices excluded from Theme retrieval set
  assert.ok(!themes.some((t) => t.canonical_zh === "隐喻"));
  const memory = themes.find((t) => t.canonical_zh === "记忆");
  assert.ok(memory);
  assert.ok(memory.id);
  assert.ok(Array.isArray(memory.aliases));
  assert.ok(Array.isArray(memory.related));
  assert.ok(Array.isArray(memory.provenance));
});

test("malformed tag fails loudly", () => {
  assert.throws(
    () =>
      assertTagShape({
        id: "x",
        canonical_zh: "记忆",
        dimension: "theme",
        definition: "ok",
        aliases: [],
        related: [],
        // missing provenance/status
      }),
    /provenance|status/,
  );
});

test("Representation A/B/C match 1.41 semantics", () => {
  const tag = {
    canonical_zh: "记忆",
    definition: "记住与回想的心智领地。",
    aliases: ["回忆", "记忆"],
    related: ["遗忘", "童年"],
  };
  assert.equal(representationA(tag.canonical_zh), "记忆");
  assert.equal(
    representationB(tag.canonical_zh, tag.definition),
    "记忆：记住与回想的心智领地。",
  );
  const c = representationC(tag.canonical_zh, tag.definition, tag.aliases);
  assert.equal(c, "记忆：记住与回想的心智领地。｜别名：回忆");
  assert.ok(!c.includes("遗忘"));
  assert.ok(!c.includes("童年"));
  assert.ok(!representationB(tag.canonical_zh, tag.definition).includes("回忆"));
  assert.equal(buildRepresentationText(tag, "A"), "记忆");
  assert.throws(() => buildRepresentationText(tag, "D"));
});

test("deterministic canonical and alias hits are separate from scores", () => {
  const themes = [
    {
      id: "theme-悲伤",
      canonical_zh: "悲伤",
      aliases: ["伤心", "难过"],
    },
    {
      id: "theme-记忆",
      canonical_zh: "记忆",
      aliases: ["回忆"],
    },
  ];
  const hits = findDeterministicHits("伤心的回忆", themes);
  assert.ok(
    hits.some(
      (h) =>
        h.canonical_zh === "悲伤" &&
        h.match_type === "alias" &&
        h.matched_surface === "伤心",
    ),
  );
  assert.ok(
    hits.some(
      (h) =>
        h.canonical_zh === "记忆" &&
        h.match_type === "alias" &&
        h.matched_surface === "回忆",
    ),
  );
  assert.ok(!hits.some((h) => h.similarity != null));
  assert.equal(
    Object.prototype.hasOwnProperty.call(hits[0], "similarity"),
    false,
  );
});

test("fake embedding provider is deterministic", async () => {
  const p = createFakeEmbeddingProvider({ dimensions: 16 });
  const a = await p.embed(["记忆", "悲伤"]);
  const b = await p.embed(["记忆", "悲伤"]);
  assert.deepEqual(a, b);
  assert.equal(a[0].length, 16);
  assert.notDeepEqual(a[0], a[1]);
});

test("qwen stub fails loudly without implementing model download", async () => {
  const p = createQwen3EmbeddingProviderStub();
  assert.equal(p.getMetadata().provider_id, "qwen3-embedding");
  await assert.rejects(() => p.embed(["x"]), /not implemented/i);
});

test("cosine ranking Top-K ordering is deterministic", () => {
  const query = [1, 0, 0];
  const library = [
    { id: "b", canonical_zh: "B", vector: [0.2, 0.8, 0] },
    { id: "a", canonical_zh: "A", vector: [1, 0, 0] },
    { id: "c", canonical_zh: "C", vector: [0.9, 0.1, 0] },
  ];
  const ranked = rankByCosine(query, library);
  assert.equal(ranked[0].tag_id, "a");
  assert.equal(ranked[0].rank, 1);
  assert.ok(ranked[0].similarity >= ranked[1].similarity);
  assert.deepEqual(
    takeTopK(ranked, 2).map((r) => r.tag_id),
    ["a", "c"],
  );
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
});

test("Recall@5/10/20 calculation", () => {
  const ranked = [
    { rank: 1, tag_id: "t1", canonical_zh: "一", similarity: 0.9 },
    { rank: 2, tag_id: "t2", canonical_zh: "二", similarity: 0.8 },
    { rank: 3, tag_id: "t3", canonical_zh: "三", similarity: 0.7 },
    { rank: 6, tag_id: "t6", canonical_zh: "六", similarity: 0.4 },
    { rank: 15, tag_id: "t15", canonical_zh: "十五", similarity: 0.2 },
  ];
  // pad to make ranks coherent for slice-based recall
  const full = [];
  for (let i = 1; i <= 20; i++) {
    const existing = ranked.find((r) => r.rank === i);
    full.push(
      existing || {
        rank: i,
        tag_id: `pad-${i}`,
        canonical_zh: `p${i}`,
        similarity: 0,
      },
    );
  }
  const expected = ["t1", "t6", "t15"];
  const r5 = recallAtK(expected, full, 5);
  assert.equal(r5.hit_count, 1);
  assert.equal(r5.recall, 1 / 3);
  const r10 = recallAtK(expected, full, 10);
  assert.equal(r10.hit_count, 2);
  const r20 = recallAtK(expected, full, 20);
  assert.equal(r20.hit_count, 3);
  assert.equal(r20.recall, 1);

  const empty = recallAtK([], full, 5);
  assert.equal(empty.evaluated, false);

  const agg = aggregateRecalls([
    { recall_at: { 5: r5, 10: r10, 20: r20 } },
    { recall_at: { 5: empty } },
  ]);
  assert.equal(agg.evaluated_quotes, 1);
  assert.equal(agg.skipped_empty_expected, 1);
  assert.equal(agg.mean_recall_at_5, 1 / 3);
});

test("benchmark loader + expected label resolution", () => {
  const bench = loadBenchmark(
    repoRoot,
    "research/retrieval/benchmark/fixtures/synthetic-smoke.v1.json",
  );
  assert.equal(bench.data.benchmark_version, "synthetic-smoke.v1");
  const themes = selectActiveThemes(loadTagLibrary(repoRoot, LIB_PATH).library);
  const q = bench.data.quotes[0];
  const ids = resolveExpectedThemeIds(q, themes);
  assert.ok(ids.length >= 3);
  assert.throws(
    () =>
      resolveExpectedThemeIds(
        { quote_id: "x", expected_theme_labels: ["不存在的标签XYZ"] },
        themes,
      ),
    /not in active Themes/,
  );
});

test("malformed benchmark fails loudly", () => {
  const dir = mkdtempSync(join(tmpdir(), "pgwhite-bench-"));
  const bad = join(dir, "bad.json");
  writeFileSync(bad, JSON.stringify({ schema_version: "nope", quotes: [] }));
  assert.throws(() => loadBenchmark(dir, bad), /schema_version|quotes/);
  rmSync(dir, { recursive: true, force: true });
});

test("completed run overwrite protection", () => {
  const dir = mkdtempSync(join(tmpdir(), "pgwhite-run-"));
  const runDir = join(dir, "runs", "demo");
  mkdirSync(runDir, { recursive: true });
  writeRunArtifacts(runDir, {
    manifest: { completed: true, run_id: "demo" },
    run: { run_id: "demo", results: [] },
    summaryMarkdown: "# demo\n",
    analysisStub: { quotes: [] },
  });
  assert.throws(() => assertRunNotCompleted(runDir), /Refusing to overwrite/);
  assertRunNotCompleted(runDir, { allowOverwrite: true });
  rmSync(dir, { recursive: true, force: true });
});

test("config serialization fields exist", () => {
  const { config } = loadConfig(
    repoRoot,
    "research/retrieval/config/default.retrieval.v1.json",
  );
  assert.equal(config.schema_version, "retrieval-config.v1");
  assert.equal(config.dimension, "theme");
  assert.deepEqual(config.ranking.top_k_report, [5, 10, 20]);
  assert.equal(config.overwrite_completed_runs, false);
});

test("end-to-end fake pipeline dry metrics", async () => {
  const { config } = loadConfig(
    repoRoot,
    "research/retrieval/config/default.retrieval.v1.json",
  );
  const { run, manifest } = await runRetrievalBenchmark({
    repoRoot,
    config,
    representation: "A",
    runId: "test-e2e-fake-A",
  });
  assert.equal(run.active_theme_count, 217);
  assert.equal(run.representation, "A");
  assert.equal(run.embedding_provider.provider_id, "fake");
  assert.ok(run.results.length >= 3);
  const q1 = run.results.find((r) => r.quote_id === "synth-001");
  assert.ok(q1.deterministic_hits.some((h) => h.match_type === "alias"));
  assert.ok(q1.semantic_ranking.top_5);
  assert.ok(q1.semantic_ranking.top_20);
  assert.equal(typeof q1.recall_at[5].recall, "number");
  // deterministic hits remain separate object; ranking scores are only under semantic_ranking
  assert.ok(!("similarity" in (q1.deterministic_hits[0] || {})));
  assert.equal(manifest.completed, true);
  assert.equal(manifest.representation, "A");
});

test("run id validation", () => {
  assert.throws(() => resolveRunDir(repoRoot, "research/retrieval/runs", "../x"));
  assert.ok(
    resolveRunDir(repoRoot, "research/retrieval/runs", "ok-run_1").includes(
      "ok-run_1",
    ),
  );
});
