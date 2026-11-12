import { normalizeForMatch } from "./util.mjs";

function extractJson(text) {
  const raw = String(text ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    // Some json_object providers wrap the object in a code fence.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Validate one response against the quotes it was asked about.
 *
 * A bad tag (unknown code, wrong dimension, not a candidate, evidence not found in the
 * quotation) is dropped and counted; the quote's other tags stay. Nothing is repaired.
 * One normalisation only: a tag written as its exact label instead of its code is mapped
 * back to the code (same dimension, exact match) and marked code_from_label.
 * A quote is "invalid" only when its whole result is unusable (malformed JSON, missing row).
 */
export function parseAnnotationResponse(text, {
  quotes,
  library,
  dimensions,
  evidence,
  themeScope = "full",
  candidatesByQuote = null,
}) {
  const parsed = extractJson(text);
  const rows = Array.isArray(parsed?.results) ? parsed.results : null;
  if (!rows) {
    return quotes.map((quote) => ({
      quote_id: quote.quote_id,
      status: "invalid",
      reason: "malformed_json",
      tags: null,
      dropped: [],
    }));
  }
  const labelIndex = Object.fromEntries(dimensions.map((dimension) => [
    dimension,
    new Map(library.dimensions[dimension].map((tag) => [tag.label, tag])),
  ]));
  const byN = new Map();
  for (const row of rows) {
    const n = Number(row?.n);
    if (Number.isInteger(n) && !byN.has(n)) byN.set(n, row);
  }
  return quotes.map((quote, index) => {
    const row = byN.get(index + 1);
    if (!row) {
      return { quote_id: quote.quote_id, status: "invalid", reason: "missing_result", tags: null, dropped: [] };
    }
    const haystack = normalizeForMatch(quote.text_zh);
    const tags = {};
    const dropped = [];
    for (const dimension of dimensions) {
      const items = row[dimension];
      if (!Array.isArray(items)) {
        return { quote_id: quote.quote_id, status: "invalid", reason: `missing_${dimension}`, tags: null, dropped: [] };
      }
      const allowed = dimension === "theme" && themeScope !== "full"
        ? new Set(candidatesByQuote?.get(quote.quote_id) ?? [])
        : null;
      const seen = new Set();
      tags[dimension] = [];
      for (const item of items) {
        let code = typeof item === "string" ? item : item?.c;
        const quoteEvidence = typeof item === "object" && item !== null ? item.e ?? null : null;
        let tag = library.byCode.get(code);
        let fromLabel = false;
        if (!tag && typeof code === "string") {
          // 没有 schema 约束的接口有时直接写标签名（“比喻”）而不是编号（R01）。
          // 只做同一维度内的精确匹配，映射回编号；不猜近义词，其余校验照常。
          tag = labelIndex[dimension].get(code.trim()) ?? null;
          fromLabel = Boolean(tag);
          if (tag) code = tag.code;
        }
        let reason = null;
        if (!tag) reason = "unknown_code";
        else if (tag.dimension !== dimension) reason = "wrong_dimension";
        else if (allowed && !allowed.has(code)) reason = "not_a_candidate";
        else if (seen.has(code)) reason = "duplicate";
        else if (evidence) {
          const needle = normalizeForMatch(quoteEvidence);
          if (!needle) reason = "evidence_missing";
          else if (!haystack.includes(needle)) reason = "evidence_not_in_quote";
        }
        if (reason) {
          dropped.push({ dimension, code: code ?? null, evidence: quoteEvidence, reason });
          continue;
        }
        seen.add(code);
        tags[dimension].push({
          code,
          tag_id: tag.id,
          label: tag.label,
          evidence: evidence ? quoteEvidence : null,
          ...(fromLabel ? { code_from_label: true } : {}),
        });
      }
    }
    return { quote_id: quote.quote_id, status: "valid", reason: null, tags, dropped };
  });
}
