import { readJsonFile, resolveRepoPath, sha256File } from "../../../runner/src/io.mjs";
import { indexThemesById } from "../../../runner/src/tagLibrary.mjs";

export function loadRetrievalArtifact(repoRoot, relativeOrAbsolute) {
  const path = resolveRepoPath(repoRoot, relativeOrAbsolute);
  const run = readJsonFile(path);
  if (run.schema_version !== "formal-study-run.v1" || run.stage !== "retrieval") {
    throw new Error(`Retrieval artifact must be a formal retrieval run: ${path}`);
  }
  if (!Array.isArray(run.results) || run.results.length < 1) {
    throw new Error(`Retrieval artifact has no results: ${path}`);
  }
  return { path, sha256: sha256File(path), run };
}

export function assertRequiredRetrieval(run, required, { sha256 } = {}) {
  if (!required) return;
  if (required.run_id && run.run_id !== required.run_id) {
    throw new Error(
      `STOP: retrieval run_id is ${JSON.stringify(run.run_id)}, required ${JSON.stringify(required.run_id)}.`,
    );
  }
  if (required.artifact_sha256) {
    if (!sha256 || sha256 !== required.artifact_sha256) {
      throw new Error(
        `STOP: retrieval artifact SHA-256 is ${sha256}, required ${required.artifact_sha256}.`,
      );
    }
  }
  if (
    required.effective_config_sha256
    && run.effective_config_sha256 !== required.effective_config_sha256
  ) {
    throw new Error(
      `STOP: retrieval effective_config_sha256 is ${run.effective_config_sha256}, required ${required.effective_config_sha256}.`,
    );
  }
  const checks = [
    ["representation", run.representation],
    ["instruction_mode", run.instruction_mode],
    ["similarity", run.similarity],
    ["normalize_embeddings", run.normalize_embeddings],
    ["reranker", run.reranker ?? null],
    ["active_theme_count", run.active_theme_count],
  ];
  for (const [key, actual] of checks) {
    if (!Object.hasOwn(required, key)) continue;
    if (actual !== required[key]) {
      throw new Error(
        `STOP: retrieval artifact ${key} is ${JSON.stringify(actual)}, required ${JSON.stringify(required[key])}.`,
      );
    }
  }
  if (required.embedding_model) {
    const model = run.embedding_provider?.model_name
      ?? run.embedding_provider?.model_identifier
      ?? run.effective_config?.provider?.model
      ?? null;
    if (model !== required.embedding_model) {
      throw new Error(
        `STOP: retrieval artifact embedding model is ${model}, required ${required.embedding_model}.`,
      );
    }
  }
  if (required.store_full_ranking === true) {
    for (const row of run.results) {
      if (!Array.isArray(row.ranking) || row.ranking.length !== (required.active_theme_count ?? row.ranking.length)) {
        throw new Error(`STOP: retrieval artifact is missing a full ranking for ${row.quote_id}.`);
      }
    }
  }
}

function selectorCandidate(theme, item, includeAliases) {
  const candidate = {
    id: theme.id,
    canonical_zh: theme.canonical_zh,
    definition: theme.definition,
    retrieval_rank: item.rank,
    similarity: item.similarity,
    representation_text: item.representation_text ?? null,
  };
  if (includeAliases) candidate.aliases = [...theme.aliases];
  return candidate;
}

export function candidatesForQuotes({ retrievalRun, quotes, themes, candidateK, includeAliases }) {
  const k = Number(candidateK);
  if (!Number.isInteger(k) || k < 1) {
    throw new Error(`candidate_k must be a positive integer, got ${candidateK}`);
  }
  const quoteIds = quotes.map((quote) => quote.quote_id);
  if (new Set(quoteIds).size !== quoteIds.length) {
    throw new Error("Benchmark quote IDs must be unique. Refusing to silently slice the retrieval run.");
  }
  const byId = indexThemesById(themes);
  const byQuote = new Map(retrievalRun.results.map((row) => [row.quote_id, row]));
  return quotes.map((quote) => {
    const row = byQuote.get(quote.quote_id);
    if (!row) {
      throw new Error(`Retrieval artifact has no ranking for ${quote.quote_id}`);
    }
    if (row.text_zh !== quote.text_zh) {
      throw new Error(`Quote text mismatch for ${quote.quote_id}`);
    }
    const artifactIds = [...(row.expected_theme_ids ?? [])].sort();
    const benchmarkIds = [...(quote.expected_theme_ids ?? [])].sort();
    if (artifactIds.join("\n") !== benchmarkIds.join("\n")) {
      throw new Error(`Expected Theme IDs in the retrieval artifact differ for ${quote.quote_id}`);
    }
    if (!Array.isArray(row.ranking) || row.ranking.length < k) {
      throw new Error(`Retrieval artifact ranking for ${quote.quote_id} is shorter than candidate_k=${k}`);
    }
    const top = row.ranking.slice(0, k);
    if (top.length !== k) {
      throw new Error(`Expected ${k} candidates for ${quote.quote_id}, got ${top.length}`);
    }
    const ids = top.map((item) => item.tag_id);
    if (new Set(ids).size !== ids.length) {
      throw new Error(`Duplicate candidate Theme IDs for ${quote.quote_id}`);
    }
    const candidates = top.map((item) => {
      const theme = byId.get(item.tag_id);
      if (!theme) throw new Error(`Candidate ${item.tag_id} is not an active Theme`);
      return selectorCandidate(theme, item, includeAliases === true);
    });
    return {
      quote_id: quote.quote_id,
      text_zh: quote.text_zh,
      expected_theme_ids: [...(quote.expected_theme_ids ?? [])],
      expected_theme_labels: [...(quote.expected_theme_labels ?? [])],
      zero_theme: (quote.expected_theme_ids ?? []).length === 0,
      candidates,
    };
  });
}
