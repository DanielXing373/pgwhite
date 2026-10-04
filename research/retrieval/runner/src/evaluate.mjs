/**
 * Recall@K and aggregate reporting.
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
 * Aggregate mean Recall@K over Quotes that have a non-empty expected set.
 */
export function aggregateRecalls(perQuoteMetrics, ks = [5, 10, 20]) {
  const out = {
    evaluated_quotes: 0,
    skipped_empty_expected: 0,
  };
  for (const k of ks) {
    out[`mean_recall_at_${k}`] = null;
    out[`recall_at_${k}_values`] = [];
  }

  for (const q of perQuoteMetrics) {
    const r5 = q.recall_at?.[5];
    if (!r5 || !r5.evaluated) {
      out.skipped_empty_expected += 1;
      continue;
    }
    out.evaluated_quotes += 1;
    for (const k of ks) {
      const rk = q.recall_at?.[k];
      if (rk?.evaluated) out[`recall_at_${k}_values`].push(rk.recall);
    }
  }

  for (const k of ks) {
    const vals = out[`recall_at_${k}_values`];
    out[`mean_recall_at_${k}`] =
      vals.length === 0
        ? null
        : vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return out;
}
