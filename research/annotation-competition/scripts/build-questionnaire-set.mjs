#!/usr/bin/env node
// 生成真人问卷 /ac1test 的题库：从 holdout60 按书分层抽 20 段，把三个入选配置给出的标签
// 合并、去重、打乱。不调用模型，只读 runs/ 和 pgwhite_weread_import.sql。
//
// 输出两份内容相同的文件：
//   research/annotation-competition/questionnaire/ac1-hs-questions.internal.v1.json  （研究存档）
//   server/utils/ac1hs/dataset.generated.ts                                          （随服务端一起打包）
// 两份都含“哪个标签来自哪个配置”的对照，只能在服务端使用，不能被 pages/ 引用。
//
// 证据不进题库：问卷不展示证据。
import fs from "node:fs";
import path from "node:path";
import { loadLibrary } from "../src/library.mjs";
import { AC_ROOT, fromRepo } from "../src/paths.mjs";
import { one, parseArgs, readJson, seededRandom, sha256Text, shuffled, writeJson } from "../src/util.mjs";

const DATASET_VERSION = "ac1-hs-questions.v1";
const PROTOCOL_VERSION = "ac1-human-tag-review.protocol.v1";
const POOL_SIZE = 20;
const MIN_TAGS = 2;
// 私有来源编号 → run。顺序固定，写入题库。
const SOURCES = [
  ["deepseek-flash", "R3-flash-joint-holdout60"],
  ["gpt-6-luna-low", "R3-luna-joint-think-low-holdout60"],
  ["gpt-6-luna-medium", "R3-luna-joint-think-medium-holdout60"],
];
const DIMENSIONS = ["theme", "rhetoric", "technique"];
const HOLDOUT = "research/annotation-competition/benchmark/holdout-60.v1.json";
const SQL = "pgwhite_weread_import.sql";
const OUT_JSON = "research/annotation-competition/questionnaire/ac1-hs-questions.internal.v1.json";
const OUT_TS = "server/utils/ac1hs/dataset.generated.ts";

const args = parseArgs(process.argv.slice(2));
const seed = Number(one(args, "seed", "20261112"));
const random = seededRandom(seed);
const library = loadLibrary();

// 作者、书名：从导入 SQL 里解析（只读）。
const sql = fs.readFileSync(fromRepo(SQL), "utf8");
const unquote = (value) => value.replace(/''/g, "'");
const authorOfBook = new Map();
for (const match of sql.matchAll(/INSERT INTO books \(id, author_id, emoji\) VALUES \((\d+), (\d+),/g)) {
  authorOfBook.set(Number(match[1]), Number(match[2]));
}
const authorName = new Map();
for (const match of sql.matchAll(/INSERT INTO author_translations \(author_id, language_code, name\) VALUES \((\d+), 'zh', '((?:[^']|'')*)'\)/g)) {
  authorName.set(Number(match[1]), unquote(match[2]));
}

const holdout = readJson(fromRepo(HOLDOUT));
const runs = SOURCES.map(([sourceId, runId]) => ({
  sourceId,
  run: readJson(path.join(AC_ROOT, "runs", runId, "run.json")),
}));
for (const { run } of runs) {
  if (run.dataset.id !== "holdout60" || run.dataset.limit != null) throw new Error(`STOP: ${run.run_id} is not a full holdout60 run.`);
}

function pooledTags(quoteId) {
  const byId = new Map();
  for (const { sourceId, run } of runs) {
    const row = run.results.find((entry) => entry.quote_id === quoteId);
    if (!row || row.status !== "valid") throw new Error(`STOP: ${run.run_id} has no valid result for ${quoteId}.`);
    for (const dimension of DIMENSIONS) {
      for (const tag of row.tags[dimension] ?? []) {
        const known = library.byId.get(tag.tag_id);
        if (!known || known.dimension !== dimension) throw new Error(`STOP: unknown tag ${tag.tag_id}`);
        const entry = byId.get(tag.tag_id) ?? { tag_id: tag.tag_id, dimension, label_zh: known.label, sources: [] };
        if (!entry.sources.includes(sourceId)) entry.sources.push(sourceId);
        byId.set(tag.tag_id, entry);
      }
    }
  }
  // 展示顺序：按维度分组，组内固定打乱一次，所有参与者看到的顺序相同。
  return DIMENSIONS.flatMap((dimension) => shuffled([...byId.values()].filter((tag) => tag.dimension === dimension), random));
}

