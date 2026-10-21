/** Nearest-rank percentile. p is 0–100. Empty input returns null. */
export function percentile(sortedAscending, p) {
  if (!sortedAscending.length) return null;
  const rank = Math.ceil((p / 100) * sortedAscending.length);
  const index = Math.min(sortedAscending.length, Math.max(1, rank)) - 1;
  return sortedAscending[index];
}

export function summarizeLatency(samplesMs, { throughputMode }) {
  if (throughputMode !== "sequential" && throughputMode !== "concurrent") {
    throw new Error(`throughput_mode must be sequential|concurrent, got ${throughputMode}`);
  }
  const samples = samplesMs
    .filter((value) => Number.isFinite(value) && value >= 0)
    .slice()
    .sort((a, b) => a - b);
  const total = samples.length === 0 ? null : samples.reduce((sum, value) => sum + value, 0);
  const summary = {
    throughput_mode: throughputMode,
    count: samples.length,
    total_ms: total,
    mean_ms: samples.length === 0 ? null : total / samples.length,
    p50_ms: percentile(samples, 50),
    p95_ms: percentile(samples, 95),
  };
  if (throughputMode === "sequential") {
    return { sequential: summary, concurrent: null };
  }
  return { sequential: null, concurrent: summary };
}
