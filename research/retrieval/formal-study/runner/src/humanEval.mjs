const FORBIDDEN_PUBLIC_KEYS = new Set([
  "model_id",
  "model",
  "provider",
  "provider_id",
  "run_id",
  "experiment_id",
  "usage",
  "cost",
  "latency_ms",
  "expected_theme_ids",
  "expected_theme_labels",
  "gold",
  "aggregate_metrics",
  "micro",
  "precision",
  "recall",
]);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleInPlace(items, rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function selectedThemesFromResult(row) {
  const byId = new Map((row.candidates ?? []).map((candidate) => [candidate.id, candidate]));
  const ids = Array.isArray(row.selected_theme_ids) ? row.selected_theme_ids : [];
  return ids.map((id) => {
    const candidate = byId.get(id);
    return {
      label: candidate?.canonical_zh ?? id,
      definition: candidate?.definition ?? "",
    };
  });
}

function walkKeys(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkKeys(item, visit);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      visit(key);
      walkKeys(child, visit);
    }
  }
}

function assertPublicClean(value, label) {
  walkKeys(value, (key) => {
    if (FORBIDDEN_PUBLIC_KEYS.has(key) || /expected_theme|gold_label|model_id|run_id/i.test(key)) {
      throw new Error(`STOP: human-eval public export leaked key ${key} in ${label}.`);
    }
  });
  const metadata = JSON.stringify({
    schema_version: value.schema_version,
    experiment_batch: value.experiment_batch,
    sample_ids: value.samples?.map((sample) => sample.sample_id),
  });
  if (/openai|gpt-5|provider|usd|token usage/i.test(metadata)) {
    throw new Error(`STOP: human-eval public metadata leaked model identity in ${label}.`);
  }
}

export function buildBlindedHumanEval({
  runs,
  seed,
  experimentBatch = "EL",
}) {
  if (!Number.isInteger(seed)) {
    throw new Error("STOP: human-eval seed must be an integer.");
  }
  if (!Array.isArray(runs) || runs.length === 0) {
    throw new Error("STOP: human-eval requires completed run artifacts.");
  }
  const byQuote = new Map();
  for (const run of runs) {
    if (!run?.results?.length) {
      throw new Error("STOP: run is missing selector results; refusing to fabricate samples.");
    }
    for (const row of run.results) {
      if (row.validation_status === "not_run") continue;
      const quoteId = row.quote_id;
      if (!byQuote.has(quoteId)) byQuote.set(quoteId, []);
      byQuote.get(quoteId).push({ run, row });
    }
  }
  const quoteIds = shuffleInPlace([...byQuote.keys()], mulberry32(seed));
  const samples = [];
  const mapping = [];
  let n = 0;
  for (const quoteId of quoteIds) {
    const group = shuffleInPlace([...byQuote.get(quoteId)], mulberry32(seed + n + 1));
    for (const { run, row } of group) {
      n += 1;
      const sampleId = `EL-H-${String(n).padStart(4, "0")}`;
      const selectedThemes = selectedThemesFromResult(row);
      samples.push({
        sample_id: sampleId,
        text_zh: row.text_zh,
        selected_themes: selectedThemes,
        selection_status: row.validation_status,
      });
      mapping.push({
        sample_id: sampleId,
        quote_id: quoteId,
        model_id: run.selector_provider?.model_id ?? run.effective_config?.model_id,
        provider_id: run.selector_provider?.provider_id ?? run.effective_config?.provider?.id,
        run_id: run.run_id,
        experiment_id: run.experiment_id,
        selected_theme_ids: row.selected_theme_ids,
        validation_status: row.validation_status,
      });
    }
  }
  const publicExport = {
    schema_version: "el-human-eval-public.v1",
    experiment_batch: experimentBatch,
    blinded: true,
    sample_count: samples.length,
    samples,
  };
  const privateMapping = {
    schema_version: "el-human-eval-private.v1",
    experiment_batch: experimentBatch,
    seed,
    sample_count: mapping.length,
    mapping,
  };
  assertPublicClean(publicExport, "public export");
  return { publicExport, privateMapping };
}
