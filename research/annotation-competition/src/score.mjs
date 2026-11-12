import { DIMENSIONS, DIMENSION_ZH } from "./library.mjs";

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * Score one run against pooled blind judgments.
 *
 * 认可率 acceptance = accepted / judged, over the tags the arm produced.
 * 覆盖率 coverage   = accepted tags the arm produced / all tags judged "accept" for those
 *                     quotations from ANY arm. It is relative to the pool, not absolute recall.
 * Invalid quotations contribute no tags, so they lower coverage but not acceptance.
 * 留空正确率: among quotations whose pooled tags in a dimension were all rejected (or there
 *            were none), how often the arm correctly returned nothing.
 */
export function scoreRun({ run, judgments, poolByQuote }) {
  const byDimension = {};
  for (const dimension of run.dimensions) {
    let produced = 0;
    let judged = 0;
    let accepted = 0;
    let poolAccepted = 0;
    let shouldBeEmpty = 0;
    let correctlyEmpty = 0;
    const byRank = {};
    for (const row of run.results) {
      const verdicts = judgments[row.quote_id] ?? {};
      const pool = poolByQuote.get(row.quote_id)?.[dimension] ?? [];
      const acceptedInPool = pool.filter((tagId) => verdicts[tagId] === "accept");
      const fullyJudged = pool.every((tagId) => verdicts[tagId]);
      poolAccepted += acceptedInPool.length;
      const tags = row.status === "valid" ? row.tags[dimension] ?? [] : [];
      if (fullyJudged && acceptedInPool.length === 0) {
        shouldBeEmpty += 1;
        if (row.status === "valid" && tags.length === 0) correctlyEmpty += 1;
      }
      tags.forEach((tag, index) => {
        produced += 1;
        const verdict = verdicts[tag.tag_id];
        if (!verdict) return;
        judged += 1;
        const bucket = index < 3 ? String(index + 1) : "4+";
        byRank[bucket] ??= { judged: 0, accepted: 0 };
        byRank[bucket].judged += 1;
        if (verdict === "accept") {
          accepted += 1;
          byRank[bucket].accepted += 1;
        }
      });
    }
    const acceptance = ratio(accepted, judged);
    const coverage = ratio(accepted, poolAccepted);
    byDimension[dimension] = {
      tags_produced: produced,
      tags_judged: judged,
      tags_unjudged: produced - judged,
      tags_accepted: accepted,
      acceptance,
      pool_accepted: poolAccepted,
      coverage,
      f1: acceptance != null && coverage != null && acceptance + coverage > 0
        ? (2 * acceptance * coverage) / (acceptance + coverage)
        : null,
      acceptance_by_rank: Object.fromEntries(
        Object.entries(byRank).map(([rank, value]) => [rank, { ...value, acceptance: ratio(value.accepted, value.judged) }]),
      ),
      should_be_empty_quotes: shouldBeEmpty,
      correctly_empty_quotes: correctlyEmpty,
      empty_accuracy: ratio(correctlyEmpty, shouldBeEmpty),
    };
  }
  const total = run.results.length;
  const invalid = run.results.filter((row) => row.status !== "valid").length;
  return {
    run_id: run.run_id,
    arm_id: run.arm_id,
    kind: run.kind,
    dataset_id: run.dataset.id,
    quotes: total,
    invalid_quote_rate: ratio(invalid, total),
    dropped_tags_by_reason: run.summary?.dropped_tags_by_reason ?? {},
    cny_per_10k_quotes: run.summary?.cost?.cny_per_10k_quotes ?? null,
    seconds_per_10k_quotes: run.summary?.speed?.projected_seconds_per_10k_quotes ?? null,
    dimensions: byDimension,
  };
}

/** quote_id -> { dimension: [tag_id] } over every run in the comparison. */
export function buildPool(runs, library) {
  const pool = new Map();
  for (const run of runs) {
    for (const row of run.results) {
      const entry = pool.get(row.quote_id) ?? Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, []]));
      pool.set(row.quote_id, entry);
      if (row.status !== "valid") continue;
      for (const dimension of run.dimensions) {
        for (const tag of row.tags[dimension] ?? []) {
          if (!library.byId.has(tag.tag_id)) throw new Error(`STOP: unknown tag ${tag.tag_id} in ${run.run_id}`);
          if (!entry[dimension].includes(tag.tag_id)) entry[dimension].push(tag.tag_id);
        }
      }
    }
  }
  return pool;
}

const pct = (value) => (value == null ? "—" : `${(value * 100).toFixed(1)}%`);
const num = (value, digits = 1) => (value == null ? "—" : value.toFixed(digits));

export function renderMarkdown(scores) {
  const lines = ["# 盲审计分", ""];
  for (const dimension of DIMENSIONS) {
    const rows = scores.filter((score) => score.dimensions[dimension]);
    if (rows.length === 0) continue;
    rows.sort((a, b) => (b.dimensions[dimension].f1 ?? -1) - (a.dimensions[dimension].f1 ?? -1));
    lines.push(`## ${DIMENSION_ZH[dimension]}`, "");
    lines.push("| 组合 | 认可率 | 覆盖率 | F1 | 标签数 | 未判 | 第1/2/3个认可率 | 留空正确 | 无效句 | 元/万条 | 秒/万条 |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |");
    for (const score of rows) {
      const d = score.dimensions[dimension];
      const rank = ["1", "2", "3"].map((key) => pct(d.acceptance_by_rank[key]?.acceptance)).join(" / ");
      lines.push(
        `| ${score.run_id} | ${pct(d.acceptance)} | ${pct(d.coverage)} | ${num(d.f1, 3)} | ${d.tags_produced} | ${d.tags_unjudged} | ${rank} | ${d.correctly_empty_quotes}/${d.should_be_empty_quotes} | ${pct(score.invalid_quote_rate)} | ${num(score.cny_per_10k_quotes, 2)} | ${num(score.seconds_per_10k_quotes, 0)} |`,
      );
    }
    lines.push("");
  }
  lines.push(
    "覆盖率是相对于本次所有参赛组合的合并标签池，不是绝对召回率；加入新组合后需要补判新标签再重算。",
    "“未判”不为 0 时，认可率只基于已判的标签，先补完盲审再下结论。",
  );
  return lines.join("\n");
}
