#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const libraryPath = resolve(
  repoRoot,
  "research/tag-library/data/library/atomic-tag-library.v1.43.json",
);
const sourceBatches = [
  {
    prefix: "batch1",
    label: "first reviewed quote batch",
    path: "research/retrieval/benchmark/fixtures/calib-zh-themes.v1.42.json",
  },
  {
    prefix: "batch2",
    label: "second reviewed quote batch",
    path: "research/retrieval/benchmark/fixtures/quotes-batch2.v1.43-dev.json",
  },
];
const outputPath = resolve(
  repoRoot,
  "research/retrieval/benchmark/fixtures/route-comparison-development.json",
);

const library = JSON.parse(readFileSync(libraryPath, "utf8"));
const activeThemes = library.themes.filter(
  (theme) => theme.dimension === "theme" && theme.status === "active_candidate",
);
const byId = new Map(activeThemes.map((theme) => [theme.id, theme]));
const byCanonical = new Map(
  activeThemes.map((theme) => [theme.canonical_zh, theme]),
);
const byAlias = new Map();
for (const theme of activeThemes) {
  for (const alias of theme.aliases) {
    const matches = byAlias.get(alias) ?? new Set();
    matches.add(theme.id);
    byAlias.set(alias, matches);
  }
}

function resolveExpectedThemes(quote, prefix) {
  const resolved = new Set();
  for (const id of quote.expected_theme_ids ?? []) {
    if (byId.has(id)) resolved.add(id);
  }

  for (const label of quote.expected_theme_labels ?? []) {
    if ([...resolved].some((id) => byId.get(id).canonical_zh === label)) continue;
    const canonical = byCanonical.get(label);
    if (canonical) {
      resolved.add(canonical.id);
      continue;
    }
    const aliasIds = byAlias.get(label);
    if (aliasIds?.size === 1) {
      resolved.add([...aliasIds][0]);
      continue;
    }
    throw new Error(
      `${prefix}/${quote.quote_id}: label ${JSON.stringify(label)} is not a unique active label in ${library.library_version}`,
    );
  }

  return [...resolved].sort().map((id) => byId.get(id));
}

const seenText = new Map();
const quotes = [];
for (const batch of sourceBatches) {
  const source = JSON.parse(readFileSync(resolve(repoRoot, batch.path), "utf8"));
  for (const quote of source.quotes) {
    const normalizedText = quote.text_zh.normalize("NFKC").replace(/\s+/g, "");
    const prior = seenText.get(normalizedText);
    if (prior) {
      throw new Error(
        `Duplicate quote text across batches: ${prior} and ${batch.prefix}/${quote.quote_id}`,
      );
    }
    seenText.set(normalizedText, `${batch.prefix}/${quote.quote_id}`);

    const expected = resolveExpectedThemes(quote, batch.prefix);
    quotes.push({
      quote_id: `${batch.prefix}-${quote.quote_id}`,
      text_zh: quote.text_zh,
      source: quote.source ?? batch.label,
      category: quote.category ?? batch.prefix,
      test_purpose: quote.test_purpose ?? "user_reviewed",
      expected_theme_ids: expected.map((theme) => theme.id),
      expected_theme_labels: expected.map((theme) => theme.canonical_zh),
      ambiguity_flags: quote.ambiguity_flags ?? [],
      notes: quote.notes ?? "User-reviewed expected Themes mapped to current library.",
    });
  }
}

const fixture = {
  schema_version: "retrieval-benchmark.v1",
  benchmark_version: "route-comparison-development",
  created_at: new Date().toISOString(),
  research_only: true,
  calibration: true,
  exploratory: false,
  status: "development",
  notes: [
    "Shared development comparison set assembled from both user-reviewed 29-quote batches; no quote-text overlap.",
    `Expected Theme IDs and labels are resolved against the current ${library.library_version} library (${activeThemes.length} active Themes).`,
    "The second batch informed the current Theme library; these scores compare routes during development and are not an independent accuracy estimate.",
    "Three quotes have no expected Themes; inspect their suggestions separately as potential false positives.",
  ],
  quotes,
};

writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      ok: true,
      benchmark_path: "research/retrieval/benchmark/fixtures/route-comparison-development.json",
      quote_count: quotes.length,
      positive_quotes: quotes.filter((quote) => quote.expected_theme_ids.length > 0).length,
      no_expected_theme_quotes: quotes.filter((quote) => quote.expected_theme_ids.length === 0).length,
      current_library: library.library_version,
      active_theme_count: activeThemes.length,
    },
    null,
    2,
  ),
);
