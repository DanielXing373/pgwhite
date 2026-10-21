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

export function candidatesForQuotes({ retrievalRun, quotes, themes, candidateK, includeAliases }) {
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
    if (!Array.isArray(row.ranking) || row.ranking.length < 1) {
      throw new Error(`Retrieval artifact is missing a full ranking for ${quote.quote_id}`);
    }
    const top = row.ranking.slice(0, candidateK);
    const candidates = top.map((item) => {
      const theme = byId.get(item.tag_id);
      if (!theme) throw new Error(`Candidate ${item.tag_id} is not an active Theme`);
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
