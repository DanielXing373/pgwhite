#!/usr/bin/env node
// 从 pgwhite_weread_import.sql（个人摘录，只读）生成规模测试集。
// 模拟一次真实导入：不按长度筛选；完全相同的句子只保留一条（“同一句只标一次”）。
// 确定性：同一 seed 得到同一文件。这个数据集只测成本、速度和格式稳定性，不用于排名。
import fs from "node:fs";
import { fromRepo } from "../src/paths.mjs";
import { normalizeForMatch, one, parseArgs, seededRandom, shuffled, writeJson } from "../src/util.mjs";

const args = parseArgs(process.argv.slice(2));
const size = Number(one(args, "size", "1000"));
const seed = Number(one(args, "seed", "20261112"));
const out = one(args, "out", `research/annotation-competition/benchmark/scale-${size}.v1.json`);
const SOURCE = "pgwhite_weread_import.sql";

const sql = fs.readFileSync(fromRepo(SOURCE), "utf8");
const unquote = (value) => value.replace(/''/g, "'").replace(/\\n/g, "\n");
const all = [];
for (const match of sql.matchAll(/INSERT INTO quote_translations \(quote_id, language_code, content\) VALUES \((\d+), 'zh', '((?:[^']|'')*)'\);/g)) {
  all.push({ production_quote_id: Number(match[1]), text_zh: unquote(match[2]).trim() });
}

const seen = new Set();
let empty = 0;
let duplicates = 0;
const unique = [];
for (const quote of all) {
  const norm = normalizeForMatch(quote.text_zh);
  if (!norm) { empty += 1; continue; }
  if (seen.has(norm)) { duplicates += 1; continue; }
  seen.add(norm);
  unique.push(quote);
}
if (unique.length < size) throw new Error(`STOP: only ${unique.length} unique quotes, cannot sample ${size}.`);

const picked = shuffled(unique, seededRandom(seed)).slice(0, size);
const lengths = picked.map((quote) => [...quote.text_zh].length).sort((a, b) => a - b);
const stats = {
  min: lengths[0],
  median: lengths[Math.floor(lengths.length / 2)],
  p90: lengths[Math.floor(lengths.length * 0.9)],
  max: lengths[lengths.length - 1],
  total_chars: lengths.reduce((sum, value) => sum + value, 0),
};

writeJson(fromRepo(out), {
  schema_version: "ac-dataset.v1",
  dataset_id: `scale${size}`,
  research_only: true,
  role: "scale test only (cost, speed, format stability); not judged, not used for ranking",
  source: SOURCE,
  sampling: { seed, size, method: "dedupe by normalized text, seeded shuffle, no length filter", source_quotes: all.length, empty, duplicates, unique: unique.length },
  length_chars: stats,
  quotes: picked.map((quote, index) => ({
    quote_id: `scale-${String(index + 1).padStart(4, "0")}`,
    text_zh: quote.text_zh,
    production_quote_id: quote.production_quote_id,
  })),
});
console.log(`wrote ${out}: ${picked.length} of ${unique.length} unique quotes (source ${all.length}, duplicates ${duplicates}, empty ${empty})`);
console.log(`length chars: ${JSON.stringify(stats)}`);
