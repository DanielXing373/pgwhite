export function selectBenchmarkQuotes(quotes, quoteIds) {
  if (quoteIds == null) return quotes;
  if (!Array.isArray(quoteIds) || quoteIds.length === 0) {
    throw new Error("STOP: quote_ids must be a non-empty array when present.");
  }
  if (new Set(quoteIds).size !== quoteIds.length) {
    throw new Error("STOP: quote_ids contains duplicates.");
  }
  const byId = new Map(quotes.map((quote) => [quote.quote_id, quote]));
  return quoteIds.map((id) => {
    const quote = byId.get(id);
    if (!quote) {
      throw new Error(`STOP: quote_id ${id} is not in the loaded benchmark.`);
    }
    return quote;
  });
}
