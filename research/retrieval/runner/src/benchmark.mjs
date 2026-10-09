import { readJsonFile, resolveRepoPath, sha256File } from "./io.mjs";
import { indexThemesByCanonical, indexThemesById } from "./tagLibrary.mjs";

export function loadBenchmark(repoRoot, relativePath) {
  const path = resolveRepoPath(repoRoot, relativePath);
  const data = readJsonFile(path);
  if (data.schema_version !== "retrieval-benchmark.v1") {
    throw new Error(
      `Unexpected benchmark schema_version: ${data.schema_version}`,
    );
  }
  if (!data.benchmark_version || typeof data.benchmark_version !== "string") {
    throw new Error("benchmark_version is required");
  }
  if (!Array.isArray(data.quotes) || data.quotes.length < 1) {
    throw new Error("benchmark quotes[] must be a non-empty array");
  }
  if (data.exploratory != null && typeof data.exploratory !== "boolean") {
    throw new Error("exploratory must be a boolean when present");
  }
  for (const q of data.quotes) {
    if (!q.quote_id || typeof q.quote_id !== "string") {
      throw new Error("Each quote requires quote_id");
    }
    if (!q.text_zh || typeof q.text_zh !== "string") {
      throw new Error(`Quote ${q.quote_id}: text_zh required`);
    }
    if (q.expected_theme_ids != null && !Array.isArray(q.expected_theme_ids)) {
      throw new Error(`Quote ${q.quote_id}: expected_theme_ids must be array`);
    }
    if (
      q.expected_theme_labels != null &&
      !Array.isArray(q.expected_theme_labels)
    ) {
      throw new Error(`Quote ${q.quote_id}: expected_theme_labels must be array`);
    }
  }
  return {
    path,
    hash: sha256File(path),
    data,
  };
}

/**
 * Resolve expected Theme IDs for a Quote against the active Theme library.
 * Labels are resolved only to active Themes; unknown labels fail loudly.
 */
export function resolveExpectedThemeIds(quote, activeThemes) {
  const byId = indexThemesById(activeThemes);
  const byLabel = indexThemesByCanonical(activeThemes);
  const ids = new Set();

  for (const id of quote.expected_theme_ids ?? []) {
    if (!byId.has(id)) {
      throw new Error(
        `Quote ${quote.quote_id}: expected_theme_id not in active Themes: ${id}`,
      );
    }
    ids.add(id);
  }
  for (const label of quote.expected_theme_labels ?? []) {
    const tag = byLabel.get(label);
    if (!tag) {
      throw new Error(
        `Quote ${quote.quote_id}: expected_theme_label not in active Themes: ${label}`,
      );
    }
    ids.add(tag.id);
  }
  return [...ids].sort();
}
