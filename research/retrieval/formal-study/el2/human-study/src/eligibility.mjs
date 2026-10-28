import { FROZEN } from "../../../runner/src/freeze.mjs";

export const DATASET_VERSION = "el2-hs-questions.v1";
export const PROTOCOL_VERSION = "el2-human-preference.protocol.v1";
export const RANDOMIZATION_VERSION = "el2-assignment.v1";

export const EL2_SOURCE_IDS = Object.freeze([
  "human-gold",
  "embedding-top2",
  "gpt-6-luna",
  "deepseek-flash",
]);

/** Previously reported eligible set. Recompute and compare; do not treat as input to screening. */
export const EXPECTED_ELIGIBLE_QUOTE_IDS = Object.freeze([
  "batch1-calib-007",
  "batch1-calib-013",
  "batch1-calib-017",
  "batch1-calib-020",
  "batch1-calib-021",
  "batch1-calib-022",
  "batch2-batch2-004",
  "batch2-batch2-006",
  "batch2-batch2-007",
  "batch2-batch2-011",
  "batch2-batch2-012",
  "batch2-batch2-013",
  "batch2-batch2-014",
  "batch2-batch2-016",
  "batch2-batch2-018",
  "batch2-batch2-019",
  "batch2-batch2-022",
  "batch2-batch2-024",
  "batch2-batch2-026",
  "batch2-batch2-027",
]);

export function setKey(ids) {
  return JSON.stringify([...(ids ?? [])].slice().sort());
}

export function activeThemeIds(ontology) {
  return new Set(
    (ontology.themes ?? [])
      .filter((theme) => theme.status === "active_candidate")
      .map((theme) => theme.id),
  );
}

function invalidThemeIds(ids, activeIds) {
  return (ids ?? []).filter((id) => !activeIds.has(id));
}

function baselineSource(row, activeIds) {
  const ids = [...(row?.selected_theme_ids ?? [])];
  const bad = invalidThemeIds(ids, activeIds);
  return {
    valid: Boolean(row) && bad.length === 0,
    ids,
    invalid_theme_ids: bad,
    reason: !row ? "missing_result" : bad.length ? "invalid_theme_ids" : null,
  };
}

function runSource(row, activeIds) {
  if (!row) {
    return { valid: false, ids: [], invalid_theme_ids: [], reason: "missing_result" };
  }
  if (row.validation_status !== "valid") {
    return {
      valid: false,
      ids: [...(row.selected_theme_ids ?? [])],
      invalid_theme_ids: invalidThemeIds(row.selected_theme_ids ?? [], activeIds),
      reason: [row.validation_status, row.validation_reason].filter(Boolean).join("/"),
    };
  }
  const ids = [...(row.selected_theme_ids ?? [])];
  const bad = invalidThemeIds(ids, activeIds);
  return {
    valid: bad.length === 0,
    ids,
    invalid_theme_ids: bad,
    reason: bad.length ? "invalid_theme_ids" : null,
  };
}

export function collidingPairs(sources) {
  const pairs = [];
  for (let i = 0; i < EL2_SOURCE_IDS.length; i += 1) {
    for (let j = i + 1; j < EL2_SOURCE_IDS.length; j += 1) {
      const a = EL2_SOURCE_IDS[i];
      const b = EL2_SOURCE_IDS[j];
      if (!sources[a].valid || !sources[b].valid) continue;
      if (setKey(sources[a].ids) === setKey(sources[b].ids)) {
        pairs.push({
          source_a: a,
          source_b: b,
          identical_empty: sources[a].ids.length === 0,
          theme_ids_sorted: [...sources[a].ids].slice().sort(),
        });
      }
    }
  }
  return pairs;
}

export function screenQuote({ quoteId, gold, embed, luna, flash, activeIds }) {
  const sources = {
    "human-gold": baselineSource(gold, activeIds),
    "embedding-top2": baselineSource(embed, activeIds),
    "gpt-6-luna": runSource(luna, activeIds),
    "deepseek-flash": runSource(flash, activeIds),
  };
  const invalidSources = EL2_SOURCE_IDS.filter((id) => !sources[id].valid);
  const pairs = collidingPairs(sources);
  const invalidOutput = invalidSources.length > 0;
  const duplicateSets = pairs.length > 0;
  const reasons = [];
  if (invalidOutput) {
    reasons.push(
      `invalid_model_output:${invalidSources.map((id) => `${id}=${sources[id].reason}`).join(",")}`,
    );
  }
  if (duplicateSets) {
    reasons.push(
      `duplicate_theme_sets:${pairs.map((p) => `${p.source_a}==${p.source_b}${p.identical_empty ? "(empty)" : ""}`).join(",")}`,
    );
  }
  return {
    quote_id: quoteId,
    sources,
    invalid_output: invalidOutput,
    duplicate_sets: duplicateSets,
    colliding_pairs: pairs,
    eligible: !invalidOutput && !duplicateSets,
    reasons,
  };
}

export function screenAllQuotes({ ontology, goldDoc, embedDoc, lunaRun, flashRun }) {
  const activeIds = activeThemeIds(ontology);
  const lunaBy = new Map(lunaRun.results.map((row) => [row.quote_id, row]));
  const flashBy = new Map(flashRun.results.map((row) => [row.quote_id, row]));
  const embedBy = new Map(embedDoc.quotes.map((row) => [row.quote_id, row]));
  const rows = goldDoc.quotes.map((gold) => screenQuote({
    quoteId: gold.quote_id,
    gold,
    embed: embedBy.get(gold.quote_id),
    luna: lunaBy.get(gold.quote_id),
    flash: flashBy.get(gold.quote_id),
    activeIds,
  }));
  const eligible = rows.filter((row) => row.eligible).map((row) => row.quote_id);
  return {
    ontology_path: FROZEN.ontology.path,
    quote_count: rows.length,
    eligible_count: eligible.length,
    eligible_ids: eligible,
    expected_eligible_ids: [...EXPECTED_ELIGIBLE_QUOTE_IDS],
    expected_set_match:
      JSON.stringify(eligible) === JSON.stringify([...EXPECTED_ELIGIBLE_QUOTE_IDS]),
    excluded_invalid_output: rows.filter((row) => row.invalid_output).length,
    excluded_duplicate_sets: rows.filter((row) => row.duplicate_sets).length,
    overlap_invalid_and_collision: rows.filter((row) => row.invalid_output && row.duplicate_sets).length,
    rows,
  };
}
