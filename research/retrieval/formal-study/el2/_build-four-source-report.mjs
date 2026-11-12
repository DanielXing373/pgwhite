/**
 * Build a static EL2 four-source HTML report from frozen Gold, Embedding Top2,
 * and completed Luna/Flash run artifacts. No APIs. Does not write into EL1.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FROZEN } from "../runner/src/freeze.mjs";

const el2Dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(el2Dir, "../../../..");
const outPath = join(el2Dir, "EL2-Four-Source-Theme-Report.html");

function readJson(rel) {
  return JSON.parse(readFileSync(join(repoRoot, rel), "utf8"));
}

function f1(tp, fp, fn) {
  const p = tp + fp === 0 ? null : tp / (tp + fp);
  const r = tp + fn === 0 ? null : tp / (tp + fn);
  if (p == null || r == null || p + r === 0) return { precision: p, recall: r, f1: null, tp, fp, fn };
  return { precision: p, recall: r, f1: 2 * p * r / (p + r), tp, fp, fn };
}

function vsGold(goldIds, predIds) {
  const g = new Set(goldIds ?? []);
  const p = new Set(predIds ?? []);
  let tp = 0;
  for (const id of p) if (g.has(id)) tp += 1;
  return f1(tp, p.size - tp, g.size - tp);
}

function exactSet(a, b) {
  const aa = [...(a ?? [])].slice().sort();
  const bb = [...(b ?? [])].slice().sort();
  return JSON.stringify(aa) === JSON.stringify(bb);
}

function exactOrdered(a, b) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

function jaccard(a, b) {
  const A = new Set(a ?? []);
  const B = new Set(b ?? []);
  const union = new Set([...A, ...B]);
  if (union.size === 0) return 1;
  let inter = 0;
  for (const id of A) if (B.has(id)) inter += 1;
  return inter / union.size;
}

function fmt(n, digits = 3) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

function pct(n, d) {
  if (!d) return "—";
  return `${n}/${d} (${(100 * n / d).toFixed(1)}%)`;
}

const ontology = readJson(FROZEN.ontology.path);
const byTheme = new Map((ontology.themes ?? []).map((theme) => [theme.id, theme]));
const goldDoc = readJson("research/retrieval/formal-study/el2/baselines/human-gold.v1.json");
const embedDoc = readJson("research/retrieval/formal-study/el2/baselines/embedding-top2.v1.json");
const lunaRun = readJson("research/retrieval/formal-study/runs/EL2-GPT6LUNA/run.json");
const flashRun = readJson("research/retrieval/formal-study/runs/EL2-DSFLASH/run.json");

function themeView(id, goldSet) {
  const theme = byTheme.get(id);
  return {
    id,
    label: theme?.canonical_zh ?? id,
    definition: theme?.definition ?? "",
    in_gold: goldSet.has(id),
  };
}

function fromBaseline(row) {
  const goldSet = new Set(row.goldIds ?? []);
  return {
    validation_status: "valid",
    validation_reason: null,
    selected: (row.selected_theme_ids ?? []).map((id) => themeView(id, goldSet)),
    invented: [],
    empty: (row.selected_theme_ids ?? []).length === 0,
  };
}

function fromRun(row, goldIds) {
  const goldSet = new Set(goldIds ?? []);
  const valid = row.validation_status === "valid";
  const ids = valid ? (row.selected_theme_ids ?? []) : [];
  return {
    validation_status: row.validation_status,
    validation_reason: row.validation_reason ?? null,
    selected: ids.map((id) => themeView(id, goldSet)),
    invented: row.invented_theme_ids ?? [],
    parsed: row.parsed_response?.selected_theme_ids ?? [],
    empty: valid && ids.length === 0,
  };
}

const lunaById = new Map(lunaRun.results.map((row) => [row.quote_id, row]));
const flashById = new Map(flashRun.results.map((row) => [row.quote_id, row]));
const embedById = new Map(embedDoc.quotes.map((row) => [row.quote_id, row]));

const quotes = goldDoc.quotes.map((gold, index) => {
  const luna = lunaById.get(gold.quote_id);
  const flash = flashById.get(gold.quote_id);
  const embed = embedById.get(gold.quote_id);
  if (!luna || !flash || !embed) {
    throw new Error(`Missing source for ${gold.quote_id}`);
  }
  return {
    index: index + 1,
    quote_id: gold.quote_id,
    text_zh: gold.text_zh,
    el1_pilot: gold.el1_pilot === true,
    gold_ids: [...(gold.selected_theme_ids ?? [])],
    gold: fromBaseline({ ...gold, goldIds: gold.selected_theme_ids }),
    embed: fromBaseline({ ...embed, goldIds: gold.selected_theme_ids }),
    luna: fromRun(luna, gold.selected_theme_ids),
    flash: fromRun(flash, gold.selected_theme_ids),
    embed_ids: [...(embed.selected_theme_ids ?? [])],
    luna_ids: luna.validation_status === "valid" ? [...(luna.selected_theme_ids ?? [])] : null,
    flash_ids: flash.validation_status === "valid" ? [...(flash.selected_theme_ids ?? [])] : null,
  };
});

function poolVsGold(idKey) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let used = 0;
  for (const q of quotes) {
    const pred = q[idKey];
    if (pred == null) continue;
    used += 1;
    const m = vsGold(q.gold_ids, pred);
    tp += m.tp;
    fp += m.fp;
    fn += m.fn;
  }
  return { ...f1(tp, fp, fn), quotes: used };
}

const vs = {
  embed: poolVsGold("embed_ids"),
  luna: poolVsGold("luna_ids"),
  flash: poolVsGold("flash_ids"),
};

function countExact(idKey) {
  let n = 0;
  let d = 0;
  for (const q of quotes) {
    const pred = q[idKey];
    if (pred == null) continue;
    d += 1;
    if (exactSet(q.gold_ids, pred)) n += 1;
  }
  return { n, d };
}

const bothValid = quotes.filter((q) => q.luna_ids && q.flash_ids);
const lunaFlashExact = bothValid.filter((q) => exactSet(q.luna_ids, q.flash_ids)).length;
const lunaFlashOrdered = bothValid.filter((q) => exactOrdered(q.luna_ids, q.flash_ids)).length;
const lunaFlashJac = bothValid.reduce((s, q) => s + jaccard(q.luna_ids, q.flash_ids), 0) / bothValid.length;
const embedLunaExact = quotes.filter((q) => q.luna_ids && exactSet(q.embed_ids, q.luna_ids)).length;
const embedGoldExact = quotes.filter((q) => exactSet(q.gold_ids, q.embed_ids)).length;
const meanJacEmbedGold = quotes.reduce((s, q) => s + jaccard(q.gold_ids, q.embed_ids), 0) / quotes.length;

const flashInvalid = quotes.filter((q) => q.flash.validation_status !== "valid").length;
const counts = {
  gold: quotes.map((q) => q.gold_ids.length),
  embed: quotes.map((q) => q.embed_ids.length),
  luna: quotes.filter((q) => q.luna_ids).map((q) => q.luna_ids.length),
  flash: quotes.filter((q) => q.flash_ids).map((q) => q.flash_ids.length),
};
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function tagsHtml(view) {
  if (view.validation_status !== "valid") {
    const invented = (view.invented.length ? view.invented : view.parsed).map((id) => esc(id)).join("、") || "—";
    return `<p class="bad">非法输出：${esc(view.validation_status)}${view.validation_reason ? " / " + esc(view.validation_reason) : ""}</p><p class="muted">截断 ID：${invented}</p>`;
  }
  if (view.empty) return `<p class="muted">空选</p>`;
  return view.selected.map((t) => (
    `<div class="tag${t.in_gold ? " hit" : ""}"><strong>${esc(t.label)}</strong>`
    + (t.in_gold ? `<span class="mark">Gold一致</span>` : "")
    + `<p>${esc(t.definition)}</p></div>`
  )).join("");
}

function goldHtml(q) {
  if (!q.gold.selected.length) return `<p class="muted">Gold 空选</p>`;
  return q.gold.selected.map((t) => (
    `<div class="tag gold"><strong>${esc(t.label)}</strong><p>${esc(t.definition)}</p></div>`
  )).join("");
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EL2 四源 Theme 对照（58句）</title>
<style>
body { margin: 0; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; color: #111; background: #fff; line-height: 1.5; }
main { max-width: 1100px; padding: 24px 20px 72px; }
h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 8px; }
h2 { font-size: 1rem; font-weight: 600; margin: 28px 0 8px; }
.note, .muted { color: #555; }
table { border-collapse: collapse; margin: 12px 0 20px; width: 100%; }
th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #f3f3f3; }
.quote { font-size: 1.05rem; margin: 0 0 10px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
@media (min-width: 900px) { .grid { grid-template-columns: 1fr 1fr 1fr 1fr; } }
.cell { border: 1px solid #ccc; padding: 8px; }
.cell h3 { margin: 0 0 8px; font-size: 0.9rem; font-weight: 600; }
.tag { margin: 0 0 8px; }
.tag p { margin: 2px 0 0; font-size: 0.85rem; color: #444; }
.tag.gold { background: #f7f3ea; padding: 4px 6px; }
.tag.hit { background: #eef6ee; padding: 4px 6px; }
.mark { margin-left: 6px; font-size: 0.75rem; color: #2a6; }
.bad { background: #f4f4f4; padding: 4px 6px; }
.pilot { color: #666; font-weight: 400; }
</style>
</head>
<body>
<main>
  <h1>EL2 四源 Theme 对照（n=58）</h1>
  <p class="note">人工 Gold、Embedding Top2、GPT-6 Luna（0–2）、DeepSeek Flash（0–2）。Gold 未截断，可多于 2 个。Gold 是一位读者的标注，不是穷尽真值。对照数字是集合重叠，供浏览，不做生产排名。绿色表示与 Gold 有相同 Theme ID。</p>
  <p class="note">Luna 58/58 合法。Flash 51/58 合法，7 句截断 ID（<code>id_not_in_candidates</code>）。Luna 目录成本约 $0.008；Flash 约 $0.016。</p>

  <h2>相对 Gold 的集合重叠</h2>
  <table>
    <thead><tr><th>来源</th><th>合法输出</th><th>Micro-P</th><th>Micro-R</th><th>Micro-F1</th><th>集合完全一致</th><th>平均 Theme 数</th></tr></thead>
    <tbody>
      <tr><td>人工 Gold</td><td>58/58</td><td>—</td><td>—</td><td>—</td><td>—</td><td>${fmt(mean(counts.gold), 2)}</td></tr>
      <tr><td>Embedding Top2</td><td>58/58</td><td>${fmt(vs.embed.precision)}</td><td>${fmt(vs.embed.recall)}</td><td>${fmt(vs.embed.f1)}</td><td>${pct(embedGoldExact, 58)}</td><td>2.00</td></tr>
      <tr><td>GPT-6 Luna</td><td>58/58</td><td>${fmt(vs.luna.precision)}</td><td>${fmt(vs.luna.recall)}</td><td>${fmt(vs.luna.f1)}</td><td>${pct(countExact("luna_ids").n, 58)}</td><td>${fmt(mean(counts.luna), 2)}</td></tr>
      <tr><td>DeepSeek Flash</td><td>${58 - flashInvalid}/58</td><td>${fmt(vs.flash.precision)}</td><td>${fmt(vs.flash.recall)}</td><td>${fmt(vs.flash.f1)}</td><td>${pct(countExact("flash_ids").n, countExact("flash_ids").d)}</td><td>${fmt(mean(counts.flash), 2)}</td></tr>
    </tbody>
  </table>
  <p class="note">Gold 分布：0 个 ${quotes.filter((q) => q.gold_ids.length === 0).length} 句，1 个 ${quotes.filter((q) => q.gold_ids.length === 1).length}，2 个 ${quotes.filter((q) => q.gold_ids.length === 2).length}，3 个 ${quotes.filter((q) => q.gold_ids.length === 3).length}，4 个 ${quotes.filter((q) => q.gold_ids.length === 4).length}，5 个 ${quotes.filter((q) => q.gold_ids.length === 5).length}。Embedding 固定 2 个。Luna/Flash 最多 2 个，因此相对 Gold 的召回会受上限影响。</p>

  <h2>来源之间的关系</h2>
  <table>
    <thead><tr><th>比较</th><th>结果</th></tr></thead>
    <tbody>
      <tr><td>Gold 与 Embedding 集合完全一致</td><td>${pct(embedGoldExact, 58)}；平均 Jaccard ${fmt(meanJacEmbedGold)}</td></tr>
      <tr><td>Luna 与 Flash 均合法时集合一致</td><td>${pct(lunaFlashExact, bothValid.length)}；顺序也一致 ${pct(lunaFlashOrdered, bothValid.length)}；平均 Jaccard ${fmt(lunaFlashJac)}</td></tr>
      <tr><td>Embedding 与 Luna 集合一致</td><td>${pct(embedLunaExact, quotes.filter((q) => q.luna_ids).length)}</td></tr>
      <tr><td>Luna 相对 Gold 的 Micro-F1</td><td>${fmt(vs.luna.f1)}（高于 Embedding ${fmt(vs.embed.f1)}）</td></tr>
      <tr><td>Flash 相对 Gold 的 Micro-F1</td><td>${fmt(vs.flash.f1)}（仅 51 句合法进入该池）</td></tr>
    </tbody>
  </table>

  ${quotes.map((q) => `
  <h2>${q.index}. <span class="muted">${esc(q.quote_id)}</span>${q.el1_pilot ? ' <span class="pilot">EL1 试点</span>' : ""}</h2>
  <p class="quote">${esc(q.text_zh)}</p>
  <div class="grid">
    <div class="cell"><h3>人工 Gold（${q.gold_ids.length}）</h3>${goldHtml(q)}</div>
    <div class="cell"><h3>Embedding Top2（2）</h3>${tagsHtml(q.embed)}</div>
    <div class="cell"><h3>GPT-6 Luna（${q.luna_ids ? q.luna_ids.length : "非法"}）</h3>${tagsHtml(q.luna)}</div>
    <div class="cell"><h3>DeepSeek Flash（${q.flash_ids ? q.flash_ids.length : "非法"}）</h3>${tagsHtml(q.flash)}</div>
  </div>`).join("")}
</main>
</body>
</html>
`;

writeFileSync(outPath, html, "utf8");
console.log(JSON.stringify({
  quotes: quotes.length,
  flash_invalid: flashInvalid,
  luna_f1: vs.luna.f1,
  flash_f1: vs.flash.f1,
  embed_f1: vs.embed.f1,
  out: outPath,
}, null, 2));
