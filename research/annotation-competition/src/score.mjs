import { DIMENSIONS, DIMENSION_ZH } from "./library.mjs";

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

/** Wilson 95% interval for a proportion; null when there is nothing to count. */
export function wilson95(successes, total) {
  if (!total) return null;
  const z = 1.96;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const centre = (p + (z * z) / (2 * total)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominator;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export const UNJUDGED_MODES = ["pending", "acceptable"];

/**
 * Score one run against pooled blind judgments.
 *
 * unjudgedAs decides what a tag without a verdict means:
 *   "pending"    (default) the reviewer has not looked yet; it is left out of every rate.
 *   "acceptable" three-way review: accept = 合适, no verdict = 可接受 (would not delete it),
 *                reject = 明显错误. Only valid when the reviewer saw every pooled tag in one
 *                pack. Rates are then over all produced tags, and 明显错误率 is the headline.
 *
 * 认可率 acceptance = accepted / judged, over the tags the arm produced.
 * 覆盖率 coverage   = accepted tags the arm produced / all tags judged "accept" for those
 *                     quotations from ANY arm. It is relative to the pool, not absolute recall.
 * Invalid quotations contribute no tags, so they lower coverage but not acceptance.
 * 留空正确率: among quotations whose pooled tags in a dimension were all rejected (or there
 *            were none), how often the arm correctly returned nothing.
 */
export function scoreRun({ run, judgments, poolByQuote, unjudgedAs = "pending" }) {
  if (!UNJUDGED_MODES.includes(unjudgedAs)) throw new Error(`STOP: unknown unjudged mode ${unjudgedAs}`);
  const threeWay = unjudgedAs === "acceptable";
  const byDimension = {};
  const quotesWithRejectAny = new Set();
  const overall = { produced: 0, judged: 0, accepted: 0, acceptable: 0, rejected: 0 };
  for (const dimension of run.dimensions) {
    let produced = 0;
    let judged = 0;
    let accepted = 0;
    let acceptable = 0;
    let rejected = 0;
    let poolAccepted = 0;
    let shouldBeEmpty = 0;
    let correctlyEmpty = 0;
    let quotesWithReject = 0;
    const byRank = {};
    for (const row of run.results) {
      const verdicts = judgments[row.quote_id] ?? {};
      const pool = poolByQuote.get(row.quote_id)?.[dimension] ?? [];
      const acceptedInPool = pool.filter((tagId) => verdicts[tagId] === "accept");
      const fullyJudged = threeWay || pool.every((tagId) => verdicts[tagId]);
      poolAccepted += acceptedInPool.length;
      const tags = row.status === "valid" ? row.tags[dimension] ?? [] : [];
      if (fullyJudged && acceptedInPool.length === 0) {
        shouldBeEmpty += 1;
        if (row.status === "valid" && tags.length === 0) correctlyEmpty += 1;
      }
      let rowHasReject = false;
      tags.forEach((tag, index) => {
        produced += 1;
        const verdict = verdicts[tag.tag_id] ?? (threeWay ? "acceptable" : null);
        if (!verdict) return;
        judged += 1;
        const bucket = index < 3 ? String(index + 1) : "4+";
        byRank[bucket] ??= { judged: 0, accepted: 0, acceptable: 0, rejected: 0 };
        byRank[bucket].judged += 1;
        if (verdict === "accept") {
          accepted += 1;
          byRank[bucket].accepted += 1;
        } else if (verdict === "reject") {
          rejected += 1;
          byRank[bucket].rejected += 1;
          rowHasReject = true;
        } else {
          acceptable += 1;
          byRank[bucket].acceptable += 1;
        }
      });
      if (rowHasReject) {
        quotesWithReject += 1;
        quotesWithRejectAny.add(row.quote_id);
      }
    }
    overall.produced += produced;
    overall.judged += judged;
    overall.accepted += accepted;
    overall.acceptable += acceptable;
    overall.rejected += rejected;
    const acceptance = ratio(accepted, judged);
    const coverage = ratio(accepted, poolAccepted);
    byDimension[dimension] = {
      tags_produced: produced,
      tags_judged: judged,
      tags_unjudged: produced - judged,
      tags_accepted: accepted,
      tags_acceptable: acceptable,
      tags_rejected: rejected,
      acceptance,
      acceptance_ci95: wilson95(accepted, judged),
      acceptable_rate: ratio(acceptable, judged),
      reject_rate: ratio(rejected, judged),
      reject_rate_ci95: wilson95(rejected, judged),
      quotes_with_reject: quotesWithReject,
      pool_accepted: poolAccepted,
      coverage,
      f1: acceptance != null && coverage != null && acceptance + coverage > 0
        ? (2 * acceptance * coverage) / (acceptance + coverage)
        : null,
      acceptance_by_rank: Object.fromEntries(
        Object.entries(byRank).map(([rank, value]) => [rank, {
          ...value,
          acceptance: ratio(value.accepted, value.judged),
          reject_rate: ratio(value.rejected, value.judged),
        }]),
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
    unjudged_as: unjudgedAs,
    quotes: total,
    overall: {
      tags_produced: overall.produced,
      tags_judged: overall.judged,
      tags_accepted: overall.accepted,
      tags_acceptable: overall.acceptable,
      tags_rejected: overall.rejected,
      acceptance: ratio(overall.accepted, overall.judged),
      acceptance_ci95: wilson95(overall.accepted, overall.judged),
      acceptable_rate: ratio(overall.acceptable, overall.judged),
      reject_rate: ratio(overall.rejected, overall.judged),
      reject_rate_ci95: wilson95(overall.rejected, overall.judged),
      quotes_with_reject: quotesWithRejectAny.size,
      quotes_with_reject_rate: ratio(quotesWithRejectAny.size, total),
    },
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

const range = (ci) => (ci ? `${(ci[0] * 100).toFixed(1)}–${(ci[1] * 100).toFixed(1)}%` : "—");
const withCount = (rate, count) => (rate == null ? "—" : `${pct(rate)}（${count}）`);

/** Three-way report: accept = 合适, no verdict = 可接受, reject = 明显错误. Sorted by 明显错误率. */
function renderThreeWay(scores) {
  const lines = ["# 盲审计分（三档）", ""];
  lines.push("判定含义：打勾 = 合适；未判 = 可接受（留在库里不会删）；打叉 = 明显错误。各比例的分母是该组合给出的全部标签。", "");
  const byReject = (pick) => (a, b) => (pick(a).reject_rate ?? 2) - (pick(b).reject_rate ?? 2) || (pick(b).acceptance ?? -1) - (pick(a).acceptance ?? -1);
  lines.push("## 合计（全部维度）", "");
  lines.push("| 组合 | 标签数 | 合适 | 可接受 | 明显错误 | 明显错误率 95% 区间 | 含错误的摘抄 | 无效句 | 元/万条 | 秒/万条 |");
  lines.push("| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |");
  for (const score of [...scores].sort(byReject((score) => score.overall))) {
    const o = score.overall;
    lines.push(
      `| ${score.run_id} | ${o.tags_produced} | ${withCount(o.acceptance, o.tags_accepted)} | ${withCount(o.acceptable_rate, o.tags_acceptable)} | ${withCount(o.reject_rate, o.tags_rejected)} | ${range(o.reject_rate_ci95)} | ${o.quotes_with_reject}/${score.quotes} | ${pct(score.invalid_quote_rate)} | ${num(score.cny_per_10k_quotes, 2)} | ${num(score.seconds_per_10k_quotes, 0)} |`,
    );
  }
  lines.push("");
  for (const dimension of DIMENSIONS) {
    const rows = scores.filter((score) => score.dimensions[dimension]);
    if (rows.length === 0) continue;
    rows.sort(byReject((score) => score.dimensions[dimension]));
    lines.push(`## ${DIMENSION_ZH[dimension]}`, "");
    lines.push("| 组合 | 标签数 | 合适 | 可接受 | 明显错误 | 明显错误率 95% 区间 | 覆盖率 | 含错误的摘抄 | 第1/2/3个明显错误率 | 留空正确 |");
    lines.push("| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: |");
    for (const score of rows) {
      const d = score.dimensions[dimension];
      const rank = ["1", "2", "3"].map((key) => pct(d.acceptance_by_rank[key]?.reject_rate)).join(" / ");
      lines.push(
        `| ${score.run_id} | ${d.tags_produced} | ${withCount(d.acceptance, d.tags_accepted)} | ${withCount(d.acceptable_rate, d.tags_acceptable)} | ${withCount(d.reject_rate, d.tags_rejected)} | ${range(d.reject_rate_ci95)} | ${pct(d.coverage)} | ${d.quotes_with_reject}/${score.quotes} | ${rank} | ${d.correctly_empty_quotes}/${d.should_be_empty_quotes} |`,
      );
    }
    lines.push("");
  }
  lines.push(
    "覆盖率 = 该组合给出且被判合适的标签 ÷ 本次所有参赛组合合并后被判合适的标签。它相对于合并标签池，不是绝对召回率。",
    "留空正确：某维度的合并标签池里没有任何被判合适的标签时，该组合是否也没有给标签。",
    "95% 区间为 Wilson 区间，只反映样本量，不反映单人评审的主观偏差。",
    "三档计分只适用于评审一次看到全部候选标签的盲审包；增量补判的包里“未判”不代表“可接受”。",
  );
  return lines.join("\n");
}

export function renderMarkdown(scores) {
  if (scores.length > 0 && scores.every((score) => score.unjudged_as === "acceptable")) return renderThreeWay(scores);
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
