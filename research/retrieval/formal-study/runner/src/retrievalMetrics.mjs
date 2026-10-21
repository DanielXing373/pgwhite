import { recallAtK } from "../../../runner/src/evaluate.mjs";

export const FORMAL_RECALL_KS = Object.freeze([5, 10, 20]);

export function scoreRetrievalQuote(expectedIds, ranked) {
  const recall_at = {};
  for (const k of FORMAL_RECALL_KS) {
    recall_at[k] = recallAtK(expectedIds, ranked, k);
  }
  return recall_at;
}

export function formalExpectedRanks(expectedIds, ranked, labelsById) {
  const byId = new Map(ranked.map((row) => [row.tag_id, row]));
  return expectedIds.map((id) => {
    const row = byId.get(id);
    const rank = row ? row.rank : null;
    return {
      tag_id: id,
      canonical_zh: labelsById.get(id) ?? null,
      rank,
      similarity: row ? row.similarity : null,
      in_top_5: rank != null && rank <= 5,
      in_top_10: rank != null && rank <= 10,
      in_top_20: rank != null && rank <= 20,
    };
  });
}

export function aggregateFormalRetrieval(results) {
  const out = {
    evaluated_quotes: 0,
    skipped_empty_expected: 0,
  };
  for (const k of FORMAL_RECALL_KS) {
    out[`mean_recall_at_${k}`] = null;
    out[`recall_at_${k}_values`] = [];
  }
  const failures = [];
  for (const quote of results) {
    const marker = quote.recall_at?.[5];
    if (!marker || marker.evaluated !== true) {
      out.skipped_empty_expected += 1;
      continue;
    }
    out.evaluated_quotes += 1;
    for (const k of FORMAL_RECALL_KS) {
      const row = quote.recall_at?.[k];
      if (row?.evaluated) out[`recall_at_${k}_values`].push(row.recall);
    }
    const missed = (quote.ranks_of_expected ?? []).filter((row) => row.rank == null || row.rank > 20);
    if (missed.length > 0) {
      failures.push({
        quote_id: quote.quote_id,
        missed_theme_ids: missed.map((row) => row.tag_id),
      });
    }
  }
  for (const k of FORMAL_RECALL_KS) {
    const values = out[`recall_at_${k}_values`];
    out[`mean_recall_at_${k}`] = values.length === 0
      ? null
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  out.per_quote_failures = failures;
  out.denominators = {
    evaluated_quotes: out.evaluated_quotes,
    skipped_empty_expected: out.skipped_empty_expected,
    note: "Mean Recall@K averages quotes with a non-empty expected Theme set. Zero-theme quotes are skipped and are not scored as perfect recall.",
  };
  return out;
}
