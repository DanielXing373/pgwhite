/**
 * Recall@K and Success@3 aggregate reporting.
 * Precision is intentionally not optimized here.
 */

export function recallAtK(expectedIds, ranked, k) {
  const expected = [...new Set(expectedIds)];
  if (expected.length === 0) {
    return {
      evaluated: false,
      expected_count: 0,
      hit_count: 0,
      recall: null,
      hits: [],
      misses: [],
    };
  }
  const top = ranked.slice(0, k);
  const topIds = new Set(top.map((r) => r.tag_id));
  const hits = expected.filter((id) => topIds.has(id));
  const misses = expected.filter((id) => !topIds.has(id));
  return {
    evaluated: true,
    expected_count: expected.length,
    hit_count: hits.length,
    recall: hits.length / expected.length,
    hits,
    misses,
  };
}

export function expectedRanks(expectedIds, ranked) {
  const byId = new Map(ranked.map((r) => [r.tag_id, r]));
  return expectedIds.map((id) => {
    const row = byId.get(id);
    return {
      tag_id: id,
      rank: row ? row.rank : null,
      similarity: row ? row.similarity : null,
      in_top_20: row ? row.rank <= 20 : false,
    };
  });
}

/**
 * Aggregate mean Recall@K and quote-level Success@3 over Quotes that have a
 * non-empty expected set.
 */
export function aggregateRecalls(perQuoteMetrics, ks = [3, 5]) {
  const out = {
    evaluated_quotes: 0,
    skipped_empty_expected: 0,
  };
  for (const k of ks) {
    out[`mean_recall_at_${k}`] = null;
    out[`recall_at_${k}_values`] = [];
  }
  out.success_at_3 = null;
  out.success_at_3_count = 0;

  for (const q of perQuoteMetrics) {
    const r5 = q.recall_at?.[5];
    if (!r5 || !r5.evaluated) {
      out.skipped_empty_expected += 1;
      continue;
    }
    out.evaluated_quotes += 1;
    for (const k of ks) {
      const rk = q.recall_at?.[k];
      if (rk?.evaluated) {
        out[`recall_at_${k}_values`].push(rk.recall);
      }
    }
    if (q.recall_at?.[3]?.hit_count > 0) out.success_at_3_count += 1;
  }

  for (const k of ks) {
    const vals = out[`recall_at_${k}_values`];
    out[`mean_recall_at_${k}`] =
      vals.length === 0
        ? null
        : vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  out.success_at_3 =
    out.evaluated_quotes === 0
      ? null
      : out.success_at_3_count / out.evaluated_quotes;
  return out;
}

/**
 * Summarize measured per-quote work and project a sequential 1,000-quote run.
 * One-time Theme index preparation is reported separately and included in
 * the projected batch duration.
 */
export function summarizeTaggingLatency(
  perQuoteMetrics,
  {
    theme_index_preparation_ms = 0,
    route_model_preparation_ms = 0,
    projected_quote_count = 1000,
  } = {},
) {
  const samples = perQuoteMetrics
    .map((quote) => quote.tagging_latency_ms)
    .filter((value) => Number.isFinite(value) && value >= 0);
  const mean =
    samples.length === 0
      ? null
      : samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const preparation = Number.isFinite(theme_index_preparation_ms)
    ? theme_index_preparation_ms
    : 0;
  const routePreparation = Number.isFinite(route_model_preparation_ms)
    ? route_model_preparation_ms
    : 0;

  return {
    timed_quotes: samples.length,
    mean_tagging_latency_ms_per_quote: mean,
    measured_tagging_latency_ms_total:
      samples.length === 0
        ? null
        : samples.reduce((sum, value) => sum + value, 0),
    theme_index_preparation_ms: preparation,
    route_model_preparation_ms: routePreparation,
    projected_quote_count,
    estimated_1000_quote_batch_ms:
      mean == null
        ? null
        : preparation + routePreparation + mean * projected_quote_count,
    estimate_scope:
      "Sequential runner estimate: one-time embedding and Theme index preparation + one-time route model preparation + measured mean per-quote route latency × projected quote count.",
  };
}
