import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateCalibrationBenchmark,
  assertCalibrationValid,
} from "../runner/src/validateCalibration.mjs";
import { loadBenchmark } from "../runner/src/benchmark.mjs";
import { loadTagLibrary, selectActiveThemes } from "../runner/src/tagLibrary.mjs";
import { runRetrievalBenchmark } from "../runner/src/pipeline.mjs";
import { createFakeEmbeddingProvider } from "../runner/src/providers/fake.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const CALIB_PATH =
  "research/retrieval/benchmark/fixtures/calib-zh-themes.v1.json";
const LIB_PATH =
  "research/tag-library/data/library/atomic-tag-library.v1.json";

function writeTempBenchmark(obj) {
  const dir = mkdtempSync(join(tmpdir(), "pgwhite-calib-"));
  const path = join(dir, "bench.json");
  writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
  return { dir, path };
}

test("draft calibration scaffold validates with warning and empty quotes", () => {
  const result = validateCalibrationBenchmark({
    repoRoot,
    benchmarkPath: CALIB_PATH,
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, "draft");
  assert.equal(result.quote_count, 0);
  assert.equal(result.active_theme_count, 217);
  assert.ok(result.warnings.some((w) => w.code === "draft_empty"));
  assert.equal(result.errors.length, 0);
});

test("retrieval runner rejects empty calibration scaffold (needs quotes)", () => {
  assert.throws(
    () => loadBenchmark(repoRoot, CALIB_PATH),
    /non-empty array/,
  );
});

test("expected Theme id must exist in active 217 library", () => {
  const themes = selectActiveThemes(loadTagLibrary(repoRoot, LIB_PATH).library);
  const memory = themes.find((t) => t.canonical_zh === "记忆");
  const { dir, path } = writeTempBenchmark({
    schema_version: "retrieval-benchmark.v1",
    benchmark_version: "tmp-calib",
    calibration: true,
    status: "frozen",
    exploratory: false,
    quotes: [
      {
        quote_id: "c1",
        text_zh: "一段关于记忆的文字。",
        category: "calib",
        test_purpose: "lexical_explicit",
        expected_theme_ids: [memory.id, "theme-9999-不存在"],
        expected_theme_labels: ["记忆"],
      },
    ],
  });
  try {
    const result = validateCalibrationBenchmark({
      repoRoot,
      benchmarkPath: path,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "unknown_expected_id"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("id and canonical label must agree", () => {
  const themes = selectActiveThemes(loadTagLibrary(repoRoot, LIB_PATH).library);
  const memory = themes.find((t) => t.canonical_zh === "记忆");
  const war = themes.find((t) => t.canonical_zh === "战争");
  const { dir, path } = writeTempBenchmark({
    schema_version: "retrieval-benchmark.v1",
    benchmark_version: "tmp-calib",
    calibration: true,
    status: "frozen",
    quotes: [
      {
        quote_id: "c1",
        text_zh: "错配的期望。",
        expected_theme_ids: [memory.id],
        expected_theme_labels: [war.canonical_zh],
      },
    ],
  });
  try {
    const result = validateCalibrationBenchmark({
      repoRoot,
      benchmarkPath: path,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "id_label_mismatch"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("duplicate quote ids fail", () => {
  const themes = selectActiveThemes(loadTagLibrary(repoRoot, LIB_PATH).library);
  const memory = themes.find((t) => t.canonical_zh === "记忆");
  const { dir, path } = writeTempBenchmark({
    schema_version: "retrieval-benchmark.v1",
    benchmark_version: "tmp-calib",
    calibration: true,
    status: "frozen",
    quotes: [
      {
        quote_id: "dup",
        text_zh: "第一句。",
        expected_theme_ids: [memory.id],
        expected_theme_labels: ["记忆"],
      },
      {
        quote_id: "dup",
        text_zh: "第二句。",
        expected_theme_ids: [memory.id],
        expected_theme_labels: ["记忆"],
      },
    ],
  });
  try {
    const result = validateCalibrationBenchmark({
      repoRoot,
      benchmarkPath: path,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "duplicate_quote_id"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("duplicate expected Theme ids within a quote fail", () => {
  const themes = selectActiveThemes(loadTagLibrary(repoRoot, LIB_PATH).library);
  const memory = themes.find((t) => t.canonical_zh === "记忆");
  const { dir, path } = writeTempBenchmark({
    schema_version: "retrieval-benchmark.v1",
    benchmark_version: "tmp-calib",
    calibration: true,
    status: "frozen",
    quotes: [
      {
        quote_id: "c1",
        text_zh: "重复期望。",
        expected_theme_ids: [memory.id, memory.id],
        expected_theme_labels: ["记忆"],
      },
    ],
  });
  try {
    const result = validateCalibrationBenchmark({
      repoRoot,
      benchmarkPath: path,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "duplicate_expected_id"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("empty text fails", () => {
  const themes = selectActiveThemes(loadTagLibrary(repoRoot, LIB_PATH).library);
  const memory = themes.find((t) => t.canonical_zh === "记忆");
  const { dir, path } = writeTempBenchmark({
    schema_version: "retrieval-benchmark.v1",
    benchmark_version: "tmp-calib",
    calibration: true,
    status: "frozen",
    quotes: [
      {
        quote_id: "c1",
        text_zh: "   ",
        expected_theme_ids: [memory.id],
        expected_theme_labels: ["记忆"],
      },
    ],
  });
  try {
    assert.throws(() => loadBenchmark(repoRoot, path), /text_zh/);
    // validateCalibration loadBenchmark with allowEmptyQuotes still rejects blank text
    assert.throws(
      () =>
        validateCalibrationBenchmark({
          repoRoot,
          benchmarkPath: path,
        }),
      /text_zh|non-empty/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("populated calibration can be consumed by retrieval runner (fake, no Qwen)", async () => {
  const themes = selectActiveThemes(loadTagLibrary(repoRoot, LIB_PATH).library);
  const memory = themes.find((t) => t.canonical_zh === "记忆");
  const childhood = themes.find((t) => t.canonical_zh === "童年");
  const { dir, path } = writeTempBenchmark({
    schema_version: "retrieval-benchmark.v1",
    benchmark_version: "tmp-calib-runnable",
    calibration: true,
    status: "frozen",
    exploratory: false,
    quotes: [
      {
        quote_id: "calib-tmp-001",
        text_zh: "童年的记忆忽然涌上心头。",
        category: "calib",
        test_purpose: "multi_theme",
        expected_theme_ids: [memory.id, childhood.id],
        expected_theme_labels: ["记忆", "童年"],
        notes: "Temporary fixture for infrastructure test only.",
      },
    ],
  });
  try {
    const result = validateCalibrationBenchmark({
      repoRoot,
      benchmarkPath: path,
    });
    assertCalibrationValid(result);
    assert.equal(result.quote_count, 1);

    const { run, manifest } = await runRetrievalBenchmark({
      repoRoot,
      config: {
        schema_version: "retrieval-config.v1",
        tag_library_path: LIB_PATH,
        active_status: "active_candidate",
        benchmark_path: path,
        representation: "A",
        provider: { id: "fake", options: { dimensions: 32 } },
        ranking: { top_k_report: [5, 10, 20], store_full_ranking: true },
        deterministic_match: { enabled: true },
        runs_dir: "research/retrieval/runs",
        overwrite_completed_runs: false,
      },
      representation: "A",
      runId: "test-calib-fake-A",
      providerOverride: createFakeEmbeddingProvider({ dimensions: 32 }),
    });
    assert.equal(run.active_theme_count, 217);
    assert.equal(manifest.exploratory, false);
    assert.equal(run.aggregate_metrics.evaluated_quotes, 1);
    assert.equal(typeof run.results[0].recall_at[5].recall, "number");
    assert.equal(run.embedding_provider.provider_id, "fake");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Experiment 0.1 artifacts remain present and untouched by this suite", () => {
  // Presence check only — do not rewrite run files.
  const a = join(
    repoRoot,
    "research/retrieval/runs/exp0.1-qwen06b-A/manifest.json",
  );
  const manifest = JSON.parse(readFileSync(a, "utf8"));
  assert.equal(manifest.run_id, "exp0.1-qwen06b-A");
  assert.equal(manifest.representation, "A");
});
