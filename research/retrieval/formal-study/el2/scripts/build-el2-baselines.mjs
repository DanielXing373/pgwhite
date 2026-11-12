#!/usr/bin/env node
/**
 * Derive EL2 Human Gold and Embedding Top2 baselines from frozen artifacts.
 * Does not call APIs, modify Gold, or write into EL1 runs/archives.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBenchmark } from "../../../runner/src/benchmark.mjs";
import { loadTagLibrary, selectActiveThemes } from "../../../runner/src/tagLibrary.mjs";
import { loadRetrievalArtifact } from "../../runner/src/candidates.mjs";
import { FROZEN, PHASE2_RETRIEVAL, verifyDeclaredAsset } from "../../runner/src/freeze.mjs";
import {
  detectSourceCollisions,
  extractEmbeddingTop2,
  extractHumanGold,
  goldDistribution,
} from "../src/baselines.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const outDir = join(repoRoot, "research/retrieval/formal-study/el2/baselines");

const ontology = verifyDeclaredAsset(repoRoot, FROZEN.ontology.path, FROZEN.ontology.sha256, "ontology");
const benchmark = verifyDeclaredAsset(repoRoot, FROZEN.benchmark.path, FROZEN.benchmark.sha256, "benchmark");
verifyDeclaredAsset(repoRoot, PHASE2_RETRIEVAL.path, PHASE2_RETRIEVAL.artifact_sha256, "retrieval");
const artifact = loadRetrievalArtifact(repoRoot, PHASE2_RETRIEVAL.path);
const loadedBench = loadBenchmark(repoRoot, FROZEN.benchmark.path);
const quotes = loadedBench.data.quotes;
if (quotes.length !== 58) {
  throw new Error(`STOP: frozen benchmark quote count is ${quotes.length}, expected 58.`);
}
const retrIds = new Set(artifact.run.results.map((row) => row.quote_id));
const missing = quotes.map((quote) => quote.quote_id).filter((id) => !retrIds.has(id));
if (missing.length) {
  throw new Error(`STOP: retrieval coverage incomplete: ${missing.join(", ")}`);
}

const library = loadTagLibrary(repoRoot, FROZEN.ontology.path);
const themes = selectActiveThemes(library.library, { activeStatus: "active_candidate" });
const themesById = new Map(themes.map((theme) => [theme.id, theme]));
const gold = extractHumanGold(quotes, {
  benchmarkSha256: benchmark.sha256,
  ontologySha256: ontology.sha256,
});
const embedding = extractEmbeddingTop2({
  quotes,
  retrievalRun: artifact.run,
  themesById,
  retrievalSha256: artifact.sha256,
  ontologySha256: ontology.sha256,
});
const sourcesByQuote = {};
for (const row of gold.quotes) {
  sourcesByQuote[row.quote_id] = { "human-gold": row.selected_theme_ids };
}
for (const row of embedding.quotes) {
  sourcesByQuote[row.quote_id]["embedding-top2"] = row.selected_theme_ids;
}
const collisions = detectSourceCollisions(sourcesByQuote);
const coverage = {
  schema_version: "el2-coverage.v1",
  ontology_sha256: ontology.sha256,
  benchmark_sha256: benchmark.sha256,
  retrieval_run_id: PHASE2_RETRIEVAL.run_id,
  retrieval_artifact_sha256: artifact.sha256,
  retrieval_effective_config_sha256: artifact.run.effective_config_sha256,
  quote_count: quotes.length,
  retrieval_result_count: artifact.run.results.length,
  missing_retrieval_quote_ids: missing,
  ranking_length: [...new Set(artifact.run.results.map((row) => row.ranking?.length))],
  gold_distribution: goldDistribution(quotes),
  embedding_top2_quote_count: embedding.quotes.length,
  gold_vs_embedding_collisions: collisions,
  note: "LLM sources are not included until EL2-GPT6LUNA and EL2-DSFLASH complete.",
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "human-gold.v1.json"), `${JSON.stringify(gold, null, 2)}\n`);
writeFileSync(join(outDir, "embedding-top2.v1.json"), `${JSON.stringify(embedding, null, 2)}\n`);
writeFileSync(join(outDir, "coverage.v1.json"), `${JSON.stringify(coverage, null, 2)}\n`);
console.log(JSON.stringify({
  quotes: quotes.length,
  missing_retrieval: missing,
  gold_empty: coverage.gold_distribution.empty_gold_quote_ids,
  collisions: collisions.length,
  outDir,
}, null, 2));
