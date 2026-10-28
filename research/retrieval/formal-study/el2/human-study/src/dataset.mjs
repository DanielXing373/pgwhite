import { createHash } from "node:crypto";
import { EL2_SOURCE_IDS, DATASET_VERSION, PROTOCOL_VERSION } from "./eligibility.mjs";

function themeViews(ids, ontologyById) {
  return (ids ?? []).map((id) => {
    const theme = ontologyById.get(id);
    if (!theme) {
      throw new Error(`STOP: Theme ID ${id} is not in the frozen ontology.`);
    }
    return {
      theme_id: id,
      label_zh: theme.canonical_zh,
      definition_zh: theme.definition,
    };
  });
}

function sourceRecord({ sourceId, ids, ontologyById, artifact, sha256, runId, modelId }) {
  return {
    source_id: sourceId,
    selected_theme_ids: [...ids],
    themes: themeViews(ids, ontologyById),
    theme_count: ids.length,
    artifact,
    artifact_sha256: sha256,
    run_id: runId ?? null,
    model_id: modelId ?? null,
  };
}

export function opaqueThemeSetId(quoteId, sourceId, version = DATASET_VERSION) {
  return createHash("sha256")
    .update(`${version}|${quoteId}|${sourceId}`, "utf8")
    .digest("hex")
    .slice(0, 16);
}

export function buildMasterQuote({
  quote,
  screenRow,
  attribution,
  ontologyById,
  goldSha,
  embedSha,
  lunaSha,
  flashSha,
  lunaRun,
  flashRun,
}) {
  const sources = {
    "human-gold": sourceRecord({
      sourceId: "human-gold",
      ids: screenRow.sources["human-gold"].ids,
      ontologyById,
      artifact: "research/retrieval/formal-study/el2/baselines/human-gold.v1.json",
      sha256: goldSha,
    }),
    "embedding-top2": sourceRecord({
      sourceId: "embedding-top2",
      ids: screenRow.sources["embedding-top2"].ids,
      ontologyById,
      artifact: "research/retrieval/formal-study/el2/baselines/embedding-top2.v1.json",
      sha256: embedSha,
    }),
    "gpt-6-luna": sourceRecord({
      sourceId: "gpt-6-luna",
      ids: screenRow.sources["gpt-6-luna"].ids,
      ontologyById,
      artifact: "research/retrieval/formal-study/runs/EL2-GPT6LUNA/run.json",
      sha256: lunaSha,
      runId: lunaRun.run_id,
      modelId: lunaRun.selector_provider?.model_id ?? "gpt-6-luna",
    }),
    "deepseek-flash": sourceRecord({
      sourceId: "deepseek-flash",
      ids: screenRow.sources["deepseek-flash"].ids,
      ontologyById,
      artifact: "research/retrieval/formal-study/runs/EL2-DSFLASH/run.json",
      sha256: flashSha,
      runId: flashRun.run_id,
      modelId: flashRun.selector_provider?.model_id ?? "deepseek-flash",
    }),
  };
  const themeSetIds = Object.fromEntries(
    EL2_SOURCE_IDS.map((id) => [id, opaqueThemeSetId(quote.quote_id, id)]),
  );
  return {
    quote_id: quote.quote_id,
    text_zh: quote.text_zh,
    el1_pilot: quote.el1_pilot === true,
    attribution,
    sources,
    theme_set_ids: themeSetIds,
  };
}

export function buildParticipantQuote(masterQuote) {
  const sets = EL2_SOURCE_IDS.map((sourceId) => {
    const src = masterQuote.sources[sourceId];
    return {
      theme_set_id: masterQuote.theme_set_ids[sourceId],
      themes: src.themes.map((theme) => ({
        theme_id: theme.theme_id,
        label_zh: theme.label_zh,
        definition_zh: theme.definition_zh,
      })),
      theme_count: src.theme_count,
    };
  });
  sets.sort((a, b) => a.theme_set_id.localeCompare(b.theme_set_id));
  return {
    quote_id: masterQuote.quote_id,
    text_zh: masterQuote.text_zh,
    author_name_zh: masterQuote.attribution.author_name_zh,
    book_title_zh: masterQuote.attribution.book_title_zh,
    attribution_status: masterQuote.attribution.verification_status,
    theme_sets: sets,
  };
}

function walk(value, visitKey, visitString) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitKey, visitString);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      visitKey(key);
      walk(child, visitKey, visitString);
    }
    return;
  }
  if (typeof value === "string") visitString(value);
}

export function assertParticipantSafe(value, label) {
  const forbiddenKeys = new Set([
    "source_id",
    "model_id",
    "run_id",
    "el1_pilot",
    "sources",
    "theme_set_ids",
  ]);
  const forbiddenValues = new Set(EL2_SOURCE_IDS);
  walk(
    value,
    (key) => {
      if (forbiddenKeys.has(key) || /model_id|run_id|source_id|el1_pilot/i.test(key)) {
        throw new Error(`STOP: participant-safe projection leaked key ${key} in ${label}.`);
      }
    },
    (str) => {
      if (forbiddenValues.has(str)) {
        throw new Error(`STOP: participant-safe projection leaked source value ${str} in ${label}.`);
      }
    },
  );
}

export function buildExclusionReport(screen, goldDoc) {
  const byId = new Map(goldDoc.quotes.map((q) => [q.quote_id, q]));
  return {
    schema_version: "el2-hs-exclusion.v1",
    dataset_version: DATASET_VERSION,
    protocol_version: PROTOCOL_VERSION,
    quote_count: screen.quote_count,
    eligible_count: screen.eligible_count,
    eligible_ids: screen.eligible_ids,
    expected_eligible_ids: screen.expected_eligible_ids,
    expected_set_match: screen.expected_set_match,
    excluded_invalid_output: screen.excluded_invalid_output,
    excluded_duplicate_sets: screen.excluded_duplicate_sets,
    overlap_invalid_and_collision: screen.overlap_invalid_and_collision,
    quotes: screen.rows.map((row) => ({
      quote_id: row.quote_id,
      text_zh: byId.get(row.quote_id)?.text_zh ?? null,
      gold_valid: row.sources["human-gold"].valid,
      embedding_valid: row.sources["embedding-top2"].valid,
      luna_valid: row.sources["gpt-6-luna"].valid,
      flash_valid: row.sources["deepseek-flash"].valid,
      colliding_pairs: row.colliding_pairs,
      eligible: row.eligible,
      reasons: row.reasons,
    })),
  };
}

export function buildManifest({ files, freezeStatus, attribution }) {
  return {
    schema_version: "el2-hs-dataset-manifest.v1",
    dataset_version: DATASET_VERSION,
    protocol_version: PROTOCOL_VERSION,
    freeze_status: freezeStatus,
    created_utc_note: "Generated locally from frozen EL2 artifacts. Not a participant response file.",
    attribution_complete: attribution.every((row) => row.complete),
    unresolved_quote_ids: attribution.filter((row) => !row.complete).map((row) => row.quote_id),
    files,
    phase2_exposure:
      "The Phase 2 server loads the internal master only. HTTP responses contain shuffled A–D theme sets for the assigned session, plus option E. The participant-safe file is a content catalog: theme_set_id values are salted hashes and are not source labels. Clients must not receive source_id, model_id, or run_id.",
  };
}
