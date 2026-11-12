import { FROZEN, PHASE2_RETRIEVAL } from "../../runner/src/freeze.mjs";

export const EL2_PILOT_QUOTE_IDS = Object.freeze([
  "batch1-calib-001",
  "batch1-calib-005",
  "batch1-calib-006",
  "batch1-calib-008",
  "batch1-calib-018",
  "batch1-calib-027",
  "batch2-batch2-001",
  "batch2-batch2-017",
  "batch2-batch2-022",
  "batch2-batch2-023",
]);

export function goldDistribution(quotes) {
  const counts = {};
  for (const quote of quotes) {
    const n = (quote.expected_theme_ids ?? []).length;
    counts[n] = (counts[n] ?? 0) + 1;
  }
  return {
    quote_count: quotes.length,
    by_theme_count: counts,
    empty_gold_quote_ids: quotes
      .filter((quote) => (quote.expected_theme_ids ?? []).length === 0)
      .map((quote) => quote.quote_id),
  };
}

export function extractHumanGold(quotes, { benchmarkSha256, ontologySha256 }) {
  const pilot = new Set(EL2_PILOT_QUOTE_IDS);
  return {
    schema_version: "el2-human-gold.v1",
    experiment_batch: "EL2",
    source_id: "human-gold",
    source: FROZEN.benchmark.path,
    benchmark_sha256: benchmarkSha256,
    ontology_sha256: ontologySha256,
    note: "Original Human Gold copied in recorded order. Not truncated to 0–2. Not an LLM output.",
    quotes: quotes.map((quote) => ({
      quote_id: quote.quote_id,
      text_zh: quote.text_zh,
      selected_theme_ids: [...(quote.expected_theme_ids ?? [])],
      selected_theme_labels: [...(quote.expected_theme_labels ?? [])],
      theme_count: (quote.expected_theme_ids ?? []).length,
      zero_theme: quote.zero_theme === true,
      el1_pilot: pilot.has(quote.quote_id),
    })),
  };
}

export function extractEmbeddingTop2({ quotes, retrievalRun, themesById, retrievalSha256, ontologySha256 }) {
  const byQuote = new Map(retrievalRun.results.map((row) => [row.quote_id, row]));
  const pilot = new Set(EL2_PILOT_QUOTE_IDS);
  const missing = [];
  const quotesOut = quotes.map((quote) => {
    const row = byQuote.get(quote.quote_id);
    if (!row) {
      missing.push(quote.quote_id);
      return null;
    }
    const ranking = row.ranking ?? [];
    const top = ranking.slice(0, 2);
    const ids = top.map((item) => item.tag_id);
    for (const id of ids) {
      if (!themesById.has(id)) {
        throw new Error(`STOP: embedding Top2 ID ${id} is not in the frozen ontology (${quote.quote_id}).`);
      }
    }
    if (ids.length !== 2) {
      throw new Error(`STOP: embedding Top2 for ${quote.quote_id} is not length 2.`);
    }
    return {
      quote_id: quote.quote_id,
      text_zh: quote.text_zh,
      selected_theme_ids: ids,
      selected_theme_labels: ids.map((id) => themesById.get(id).canonical_zh),
      definitions: ids.map((id) => themesById.get(id).definition),
      retrieval_ranks: top.map((item) => item.rank),
      similarities: top.map((item) => item.similarity),
      theme_count: 2,
      el1_pilot: pilot.has(quote.quote_id),
    };
  });
  if (missing.length) {
    throw new Error(`STOP: retrieval coverage missing quote IDs: ${missing.join(", ")}`);
  }
  return {
    schema_version: "el2-embedding-top2.v1",
    experiment_batch: "EL2",
    source_id: "embedding-top2",
    retrieval_run_id: PHASE2_RETRIEVAL.run_id,
    retrieval_artifact_sha256: retrievalSha256,
    ontology_sha256: ontologySha256,
    method: "exactly the two highest-ranked frozen C-task Themes, original ranking order, no threshold",
    quotes: quotesOut,
  };
}

function orderedKey(ids) {
  return JSON.stringify(ids ?? []);
}

function setKey(ids) {
  return JSON.stringify([...(ids ?? [])].slice().sort());
}

export function detectSourceCollisions(sourcesByQuote) {
  const collisions = [];
  for (const [quoteId, sources] of Object.entries(sourcesByQuote)) {
    const entries = Object.entries(sources);
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [aName, aIds] = entries[i];
        const [bName, bIds] = entries[j];
        const ordered = orderedKey(aIds) === orderedKey(bIds);
        const sameSet = setKey(aIds) === setKey(bIds);
        if (ordered || sameSet) {
          collisions.push({
            quote_id: quoteId,
            source_a: aName,
            source_b: bName,
            identical_ordered: ordered,
            identical_set: sameSet,
            theme_ids: aIds,
            theme_count_a: (aIds ?? []).length,
            theme_count_b: (bIds ?? []).length,
          });
        }
      }
    }
  }
  return collisions;
}
