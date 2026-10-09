/**
 * Calibration-set validation for PGWhite 1.42.
 * Reuses active Theme library loading; does not invent Themes or call models.
 */
import { loadBenchmark } from "./benchmark.mjs";
import {
  loadTagLibrary,
  selectActiveThemes,
  indexThemesByCanonical,
  indexThemesById,
} from "./tagLibrary.mjs";

/**
 * @typedef {object} ValidationIssue
 * @property {"error"|"warning"} severity
 * @property {string} code
 * @property {string} message
 * @property {string} [quote_id]
 */

/**
 * Validate a calibration (or candidate) benchmark against the active Theme library.
 *
 * Rules:
 * - duplicate quote_id → error
 * - empty/whitespace text_zh → error
 * - duplicate expected_theme_ids within a quote → error
 * - expected_theme_id must exist in active Themes → error
 * - expected_theme_label must exist as active canonical → error
 * - when both ids and labels are provided, they must agree as the same set → error
 * - draft calibration may have empty quotes[] (scaffold) → warning only
 * - frozen calibration must have quotes and each quote should have ≥1 expected Theme → error if missing
 */
export function validateCalibrationBenchmark({
  repoRoot,
  benchmarkPath,
  tagLibraryPath = "research/tag-library/data/library/atomic-tag-library.v1.json",
  activeStatus = "active_candidate",
  requireCalibrationFlag = true,
}) {
  /** @type {ValidationIssue[]} */
  const issues = [];
  const loadedBench = loadBenchmark(repoRoot, benchmarkPath, {
    allowEmptyQuotes: true,
  });
  const data = loadedBench.data;

  if (requireCalibrationFlag && data.calibration !== true) {
    issues.push({
      severity: "error",
      code: "not_calibration",
      message: "Fixture must set calibration=true for calibration validation.",
    });
  }
  if (data.exploratory === true) {
    issues.push({
      severity: "error",
      code: "exploratory_conflict",
      message: "Calibration fixtures must not set exploratory=true.",
    });
  }

  const status = data.status ?? "draft";
  const quotes = data.quotes ?? [];

  if (quotes.length === 0) {
    if (status === "draft") {
      issues.push({
        severity: "warning",
        code: "draft_empty",
        message:
          "Calibration scaffold has empty quotes[]. Awaiting manual population (~20–30 Quotes).",
      });
    } else {
      issues.push({
        severity: "error",
        code: "empty_quotes",
        message: `Calibration status=${status} requires a non-empty quotes[].`,
      });
    }
  }

  const loadedLib = loadTagLibrary(repoRoot, tagLibraryPath);
  const themes = selectActiveThemes(loadedLib.library, { activeStatus });
  const byId = indexThemesById(themes);
  const byLabel = indexThemesByCanonical(themes);

  const seenQuoteIds = new Set();
  for (const q of quotes) {
    const qid = String(q.quote_id ?? "").trim();
    if (!qid) {
      issues.push({
        severity: "error",
        code: "missing_quote_id",
        message: "quote_id is required and must be non-empty.",
      });
      continue;
    }
    if (seenQuoteIds.has(qid)) {
      issues.push({
        severity: "error",
        code: "duplicate_quote_id",
        quote_id: qid,
        message: `Duplicate quote_id: ${qid}`,
      });
    }
    seenQuoteIds.add(qid);

    const text = q.text_zh;
    if (typeof text !== "string" || !text.trim()) {
      issues.push({
        severity: "error",
        code: "empty_text",
        quote_id: qid,
        message: `Quote ${qid}: text_zh must be a non-empty string.`,
      });
    }

    const ids = q.expected_theme_ids ?? [];
    const labels = q.expected_theme_labels ?? [];
    if (!Array.isArray(ids)) {
      issues.push({
        severity: "error",
        code: "bad_expected_ids",
        quote_id: qid,
        message: `Quote ${qid}: expected_theme_ids must be an array.`,
      });
      continue;
    }
    if (!Array.isArray(labels)) {
      issues.push({
        severity: "error",
        code: "bad_expected_labels",
        quote_id: qid,
        message: `Quote ${qid}: expected_theme_labels must be an array.`,
      });
      continue;
    }

    const idSeen = new Set();
    for (const id of ids) {
      if (idSeen.has(id)) {
        issues.push({
          severity: "error",
          code: "duplicate_expected_id",
          quote_id: qid,
          message: `Quote ${qid}: duplicate expected_theme_id ${id}`,
        });
      }
      idSeen.add(id);
      if (!byId.has(id)) {
        issues.push({
          severity: "error",
          code: "unknown_expected_id",
          quote_id: qid,
          message: `Quote ${qid}: expected_theme_id not in active Themes: ${id}`,
        });
      }
    }

    const labelSeen = new Set();
    for (const label of labels) {
      if (labelSeen.has(label)) {
        issues.push({
          severity: "error",
          code: "duplicate_expected_label",
          quote_id: qid,
          message: `Quote ${qid}: duplicate expected_theme_label ${label}`,
        });
      }
      labelSeen.add(label);
      if (!byLabel.has(label)) {
        issues.push({
          severity: "error",
          code: "unknown_expected_label",
          quote_id: qid,
          message: `Quote ${qid}: expected_theme_label not in active Themes: ${label}`,
        });
      }
    }

    // ID ↔ canonical label agreement when both sides are provided.
    if (ids.length > 0 && labels.length > 0) {
      const labelsFromIds = new Set(
        ids.filter((id) => byId.has(id)).map((id) => byId.get(id).canonical_zh),
      );
      const idsFromLabels = new Set(
        labels.filter((l) => byLabel.has(l)).map((l) => byLabel.get(l).id),
      );
      for (const label of labelsFromIds) {
        if (!labelSeen.has(label)) {
          issues.push({
            severity: "error",
            code: "id_label_mismatch",
            quote_id: qid,
            message: `Quote ${qid}: expected_theme_ids imply label ${label} missing from expected_theme_labels.`,
          });
        }
      }
      for (const id of idsFromLabels) {
        if (!idSeen.has(id)) {
          issues.push({
            severity: "error",
            code: "id_label_mismatch",
            quote_id: qid,
            message: `Quote ${qid}: expected_theme_labels imply id ${id} missing from expected_theme_ids.`,
          });
        }
      }
    }

    if (status === "frozen" && ids.length === 0 && labels.length === 0) {
      issues.push({
        severity: "error",
        code: "frozen_missing_expected",
        quote_id: qid,
        message: `Quote ${qid}: frozen calibration requires expected Themes.`,
      });
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return {
    ok: errors.length === 0,
    status,
    calibration: data.calibration === true,
    benchmark_version: data.benchmark_version,
    benchmark_hash: loadedBench.hash,
    tag_library_version: loadedLib.library_version,
    tag_library_hash: loadedLib.hash,
    active_theme_count: themes.length,
    quote_count: quotes.length,
    issues,
    errors,
    warnings,
  };
}

export function assertCalibrationValid(result) {
  if (!result.ok) {
    const detail = result.errors
      .map((e) => `- [${e.code}] ${e.message}`)
      .join("\n");
    throw new Error(`Calibration validation failed:\n${detail}`);
  }
  return result;
}
