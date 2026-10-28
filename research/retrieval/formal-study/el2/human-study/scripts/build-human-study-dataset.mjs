/**
 * Build EL2 human-study question datasets from frozen artifacts.
 * Does not call APIs, mutate runs, or write the production database.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FROZEN } from "../../../runner/src/freeze.mjs";
import { attributeQuotes } from "../src/attribution.mjs";
import {
  assertParticipantSafe,
  buildExclusionReport,
  buildManifest,
  buildMasterQuote,
  buildParticipantQuote,
} from "../src/dataset.mjs";
import {
  DATASET_VERSION,
  PROTOCOL_VERSION,
  EXPECTED_ELIGIBLE_QUOTE_IDS,
  screenAllQuotes,
} from "../src/eligibility.mjs";

const humanStudyDir = dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/, "");
const repoRoot = resolve(humanStudyDir, "../../../../../");

function readJson(rel) {
  return JSON.parse(readFileSync(join(repoRoot, rel), "utf8"));
}

function sha256File(rel) {
  return createHash("sha256").update(readFileSync(join(repoRoot, rel))).digest("hex");
}

function writeJson(abs, obj) {
  mkdirSync(dirname(abs), { recursive: true });
  const text = `${JSON.stringify(obj, null, 2)}\n`;
  writeFileSync(abs, text, "utf8");
  return createHash("sha256").update(text).digest("hex");
}

const ontology = readJson(FROZEN.ontology.path);
const goldDoc = readJson("research/retrieval/formal-study/el2/baselines/human-gold.v1.json");
const embedDoc = readJson("research/retrieval/formal-study/el2/baselines/embedding-top2.v1.json");
const lunaRun = readJson("research/retrieval/formal-study/runs/EL2-GPT6LUNA/run.json");
const flashRun = readJson("research/retrieval/formal-study/runs/EL2-DSFLASH/run.json");
const annotationFixture = readJson("research/annotation-workbench/fixtures/benchmark.v1.json");
const wereadSql = readFileSync(join(repoRoot, "pgwhite_weread_import.sql"), "utf8");
const humanOverrideDoc = readJson("research/retrieval/formal-study/el2/human-study/human-attribution-overrides.v1.json");

const goldSha = sha256File("research/retrieval/formal-study/el2/baselines/human-gold.v1.json");
const embedSha = sha256File("research/retrieval/formal-study/el2/baselines/embedding-top2.v1.json");
const lunaSha = sha256File("research/retrieval/formal-study/runs/EL2-GPT6LUNA/run.json");
const flashSha = sha256File("research/retrieval/formal-study/runs/EL2-DSFLASH/run.json");
const ontologySha = sha256File(FROZEN.ontology.path);
const benchmarkSha = sha256File(FROZEN.benchmark.path);

if (ontologySha !== FROZEN.ontology.sha256) {
  throw new Error("STOP: ontology SHA mismatch.");
}
if (benchmarkSha !== FROZEN.benchmark.sha256) {
  throw new Error("STOP: benchmark SHA mismatch.");
}

const screen = screenAllQuotes({ ontology, goldDoc, embedDoc, lunaRun, flashRun });
if (!screen.expected_set_match) {
  throw new Error(
    `STOP: recomputed eligible IDs do not match the expected set.\nexpected=${screen.expected_eligible_ids.join(",")}\ngot=${screen.eligible_ids.join(",")}`,
  );
}
if (screen.eligible_count !== 20) {
  throw new Error(`STOP: expected 20 eligible quotes, got ${screen.eligible_count}.`);
}

const goldBy = new Map(goldDoc.quotes.map((q) => [q.quote_id, q]));
const ontologyById = new Map((ontology.themes ?? []).map((t) => [t.id, t]));
const eligibleQuotes = EXPECTED_ELIGIBLE_QUOTE_IDS.map((id) => {
  const gold = goldBy.get(id);
  if (!gold) throw new Error(`STOP: missing gold row ${id}`);
  if (gold.text_zh !== goldDoc.quotes.find((q) => q.quote_id === id).text_zh) {
    throw new Error(`STOP: gold text mismatch ${id}`);
  }
  return gold;
});

const attribution = attributeQuotes({
  quoteRows: eligibleQuotes,
  wereadSql,
  annotationFixture,
  humanOverrides: humanOverrideDoc.overrides,
});
const attributionComplete = attribution.every((row) => row.complete);
const freezeStatus = attributionComplete ? "frozen" : "candidate";

const screenBy = new Map(screen.rows.map((row) => [row.quote_id, row]));
const attrBy = new Map(attribution.map((row) => [row.quote_id, row]));

const masterQuotes = eligibleQuotes.map((quote) => {
  const screenRow = screenBy.get(quote.quote_id);
  if (!screenRow.eligible) throw new Error(`STOP: ${quote.quote_id} is not eligible.`);
  for (const source of ["human-gold", "embedding-top2", "gpt-6-luna", "deepseek-flash"]) {
    const ids = screenRow.sources[source].ids;
    if (ids.length !== new Set(ids).size) throw new Error(`STOP: duplicate IDs in ${source} ${quote.quote_id}`);
  }
  return buildMasterQuote({
    quote,
    screenRow,
    attribution: attrBy.get(quote.quote_id),
    ontologyById,
    goldSha,
    embedSha,
    lunaSha,
    flashSha,
    lunaRun,
    flashRun,
  });
});

const master = {
  schema_version: "el2-hs-internal-master.v1",
  dataset_version: DATASET_VERSION,
  protocol_version: PROTOCOL_VERSION,
  freeze_status: freezeStatus,
  experiment_batch: "EL2",
  note: "PRIVATE mapping. Do not ship to the browser bundle. Do not treat Human Gold as an answer key.",
  provenance: {
    ontology_path: FROZEN.ontology.path,
    ontology_sha256: ontologySha,
    benchmark_path: FROZEN.benchmark.path,
    benchmark_sha256: benchmarkSha,
    gold_sha256: goldSha,
    embedding_top2_sha256: embedSha,
    luna_run_id: lunaRun.run_id,
    luna_sha256: lunaSha,
    flash_run_id: flashRun.run_id,
    flash_sha256: flashSha,
    attribution_sources: [
      "pgwhite_weread_import.sql",
      "research/annotation-workbench/fixtures/benchmark.v1.json",
      "research/retrieval/formal-study/el2/human-study/human-attribution-overrides.v1.json",
    ],
  },
  quotes: masterQuotes,
};

const participant = {
  schema_version: "el2-hs-participant-content.v1",
  dataset_version: DATASET_VERSION,
  freeze_status: freezeStatus,
  note: "Content catalog only. Theme-set order is by opaque id, not source identity. Phase 2 server assigns A–D per session from the internal master.",
  none_of_the_above_label_zh: "以上都不合适",
  quotes: masterQuotes.map(buildParticipantQuote),
};
assertParticipantSafe(participant, "participant-content");

const outDir = join(humanStudyDir, "datasets");
const masterRel = "research/retrieval/formal-study/el2/human-study/datasets/el2-hs-questions.internal.v1.json";
const publicRel = "research/retrieval/formal-study/el2/human-study/datasets/el2-hs-questions.participant-content.v1.json";
const exclusionRel = "research/retrieval/formal-study/el2/human-study/EXCLUSION-REPORT.json";
const attributionRel = "research/retrieval/formal-study/el2/human-study/ATTRIBUTION-REPORT.json";

const masterSha = writeJson(join(repoRoot, masterRel), master);
const publicSha = writeJson(join(repoRoot, publicRel), participant);
const exclusionSha = writeJson(join(repoRoot, exclusionRel), buildExclusionReport(screen, goldDoc));
const attributionDoc = {
  schema_version: "el2-hs-attribution.v1",
  dataset_version: DATASET_VERSION,
  matching_algorithm: [
    "Exact UTF-8 equality of frozen text_zh against pgwhite_weread_import.sql quote_translations.content (zh).",
    "Exact UTF-8 equality against annotation-workbench/fixtures/benchmark.v1.json textZh and productionQuoteTextZh.",
    "Join WeRead SQL quote_id → book_id → book_translations / author_translations.",
    "Authors 1 and 2 are reused in the WeRead dump without INSERTs; names filled only from the annotation fixture by bookId when unique.",
    "No punctuation or wording edits. Ambiguous or conflicting hits are flagged, not repaired.",
    "Three remaining non-exact cases were filled only from human-attribution-overrides.v1.json (2026-10-27).",
  ],
  public_release_ready: attributionComplete,
  verified_count: attribution.filter((row) => row.complete).length,
  unresolved_quote_ids: attribution.filter((row) => !row.complete).map((row) => row.quote_id),
  quotes: attribution,
};
const attributionSha = writeJson(join(repoRoot, attributionRel), attributionDoc);

const manifest = buildManifest({
  freezeStatus,
  attribution,
  files: [
    { path: masterRel, sha256: masterSha, role: "internal_master" },
    { path: publicRel, sha256: publicSha, role: "participant_content" },
    { path: exclusionRel, sha256: exclusionSha, role: "exclusion_report" },
    { path: attributionRel, sha256: attributionSha, role: "attribution_report" },
  ],
});
const manifestRel = "research/retrieval/formal-study/el2/human-study/DATASET-MANIFEST.json";
writeJson(join(repoRoot, manifestRel), manifest);

console.log(JSON.stringify({
  freeze_status: freezeStatus,
  eligible: screen.eligible_count,
  expected_set_match: screen.expected_set_match,
  attribution_complete: attributionComplete,
  unresolved: attribution.filter((row) => !row.complete).map((row) => row.quote_id),
  master_sha256: masterSha,
  participant_sha256: publicSha,
}, null, 2));
