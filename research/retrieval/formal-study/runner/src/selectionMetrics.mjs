function unique(ids) {
  return [...new Set(ids ?? [])];
}

export function scoreSelectionQuote({ expectedIds, selectedIds, validationStatus }) {
  const valid = validationStatus === "valid";
  const expected = unique(expectedIds);
  const selected = valid ? unique(selectedIds) : [];
  const expectedSet = new Set(expected);
  const selectedSet = new Set(selected);
  const tp = [...selectedSet].filter((id) => expectedSet.has(id));
  const fp = [...selectedSet].filter((id) => !expectedSet.has(id));
  const fn = [...expectedSet].filter((id) => !selectedSet.has(id));
  const precision = !valid || selectedSet.size === 0 ? null : tp.length / selectedSet.size;
  const recall = !valid || expectedSet.size === 0 ? null : tp.length / expectedSet.size;
  let f1 = null;
  if (precision != null && recall != null) {
    f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  }
  const exact = valid
    && selectedSet.size === expectedSet.size
    && [...expectedSet].every((id) => selectedSet.has(id));
  return {
    valid,
    precision,
    recall,
    f1,
    exact_match: valid ? exact : false,
    zero_theme_expected: expectedSet.size === 0,
    zero_theme_correct: expectedSet.size === 0 ? valid && selectedSet.size === 0 : null,
    selected_count: valid ? selectedSet.size : null,
    tp: valid ? tp.length : 0,
    fp: valid ? fp.length : 0,
    fn: valid ? fn.length : 0,
  };
}

function mean(rows, key) {
  if (rows.length === 0) return null;
  return rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
}

export function aggregateSelection(quotes) {
  const notRun = quotes.filter((quote) => quote.validationStatus === "not_run").length;
  const attemptedQuotes = quotes.filter((quote) => quote.validationStatus !== "not_run");
  const scored = attemptedQuotes.map((quote) => scoreSelectionQuote(quote));
  const valid = scored.filter((row) => row.valid);
  const invalid = scored.filter((row) => !row.valid);
  const microTp = valid.reduce((sum, row) => sum + row.tp, 0);
  const microFp = valid.reduce((sum, row) => sum + row.fp, 0);
  const microFn = valid.reduce((sum, row) => sum + row.fn, 0);
  const microPrecision = microTp + microFp === 0 ? null : microTp / (microTp + microFp);
  const microRecall = microTp + microFn === 0 ? null : microTp / (microTp + microFn);
  let microF1 = null;
  if (microPrecision != null && microRecall != null) {
    microF1 = microPrecision + microRecall === 0
      ? 0
      : (2 * microPrecision * microRecall) / (microPrecision + microRecall);
  }
  const precisionRows = valid.filter((row) => row.precision != null);
  const recallRows = valid.filter((row) => row.recall != null);
  const f1Rows = valid.filter((row) => row.f1 != null);
  const zeroRows = scored.filter((row) => row.zero_theme_expected);
  const zeroCorrect = zeroRows.filter((row) => row.zero_theme_correct === true).length;
  const exactValid = valid.filter((row) => row.exact_match).length;
  const exactAll = scored.filter((row) => row.exact_match).length;
  return {
    quotes: quotes.length,
    not_run_quotes: notRun,
    attempted_quotes: attemptedQuotes.length,
    valid_quotes: valid.length,
    invalid_quotes: invalid.length,
    output_validity_rate: attemptedQuotes.length === 0 ? null : valid.length / attemptedQuotes.length,
    invalid_output_rate: attemptedQuotes.length === 0 ? null : invalid.length / attemptedQuotes.length,
    micro: {
      tp: microTp,
      fp: microFp,
      fn: microFn,
      precision: microPrecision,
      recall: microRecall,
      f1: microF1,
      precision_denominator: microTp + microFp,
      recall_denominator: microTp + microFn,
    },
    macro: {
      precision: mean(precisionRows, "precision"),
      precision_quotes: precisionRows.length,
      recall: mean(recallRows, "recall"),
      recall_quotes: recallRows.length,
      f1: mean(f1Rows, "f1"),
      f1_quotes: f1Rows.length,
    },
    exact_match_rate_valid_only: valid.length === 0 ? null : exactValid / valid.length,
    exact_match_valid_denominator: valid.length,
    exact_match_rate_all_quotes: attemptedQuotes.length === 0 ? null : exactAll / attemptedQuotes.length,
    exact_match_all_denominator: attemptedQuotes.length,
    zero_theme_accuracy: zeroRows.length === 0 ? null : zeroCorrect / zeroRows.length,
    zero_theme_denominator: zeroRows.length,
    zero_theme_correct: zeroCorrect,
    average_selected_theme_count: valid.length === 0
      ? null
      : valid.reduce((sum, row) => sum + row.selected_count, 0) / valid.length,
    average_selected_denominator: valid.length,
    notes: [
      "Per-quote precision is null when the selector returns no Themes, including a correct empty selection. That null is not treated as 1.",
      "Per-quote recall is null when the expected set is empty. That null is not treated as 1.",
      "Macro averages omit null per-quote scores. Micro precision and recall are null when their pooled denominators are zero.",
      "Invalid outputs are outside the micro and macro pools. They are included in invalid_output_rate and count as not exact in exact_match_rate_all_quotes.",
    ],
  };
}
