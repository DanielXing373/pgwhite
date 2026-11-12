// holdout60 三档判定统计：accept=合适，未判=可接受（不会删），reject=明显错误。只读。
import fs from "node:fs";
// 用法（仓库根目录）：node research/annotation-competition/results/holdout60-three-way.mjs
const root = process.argv[2] ?? "research/annotation-competition";
const J = JSON.parse(fs.readFileSync(`${root}/packs/judgments-holdout60-993b2d90c9c5.json`, "utf8")).judgments;
const pack = JSON.parse(fs.readFileSync(`${root}/packs/round3-holdout60.public.json`, "utf8"));
const runs = ["R3-luna-joint-holdout60", "R3-luna-joint-think-low-holdout60", "R3-luna-joint-think-medium-holdout60", "R3-flash-joint-holdout60"];
const dims = ["theme", "rhetoric", "technique"];
const v = (q, t) => J[q]?.[t] ?? "ok";
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "—");

const pool = {};
for (const d of dims) pool[d] = { accept: 0, ok: 0, reject: 0 };
for (const it of pack.items) for (const d of dims) for (const t of it.dimensions[d] ?? []) pool[d][v(it.quote_id, t.tag_id)]++;
console.log("POOL", JSON.stringify(pool));

for (const n of runs) {
  const r = JSON.parse(fs.readFileSync(`${root}/runs/${n}/run.json`, "utf8"));
  console.log(`\n== ${n}  ¥${r.summary.cost.cny_per_10k_quotes.toFixed(2)}/万条`);
  for (const d of dims) {
    const c = { accept: 0, ok: 0, reject: 0 };
    const pos = [];
    let empty = 0, quotesWithReject = 0;
    for (const q of r.results) {
      const tags = q.tags[d] ?? [];
      if (!tags.length) empty++;
      let bad = false;
      tags.forEach((t, i) => {
        const x = v(q.quote_id, t.tag_id);
        c[x]++;
        (pos[i] ??= { accept: 0, ok: 0, reject: 0 })[x]++;
        if (x === "reject") bad = true;
      });
      if (bad) quotesWithReject++;
    }
    const tot = c.accept + c.ok + c.reject;
    const posTxt = pos.slice(0, 3).map((p, i) => `#${i + 1} ${p.accept}/${p.ok}/${p.reject}`).join("  ");
    console.log(`${d.padEnd(9)} n=${String(tot).padStart(3)} 合适 ${c.accept} (${pct(c.accept, tot)}) 可接受 ${c.ok} (${pct(c.ok, tot)}) 明显错 ${c.reject} (${pct(c.reject, tot)}) | 覆盖 ${pct(c.accept, pool[d].accept)} | 留空 ${empty}/60 | 含错的摘抄 ${quotesWithReject}/60 | ${posTxt}`);
  }
  const anyBad = r.results.filter((q) => dims.some((d) => (q.tags[d] ?? []).some((t) => v(q.quote_id, t.tag_id) === "reject"))).length;
  console.log(`任一维度含明显错误的摘抄：${anyBad}/60`);
}

console.log("\n== 被判明显错误的标签，按来源");
const labelOf = {};
for (const it of pack.items) for (const d of dims) for (const t of it.dimensions[d] ?? []) labelOf[t.tag_id] = t.label;
for (const [q, tags] of Object.entries(J)) for (const [t, x] of Object.entries(tags)) {
  if (x !== "reject") continue;
  const who = runs.filter((n) => {
    const r = JSON.parse(fs.readFileSync(`${root}/runs/${n}/run.json`, "utf8"));
    const row = r.results.find((y) => y.quote_id === q);
    return dims.some((d) => (row.tags[d] ?? []).some((y) => y.tag_id === t));
  }).map((n) => n.replace("R3-", "").replace("-holdout60", "").replace("-joint", ""));
  console.log(`${q} ${labelOf[t] ?? t}: ${who.join(", ")}`);
}