const candidates = holdout.quotes.map((quote) => {
  const author = authorName.get(authorOfBook.get(quote.book_id)) ?? null;
  return {
    quote_id: quote.quote_id,
    text_zh: quote.text_zh,
    book_id: quote.book_id,
    attribution: { author_name_zh: author, book_title_zh: quote.book_title_zh ?? null },
    tags: pooledTags(quote.quote_id),
  };
});
const eligible = candidates.filter((quote) => quote.tags.length >= MIN_TAGS && quote.attribution.author_name_zh && quote.attribution.book_title_zh);

// 按书分层：每本书轮流取一段，直到取满。
const byBook = new Map();
for (const quote of shuffled(eligible, random)) {
  if (!byBook.has(quote.book_id)) byBook.set(quote.book_id, []);
  byBook.get(quote.book_id).push(quote);
}
const books = shuffled([...byBook.keys()].sort((a, b) => a - b), random);
const picked = [];
for (let round = 0; picked.length < POOL_SIZE; round += 1) {
  let took = false;
  for (const book of books) {
    const quote = byBook.get(book)[round];
    if (quote && picked.length < POOL_SIZE) { picked.push(quote); took = true; }
  }
  if (!took) throw new Error(`STOP: only ${picked.length} eligible quotes, need ${POOL_SIZE}.`);
}
picked.sort((a, b) => a.quote_id.localeCompare(b.quote_id));

const quotes = picked.map(({ book_id, ...quote }) => quote);
const master = {
  schema_version: "ac1-hs-internal-master.v1",
  dataset_version: DATASET_VERSION,
  protocol_version: PROTOCOL_VERSION,
  freeze_status: "frozen",
  research_only: true,
  note: "Server-side only. Contains the tag → source mapping; never import from pages/ or send to a browser.",
  built_from: {
    dataset: HOLDOUT,
    seed,
    pool_size: POOL_SIZE,
    min_tags_per_quote: MIN_TAGS,
    eligible_quotes: eligible.length,
    library_version: library.version,
    runs: runs.map(({ sourceId, run }) => ({ source_id: sourceId, run_id: run.run_id, prompt_version: run.prompt_version, model_id: run.provider?.model_id ?? run.config?.provider?.model_id ?? null })),
  },
  source_ids: SOURCES.map(([sourceId]) => sourceId),
  // 完整性校验用：对 quotes 数组的 JSON 文本取 SHA-256。服务端加载时重新计算。
  content_sha256: sha256Text(JSON.stringify(quotes)),
  quotes,
};

fs.mkdirSync(path.dirname(fromRepo(OUT_JSON)), { recursive: true });
writeJson(fromRepo(OUT_JSON), master);
fs.mkdirSync(path.dirname(fromRepo(OUT_TS)), { recursive: true });
fs.writeFileSync(
  fromRepo(OUT_TS),
  [
    "// 由 research/annotation-competition/scripts/build-questionnaire-set.mjs 生成，不要手改。",
    "// 仅服务端使用：含“标签来自哪个配置”的对照，不能被 pages/ 或 components/ 引用。",
    "import type { InternalMaster } from './types'",
    "",
    `export const AC1_INTERNAL_MASTER: InternalMaster = ${JSON.stringify(master, null, 2)}`,
    "",
  ].join("\n"),
  "utf8",
);

const count = (dimension) => quotes.reduce((sum, quote) => sum + quote.tags.filter((tag) => tag.dimension === dimension).length, 0);
const perQuote = quotes.map((quote) => quote.tags.length).sort((a, b) => a - b);
console.log(`wrote ${OUT_JSON}`);
console.log(`wrote ${OUT_TS}`);
console.log(`quotes ${quotes.length} (eligible ${eligible.length} of ${candidates.length}), books ${new Set(picked.map((quote) => quote.book_id)).size}`);
console.log(`tags ${perQuote.reduce((a, b) => a + b, 0)}: theme ${count("theme")} / rhetoric ${count("rhetoric")} / technique ${count("technique")}; per quote min ${perQuote[0]} median ${perQuote[Math.floor(perQuote.length / 2)]} max ${perQuote[perQuote.length - 1]}`);
console.log(`content_sha256 ${master.content_sha256}`);
