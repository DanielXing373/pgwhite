import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { resolveRepoPath } from "./io.mjs";

export function resolveRunDir(repoRoot, runsDir, runId) {
  if (!runId || !/^[A-Za-z0-9._@+=-]+$/.test(runId)) {
    throw new Error(
      `Invalid run_id "${runId}". Use letters, numbers, . _ - @ + = only.`,
    );
  }
  return resolveRepoPath(repoRoot, join(runsDir, runId));
}

/**
 * Refuse to overwrite a completed run (manifest.json present).
 */
export function assertRunNotCompleted(runDir, { allowOverwrite = false } = {}) {
  const manifestPath = join(runDir, "manifest.json");
  if (existsSync(manifestPath) && !allowOverwrite) {
    throw new Error(
      `Refusing to overwrite completed run at ${runDir} (manifest.json exists). ` +
        `Create a new run_id for materially different configuration.`,
    );
  }
}

export function writeRunArtifacts(runDir, {
  manifest,
  run,
  summaryMarkdown,
  analysisStub,
}) {
  mkdirSync(runDir, { recursive: true });
  writeFileSync(
    join(runDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(runDir, "run.json"),
    `${JSON.stringify(run, null, 2)}\n`,
    "utf8",
  );
  if (summaryMarkdown != null) {
    writeFileSync(join(runDir, "summary.md"), summaryMarkdown, "utf8");
  }
  if (analysisStub != null) {
    writeFileSync(
      join(runDir, "analysis.json"),
      `${JSON.stringify(analysisStub, null, 2)}\n`,
      "utf8",
    );
  }
}

export function readRunManifest(runDir) {
  return JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8"));
}

export function buildAnalysisStub(results) {
  return {
    schema_version: "retrieval-analysis.v1",
    notes:
      "Post-hoc human analysis only. Do not overwrite run.json raw outputs.",
    categories: {
      retrieval_failure:
        "Expected Tag exists in library but ranks poorly / outside Top-20.",
      taxonomy_gap:
        "Important concept appears missing from the Theme library.",
      benchmark_ambiguity:
        "Expected Tag itself is debatable or abstraction level unclear.",
    },
    quotes: results.map((r) => ({
      quote_id: r.quote_id,
      classification: null,
      analyst_notes: "",
      expected_theme_ids: r.expected_theme_ids,
      ranks_of_expected: r.ranks_of_expected,
    })),
  };
}

export function renderSummaryMarkdown(run) {
  const m = run.aggregate_metrics || {};
  const lines = [
    `# Retrieval run \`${run.run_id}\``,
    "",
    `- representation: **${run.representation}**`,
    `- provider: \`${run.embedding_provider?.provider_id}\` / ${run.embedding_provider?.model_name}`,
    `- git: \`${run.git_commit_sha ?? "unknown"}\``,
    `- tag library: ${run.tag_library_version} (\`${String(run.tag_library_hash).slice(0, 12)}…\`)`,
    `- benchmark: ${run.benchmark_version} (\`${String(run.benchmark_hash).slice(0, 12)}…\`)`,
    "",
    "## Aggregate Recall",
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| evaluated quotes | ${m.evaluated_quotes ?? 0} |`,
    `| skipped (empty expected) | ${m.skipped_empty_expected ?? 0} |`,
    `| mean Recall@5 | ${fmt(m.mean_recall_at_5)} |`,
    `| mean Recall@10 | ${fmt(m.mean_recall_at_10)} |`,
    `| mean Recall@20 | ${fmt(m.mean_recall_at_20)} |`,
    "",
    "## Per-Quote",
    "",
  ];
  for (const r of run.results) {
    const r5 = r.recall_at?.[5];
    lines.push(
      `### ${r.quote_id}`,
      "",
      `- expected: ${JSON.stringify(r.expected_theme_labels ?? r.expected_theme_ids)}`,
      `- Recall@5/10/20: ${fmt(r.recall_at?.[5]?.recall)} / ${fmt(r.recall_at?.[10]?.recall)} / ${fmt(r.recall_at?.[20]?.recall)}`,
      `- deterministic hits: ${(r.deterministic_hits || [])
        .map((h) => `${h.canonical_zh}(${h.match_type}:${h.matched_surface})`)
        .join(", ") || "(none)"}`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

function fmt(x) {
  if (x == null) return "n/a";
  if (typeof x === "number") return x.toFixed(4);
  return String(x);
}
