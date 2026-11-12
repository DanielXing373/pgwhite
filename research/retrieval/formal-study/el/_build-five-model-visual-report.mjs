/**
 * Build EL-Five-Model-Theme-Visual-Report.html from immutable run artifacts.
 * Does not call APIs or write into runs/, archives/, ontology, or gold.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FROZEN, PHASE2_RETRIEVAL } from "../runner/src/freeze.mjs";

const elDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(elDir, "../../../..");
const runsRoot = join(repoRoot, "research/retrieval/formal-study/runs");
const outPath = join(elDir, "EL-Five-Model-Theme-Visual-Report.html");

const MODEL_SPECS = [
  { key: "mini", label: "GPT-5 mini", runId: "EL-P1-GPT5MINI" },
  { key: "gpt52", label: "GPT-5.2", runId: "EL-P1-GPT52" },
  { key: "flash", label: "DeepSeek Flash", runId: "EL-P1-DSFLASH" },
  { key: "pro", label: "DeepSeek Pro", runId: "EL-P1-DSPRO" },
  { key: "luna", label: "GPT-6 Luna", runId: "EL-P1-GPT6LUNA" },
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function thinkingLabel(run) {
  const ds = run.effective_config?.deepseek_request;
  if (ds?.thinking?.type) {
    return `thinking ${ds.thinking.type}`;
  }
  const oai = run.effective_config?.openai_request;
  if (oai?.reasoning_effort) return `reasoning_effort ${oai.reasoning_effort}`;
  return "unavailable";
}

const ontologyById = new Map(
  (readJson(join(repoRoot, FROZEN.ontology.path)).themes ?? []).map((theme) => [theme.id, theme]),
);

function themeFromCandidate(candidates, id) {
  const hit = (candidates ?? []).find((row) => row.id === id);
  const onto = ontologyById.get(id);
  return {
    id,
    label: hit?.canonical_zh ?? onto?.canonical_zh ?? "unavailable",
    definition: hit?.definition ?? onto?.definition ?? "unavailable",
    in_top20: Boolean(hit),
  };
}

function goldThemes(row) {
  const ids = row.expected_theme_ids ?? [];
  const labels = row.expected_theme_labels ?? [];
  return ids.map((id, index) => {
    const fromCand = themeFromCandidate(row.candidates, id);
    return {
      id,
      label: fromCand.label !== "unavailable" ? fromCand.label : (labels[index] ?? "unavailable"),
      definition: fromCand.definition,
      in_top20: fromCand.in_top20,
    };
  });
}

function modelQuoteView(row) {
  const goldSet = new Set(row.expected_theme_ids ?? []);
  const valid = row.validation_status === "valid";
  const selected = valid ? (row.selected_theme_ids ?? []) : [];
  return {
    validation_status: row.validation_status ?? "unavailable",
    validation_reason: row.validation_reason ?? null,
    invented_theme_ids: row.invented_theme_ids ?? [],
    raw_content: row.raw_response?.choices?.[0]?.message?.content ?? null,
    empty_selection: valid && selected.length === 0,
    selected: selected.map((id) => ({
      ...themeFromCandidate(row.candidates, id),
      in_gold: goldSet.has(id),
    })),
    omitted_gold: (row.expected_theme_ids ?? [])
      .filter((id) => valid && !selected.includes(id))
      .map((id) => themeFromCandidate(row.candidates, id)),
  };
}

function overview(run, spec) {
  const m = run.aggregate_metrics;
  return {
    key: spec.key,
    label: spec.label,
    run_id: run.run_id,
    model_id: run.selector_provider?.model_id ?? run.effective_config?.model_id ?? "unavailable",
    thinking: thinkingLabel(run),
    valid_quotes: m.valid_quotes,
    attempted_quotes: m.attempted_quotes,
    micro_f1: m.micro?.f1 ?? null,
    run_sha256: null,
  };
}

const runs = MODEL_SPECS.map((spec) => {
  const path = join(runsRoot, spec.runId, "run.json");
  const buf = readFileSync(path);
  const run = JSON.parse(buf.toString("utf8"));
  run.__sha256 = sha256(buf);
  return { spec, run };
});

const quoteIds = runs[0].run.results.map((row) => row.quote_id);
for (const { spec, run } of runs) {
  const ids = run.results.map((row) => row.quote_id);
  if (JSON.stringify(ids) !== JSON.stringify(quoteIds)) {
    throw new Error(`${spec.runId} quote IDs differ from ${MODEL_SPECS[0].runId}`);
  }
  if (run.ontology_sha256 !== FROZEN.ontology.sha256) throw new Error(`${spec.runId} ontology hash drift`);
  if (run.benchmark_sha256 !== FROZEN.pilot.sha256) throw new Error(`${spec.runId} pilot hash drift`);
  if (run.retrieval_run_id !== PHASE2_RETRIEVAL.run_id) throw new Error(`${spec.runId} retrieval run drift`);
  if (run.retrieval_artifact_sha256 !== PHASE2_RETRIEVAL.artifact_sha256) {
    throw new Error(`${spec.runId} retrieval artifact hash drift`);
  }
}

const quotes = quoteIds.map((quoteId, index) => {
  const byKey = Object.fromEntries(
    runs.map(({ spec, run }) => [spec.key, run.results.find((row) => row.quote_id === quoteId)]),
  );
  const base = byKey.mini;
  return {
    index: index + 1,
    quote_id: quoteId,
    text_zh: base.text_zh,
    zero_theme: base.zero_theme === true,
    gold: goldThemes(base),
    top20: (base.candidates ?? []).map((c) => ({
      id: c.id,
      label: c.canonical_zh,
      definition: c.definition,
    })),
    models: Object.fromEntries(
      MODEL_SPECS.map((spec) => [spec.key, modelQuoteView(byKey[spec.key])]),
    ),
  };
});

const payload = {
  exploratory: true,
  n: 10,
  freeze: {
    ontology_sha256: FROZEN.ontology.sha256,
    pilot_sha256: FROZEN.pilot.sha256,
    retrieval_run_id: PHASE2_RETRIEVAL.run_id,
    retrieval_artifact_sha256: PHASE2_RETRIEVAL.artifact_sha256,
  },
  models: runs.map(({ spec, run }) => {
    const row = overview(run, spec);
    row.run_sha256 = run.__sha256;
    return row;
  }),
  quotes,
};

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EL 五模型 Theme 对照</title>
<style>
body { margin: 0; font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif; color: #111; background: #fff; line-height: 1.5; }
.bar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #ccc; padding: 8px 16px; display: flex; gap: 12px; align-items: center; z-index: 2; }
.bar button { font: inherit; padding: 4px 10px; }
main { padding: 16px 20px 64px; max-width: 1400px; }
h1 { font-size: 1.2rem; font-weight: 600; margin: 0 0 8px; }
.note { color: #444; margin: 0 0 16px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; text-align: left; }
th { background: #f3f3f3; }
.quote { margin: 0 0 12px; font-size: 1.05rem; }
.gold { background: #f7f3ea; }
.match { background: #eef6ee; }
.extra { background: #fff8e8; }
.miss { color: #666; }
.invalid { background: #f4f4f4; }
.item { margin: 0 0 8px; }
.item p { margin: 2px 0 0; font-size: 0.85rem; color: #444; }
.review { margin-top: 4px; font-size: 0.85rem; }
.review textarea { display: block; width: 100%; margin-top: 4px; min-height: 36px; font: inherit; }
.qid { color: #666; font-size: 0.85rem; }
</style>
</head>
<body>
<div class="bar">
  <strong>EL 五模型对照</strong>
  <span>Gold分歧 ≠ 语义不合理；请只给非Gold选标注</span>
  <button type="button" id="btn-export">导出审阅 JSON</button>
</div>
<main>
  <h1>10 句原文对照（n=10，Gold 是一位读者的解读，不是穷尽真值）</h1>
  <p class="note">绿：与 Human Gold 一致（Gold一致）。黄：Gold 分歧——模型选了但 Gold 没有，请判断该 Theme 在语义上是否合理（合理 / 不合理）。灰：非法输出（校验失败），不是 Gold 分歧。漏选 Gold 列在“Gold未选”，也不等于不合理。未改动任何 run 档案。</p>
  <table>
    <thead><tr><th>模型</th><th>model ID</th><th>合法输出</th><th>Micro-F1</th></tr></thead>
    <tbody id="summary"></tbody>
  </table>
  <div id="quotes"></div>
</main>
<script type="application/json" id="report-data">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>
<script>
const DATA = JSON.parse(document.getElementById("report-data").textContent);
const LS = "el-five-model-prelim-review.v1";
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function loadReview() { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } }
function saveReview(obj) { localStorage.setItem(LS, JSON.stringify(obj)); }
function rk(q, model, theme) { return q + "::" + model + "::" + theme; }

function reviewBox(quoteId, modelKey, themeId) {
  const key = rk(quoteId, modelKey, themeId);
  const cur = loadReview()[key] || {};
  return '<div class="review" data-rk="'+esc(key)+'">' +
    '<label><input type="radio" name="'+esc(key)+'" value="reasonable"'+(cur.judgment==="reasonable"?" checked":"")+'> 合理</label> ' +
    '<label><input type="radio" name="'+esc(key)+'" value="unreasonable"'+(cur.judgment==="unreasonable"?" checked":"")+'> 不合理</label>' +
    '<textarea placeholder="可选说明">'+esc(cur.notes || "")+'</textarea></div>';
}

function themeItem(t, quoteId, modelKey) {
  if (t.in_gold) {
    return '<div class="item match"><strong>'+esc(t.label)+'</strong> · Gold一致（不是唯一正确）<p>'+esc(t.definition)+'</p><p><code>'+esc(t.id)+'</code></p></div>';
  }
  return '<div class="item extra"><strong>'+esc(t.label)+'</strong> · Gold分歧 · 请判语义是否合理<p>'+esc(t.definition)+'</p><p><code>'+esc(t.id)+'</code></p>' +
    reviewBox(quoteId, modelKey, t.id) + '</div>';
}

function modelCell(q, model) {
  const v = q.models[model.key];
  if (v.validation_status !== "valid") {
    let html = '<div class="invalid">非法输出（非Gold分歧）：'+esc(v.validation_status)+(v.validation_reason ? " / "+esc(v.validation_reason) : "")+'</div>';
    if (v.raw_content) html += '<p><code>'+esc(v.raw_content)+'</code></p>';
    (v.invented_theme_ids || []).forEach(id => {
      html += '<div class="item invalid"><strong>'+esc(id)+'</strong> · 未通过校验'+reviewBox(q.quote_id, model.key, id)+'</div>';
    });
    return html;
  }
  if (v.empty_selection) return '<p>合法空选</p>';
  let html = (v.selected || []).map(t => themeItem(t, q.quote_id, model.key)).join("");
  if (v.omitted_gold && v.omitted_gold.length) {
    html += '<p class="miss">Gold未选：'+v.omitted_gold.map(t => esc(t.label)).join("、")+'</p>';
  }
  return html;
}

function goldCell(q) {
  if (!q.gold.length) return '<p>Gold 空选</p>';
  return q.gold.map(t => '<div class="item"><strong>'+esc(t.label)+'</strong><p>'+esc(t.definition)+'</p><p><code>'+esc(t.id)+'</code>'+(t.in_top20 ? "" : " · 不在Top20")+'</p></div>').join("");
}

document.getElementById("summary").innerHTML = DATA.models.map(m =>
  '<tr><td>'+esc(m.label)+'</td><td><code>'+esc(m.model_id)+'</code></td><td>'+m.valid_quotes+'/'+m.attempted_quotes+'</td><td>'+(m.micro_f1==null?"unavailable":m.micro_f1.toFixed(3))+'</td></tr>'
).join("");

document.getElementById("quotes").innerHTML = DATA.quotes.map(q => {
  return '<h2>'+q.index+'. <span class="qid">'+esc(q.quote_id)+'</span></h2>' +
    '<p class="quote">'+esc(q.text_zh)+'</p>' +
    '<table><thead><tr><th class="gold">Gold</th>'+DATA.models.map(m=>'<th>'+esc(m.label)+'</th>').join("")+'</tr></thead><tbody><tr>' +
    '<td class="gold">'+goldCell(q)+'</td>' +
    DATA.models.map(m => '<td>'+modelCell(q, m)+'</td>').join("") +
    '</tr></tbody></table>';
}).join("");

document.getElementById("quotes").addEventListener("change", ev => {
  const wrap = ev.target.closest(".review");
  if (!wrap || ev.target.type !== "radio") return;
  const store = loadReview();
  const parts = wrap.dataset.rk.split("::");
  store[wrap.dataset.rk] = Object.assign(store[wrap.dataset.rk] || {}, {
    quote_id: parts[0], model_key: parts[1], theme_id: parts[2], judgment: ev.target.value
  });
  saveReview(store);
});
document.getElementById("quotes").addEventListener("input", ev => {
  if (ev.target.tagName !== "TEXTAREA") return;
  const wrap = ev.target.closest(".review");
  const store = loadReview();
  const parts = wrap.dataset.rk.split("::");
  store[wrap.dataset.rk] = Object.assign(store[wrap.dataset.rk] || {}, {
    quote_id: parts[0], model_key: parts[1], theme_id: parts[2], notes: ev.target.value
  });
  saveReview(store);
});
document.getElementById("btn-export").addEventListener("click", () => {
  const store = loadReview();
  const rows = Object.values(store).map(row => ({
    quote_id: row.quote_id,
    model_key: row.model_key,
    model_id: DATA.models.find(m => m.key === row.model_key)?.model_id ?? null,
    theme_id: row.theme_id,
    judgment: row.judgment || null,
    notes: row.notes || ""
  }));
  const blob = new Blob([JSON.stringify({ schema: "el-five-model-prelim-review.v1", assessments: rows }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "el-five-model-prelim-review.json";
  a.click();
});
</script>
</body>
</html>
`;

writeFileSync(outPath, html, "utf8");
console.log(JSON.stringify({
  quotes: payload.quotes.length,
  quote_ids: payload.quotes.map((q) => q.quote_id),
  out: outPath,
}, null, 2));
