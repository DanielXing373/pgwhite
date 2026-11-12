#!/usr/bin/env node
// 把已有的非竞赛来源转成同一种 run.json，方便进同一个盲审包（只读原文件，不调用模型）：
//   BASE-embedding-top2-dev58   冻结检索结果的前 2 名（非 LLM 基线）
//   BASE-human-gold-dev58       人工标注（盲审里只是一个匿名来源，不是标准答案）
//   LEGACY-EL2-GPT6LUNA / LEGACY-EL2-DSFLASH   EL2 的 Top20+LLM 结果，原样，不修复无效输出
// 这些来源都只有主题维度。
import fs from "node:fs";
import path from "node:path";
import { loadLibrary } from "../src/library.mjs";
import { AC_ROOT, FROZEN_BENCHMARK, FROZEN_RETRIEVAL, fromRepo } from "../src/paths.mjs";
import { RUN_SCHEMA } from "../src/run.mjs";
import { readJson, sha256File, writeJson } from "../src/util.mjs";

const library = loadLibrary();
const benchmarkFile = fromRepo(FROZEN_BENCHMARK);
const benchmark = readJson(benchmarkFile);
const dataset = { id: "dev58", path: FROZEN_BENCHMARK, sha256: sha256File(benchmarkFile), quotes: benchmark.quotes.length, limit: null };

function toTags(ids) {
  return ids.map((id) => {
    const tag = library.byId.get(id);
    if (!tag) throw new Error(`STOP: ${id} is not in the AC library`);
    return { code: tag.code, tag_id: tag.id, label: tag.label, evidence: null };
  });
}

function write(runId, armId, source, results, extra = {}) {
  const dir = path.join(AC_ROOT, "runs", runId);
  if (fs.existsSync(dir)) {
    console.log(`skip ${runId}: already exists (runs are immutable)`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, "run.json"), {
    schema_version: RUN_SCHEMA,
    run_id: runId,
    arm_id: armId,
    kind: "baseline",
    execution_mode: "converted",
    created_at: new Date().toISOString(),
    source,
    library: { version: library.version, sha256: library.sha256 },
    dataset,
    dimensions: ["theme"],
    summary: { quotes: results.length, valid_quotes: results.filter((row) => row.status === "valid").length, cost: null, speed: null, ...extra },
    results,
  });
  console.log(`wrote ${runId}`);
}

const retrievalFile = fromRepo(FROZEN_RETRIEVAL);
if (fs.existsSync(retrievalFile)) {
  const results = readJson(retrievalFile).results.map((row) => ({
    quote_id: row.quote_id,
    text_zh: row.text_zh,
    status: "valid",
    reason: null,
    tags: { theme: toTags(row.ranking.slice(0, 2).map((entry) => entry.tag_id)) },
    dropped: [],
  }));
  write("BASE-embedding-top2-dev58", "embedding-top2", { path: FROZEN_RETRIEVAL }, results);
} else {
  console.log(`skip embedding baseline: ${FROZEN_RETRIEVAL} not found`);
}

write("BASE-human-gold-dev58", "human-gold", { path: FROZEN_BENCHMARK }, benchmark.quotes.map((quote) => ({
  quote_id: quote.quote_id,
  text_zh: quote.text_zh,
  status: "valid",
  reason: null,
  tags: { theme: toTags(quote.expected_theme_ids) },
  dropped: [],
})));

for (const legacy of ["EL2-GPT6LUNA", "EL2-DSFLASH"]) {
  const relative = `research/retrieval/formal-study/runs/${legacy}/run.json`;
  const file = fromRepo(relative);
  if (!fs.existsSync(file)) {
    console.log(`skip LEGACY-${legacy}: ${relative} not found`);
    continue;
  }
  const source = readJson(file);
  const results = source.results.map((row) => {
    const valid = row.validation_status === "valid";
    return {
      quote_id: row.quote_id,
      text_zh: row.text_zh,
      status: valid ? "valid" : "invalid",
      reason: valid ? null : row.validation_reason ?? row.validation_status,
      tags: valid ? { theme: toTags(row.selected_theme_ids) } : null,
      dropped: [],
    };
  });
  const usd = source.cost_summary?.average_usd_per_quote ?? null;
  write(`LEGACY-${legacy}`, `legacy-${legacy.toLowerCase()}`, { path: relative, sha256: sha256File(file) }, results, {
    cost: usd == null ? null : { estimate_kind: "catalog_token_estimate", usd_per_10k_quotes: usd * 10000, cny_per_usd: 7.2, cny_per_10k_quotes: usd * 10000 * 7.2 },
  });
}
