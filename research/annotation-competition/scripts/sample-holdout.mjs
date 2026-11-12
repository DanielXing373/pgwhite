#!/usr/bin/env node
// 从 pgwhite_weread_import.sql（1169 条个人摘录，只读）按书分层抽取验证集。
// 排除与 dev58 重复/互相包含的句子。确定性：同一 seed 得到同一文件。
import fs from "node:fs";
import { FROZEN_BENCHMARK, fromRepo } from "../src/paths.mjs";
import { normalizeForMatch, one, parseArgs, readJson, seededRandom, shuffled, writeJson } from "../src/util.mjs";

const args = parseArgs(process.argv.slice(2));
const size = Number(one(args, "size", "60"));
const seed = Number(one(args, "seed", "20261112"));
const minChars = Number(one(args, "min-chars", "15"));
const maxChars = Number(one(args, "max-chars", "200"));
const out = one(args, "out", "research/annotation-competition/benchmark/holdout-60.v1.json");
const SOURCE = "pgwhite_weread_import.sql";

const sql = fs.readFileSync(fromRepo(SOURCE), "utf8");
const unquote = (value) => value.replace(/''/g, "'").replace(/\\n/g, "\n");
const bookOfQuote = new Map();
for (const match of sql.matchAll(/INSERT INTO quotes \(id, book_id\) VALUES \((\d+), (\d+)\);/g)) {
  bookOfQuote.set(Number(match[1]), Number(match[2]));
}
const bookTitle = new Map();
for (const match of sql.matchAll(/INSERT INTO book_translations \(book_id, language_code, title\) VALUES \((\d+), 'zh', '((?:[^']|'')*)'\)/g)) {
  bookTitle.set(Number(match[1]), unquote(match[2]));
}
const quotes = [];
for (const match of sql.matchAll(/INSERT INTO quote_translations \(quote_id, language_code, content\) VALUES \((\d+), 'zh', '((?:[^']|'')*)'\);/g)) {
  const id = Number(match[1]);
  quotes.push({ production_quote_id: id, book_id: bookOfQuote.get(id) ?? null, text_zh: unquote(match[2]).trim() });
}

const dev = readJson(fromRepo(FROZEN_BENCHMARK)).quotes.map((quote) => normalizeForMatch(quote.text_zh));
const seen = new Set();
const eligible = quotes.filter((quote) => {
  const length = [...quote.text_zh].length;
  if (length < minChars || length > maxChars) return false;
  const norm = normalizeForMatch(quote.text_zh);
  if (seen.has(norm)) return false;
  seen.add(norm);
  return !dev.some((text) => text.includes(norm) || norm.includes(text));
});

// 分层：每本书按占比分配名额（至少 1 条），再用最大余数法补齐。
const random = seededRandom(seed);
const byBook = new Map();
for (const quote of eligible) {
  if (!byBook.has(quote.book_id)) byBook.set(quote.book_id, []);
  byBook.get(quote.book_id).push(quote);
}
const books = [...byBook.keys()].sort((a, b) => a - b);
const quota = new Map();
const remainders = [];
let assigned = 0;
for (const book of books) {
  const exact = (byBook.get(book).length / eligible.length) * size;
  const base = Math.min(byBook.get(book).length, Math.max(1, Math.floor(exact)));
  quota.set(book, base);
  assigned += base;
  remainders.push([exact - Math.floor(exact), book]);
}
remainders.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
for (let i = 0; assigned < size; i += 1) {
  const book = remainders[i % remainders.length][1];
  if (quota.get(book) < byBook.get(book).length) {
    quota.set(book, quota.get(book) + 1);
    assigned += 1;
  }
  if (i > size * books.length) break;
}
for (let i = remainders.length - 1; assigned > size; i = (i - 1 + remainders.length) % remainders.length) {
  const book = remainders[i][1];
  if (quota.get(book) > 1) {
    quota.set(book, quota.get(book) - 1);
    assigned -= 1;
  }
}
const picked = [];
for (const book of books) {
  picked.push(...shuffled(byBook.get(book), random).slice(0, quota.get(book)));
}
picked.sort((a, b) => a.production_quote_id - b.production_quote_id);

writeJson(fromRepo(out), {
  schema_version: "ac-dataset.v1",
  dataset_id: "holdout60",
  research_only: true,
  role: "validation set; never used to edit the tag library or the prompt",
  source: SOURCE,
  sampling: { seed, size, min_chars: minChars, max_chars: maxChars, method: "stratified by book, largest remainder", eligible: eligible.length, excluded_overlap_with: "dev58" },
  quotes: picked.map((quote, index) => ({
    quote_id: `holdout-${String(index + 1).padStart(3, "0")}`,
    text_zh: quote.text_zh,
    production_quote_id: quote.production_quote_id,
    book_id: quote.book_id,
    book_title_zh: bookTitle.get(quote.book_id) ?? null,
  })),
});
console.log(`wrote ${out}: ${picked.length} quotes from ${books.length} books (eligible ${eligible.length} of ${quotes.length})`);
