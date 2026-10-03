#!/usr/bin/env node
/**
 * READ-ONLY seed export for PGWhite 1.3 dedup benchmark.
 *
 * - SELECT only (assertReadOnlySql)
 * - Never INSERT/UPDATE/DELETE
 * - Writes research/dedup-benchmark/fixtures/seeds.v1.json
 *
 * Usage: node research/dedup-benchmark/scripts/export-seeds.mjs
 * Requires DB_* in .env (one-time). Subsequent benchmark runs use the fixture.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { assertReadOnlySql, RESEARCH_ONLY_BANNER } from '../src/safety.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const OUT = path.resolve(__dirname, '../fixtures/seeds.v1.json')

console.log(RESEARCH_ONLY_BANNER)

function loadEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!fs.existsSync(envPath)) throw new Error('.env not found')
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
}

async function readQuery(conn, sql, params = []) {
  assertReadOnlySql(sql)
  return conn.query(sql, params)
}

function traits(content) {
  const len = [...content].length
  const hasCnQuotes = /[“”「」『』]/.test(content)
  const dialogue = /：\s*[“「]|说[道过]?[：:]/.test(content)
  const multi = (content.match(/[。！？]/g) || []).length >= 2
  const punctRich = (content.match(/[，。！？；：、…—]/g) || []).length >= 4
  return {
    short: len <= 20,
    medium: len > 20 && len <= 80,
    long: len > 80,
    dialogue,
    multi_sentence: multi,
    has_cn_quotes: hasCnQuotes,
    punctuation_rich: punctRich
  }
}

/**
 * Deterministic stratified seed selection (NOT first-N rows).
 *
 * Method (recorded in fixture meta):
 * 1. Load all zh quotes with author/book.
 * 2. Restrict to a fixed book allow-list spanning curated + Import#3 books.
 * 3. Per book, sort quotes by quote_id ascending.
 * 4. Partition into short/medium/long buckets by char length.
 * 5. From each book pick up to: 1 short, 1 medium, 1 long (preferring
 *    dialogue / multi-sentence / cn-quotes when ties — lower quote_id wins).
 * 6. Cap global set at 30; if under 25, fill from remaining medium quotes
 *    across books by ascending quote_id.
 */
const BOOK_ALLOW = [1, 2, 4, 5, 7, 9, 10, 11, 12, 13, 17, 19, 20]

function pickFromBucket(arr, prefer) {
  if (!arr.length) return null
  const scored = [...arr].sort((a, b) => {
    const sa = prefer(a)
    const sb = prefer(b)
    if (sb !== sa) return sb - sa
    return a.quote_id - b.quote_id
  })
  return scored[0]
}

function preferTraits(q) {
  let s = 0
  if (q.traits.dialogue) s += 3
  if (q.traits.multi_sentence) s += 2
  if (q.traits.has_cn_quotes) s += 2
  if (q.traits.punctuation_rich) s += 1
  return s
}

function selectSeeds(all) {
  const byBook = new Map()
  for (const q of all) {
    if (!BOOK_ALLOW.includes(q.book_id)) continue
    const arr = byBook.get(q.book_id) || []
    arr.push(q)
    byBook.set(q.book_id, arr)
  }

  const selected = []
  const used = new Set()

  for (const bookId of BOOK_ALLOW) {
    const quotes = (byBook.get(bookId) || [])
      .slice()
      .sort((a, b) => a.quote_id - b.quote_id)
    if (!quotes.length) continue
    const short = quotes.filter((q) => q.traits.short && q.char_len >= 4)
    const medium = quotes.filter((q) => q.traits.medium)
    const long = quotes.filter((q) => q.traits.long && q.char_len <= 220)
    for (const bucket of [short, medium, long]) {
      const pick = pickFromBucket(
        bucket.filter((q) => !used.has(q.quote_id)),
        preferTraits
      )
      if (pick) {
        selected.push(pick)
        used.add(pick.quote_id)
      }
    }
  }

  if (selected.length < 25) {
    const rest = all
      .filter(
        (q) =>
          BOOK_ALLOW.includes(q.book_id) &&
          !used.has(q.quote_id) &&
          q.char_len >= 12 &&
          q.char_len <= 160
      )
      .sort((a, b) => a.quote_id - b.quote_id)
    for (const q of rest) {
      if (selected.length >= 36) break
      selected.push(q)
      used.add(q.quote_id)
    }
  }

  // Cap while preserving per-book diversity (round-robin by ascending quote_id).
  // Avoid naive global slice(0,30) which drops high-id Import #3 books.
  const TARGET = 30
  if (selected.length <= TARGET) {
    return selected.sort((a, b) => a.quote_id - b.quote_id)
  }
  const groups = new Map()
  for (const q of selected.sort((a, b) => a.quote_id - b.quote_id)) {
    const arr = groups.get(q.book_id) || []
    arr.push(q)
    groups.set(q.book_id, arr)
  }
  const bookOrder = [...groups.keys()].sort((a, b) => a - b)
  const capped = []
  let guard = 0
  while (capped.length < TARGET && guard < TARGET * bookOrder.length) {
    for (const bid of bookOrder) {
      const arr = groups.get(bid)
      if (arr && arr.length && capped.length < TARGET) {
        capped.push(arr.shift())
      }
    }
    guard++
  }
  return capped.sort((a, b) => a.quote_id - b.quote_id)
}

async function main() {
  const env = loadEnv()
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: +env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  })

  try {
    const sql = `
      SELECT
        q.id AS quote_id,
        q.book_id AS book_id,
        b.author_id AS author_id,
        bt.title AS book_title_zh,
        at.name AS author_name_zh,
        qt.content AS content_zh,
        CHAR_LENGTH(qt.content) AS char_len,
        (
          SELECT JSON_UNQUOTE(JSON_EXTRACT(ii.raw_payload, '$.item.chapterUid'))
          FROM library_entries le
          JOIN import_items ii ON ii.library_entry_id = le.id
          WHERE le.quote_id = q.id
            AND ii.external_id LIKE 'weread:bookmark:%'
            AND JSON_EXTRACT(ii.raw_payload, '$.item.chapterUid') IS NOT NULL
          ORDER BY ii.id ASC
          LIMIT 1
        ) AS chapter_uid
      FROM quotes q
      INNER JOIN quote_translations qt
        ON qt.quote_id = q.id AND qt.language_code = 'zh'
      INNER JOIN books b ON b.id = q.book_id
      INNER JOIN book_translations bt
        ON bt.book_id = b.id AND bt.language_code = 'zh'
      INNER JOIN author_translations at
        ON at.author_id = b.author_id AND at.language_code = 'zh'
      ORDER BY q.id ASC
    `
    const [rows] = await readQuery(conn, sql)

    const all = rows.map((r) => {
      const content = String(r.content_zh)
      const t = traits(content)
      const chapter =
        r.chapter_uid != null && String(r.chapter_uid).length
          ? `weread:${r.chapter_uid}`
          : `synthetic:${r.book_id}:${Math.floor(Number(r.quote_id) / 40)}`
      return {
        quote_id: Number(r.quote_id),
        book_id: Number(r.book_id),
        author_id: Number(r.author_id),
        book_title_zh: String(r.book_title_zh),
        author_name_zh: String(r.author_name_zh),
        content_zh: content,
        char_len: [...content].length,
        chapter,
        traits: t
      }
    })

    const seeds = selectSeeds(all)
    const fixture = {
      version: 1,
      exported_at: new Date().toISOString(),
      selection_method: {
        name: 'stratified_book_length_trait_v1',
        book_allow_list: BOOK_ALLOW,
        per_book_buckets: ['short<=20', 'medium21-80', 'long81-220'],
        preference: 'dialogue > multi_sentence > cn_quotes > punct_rich; tie=lower quote_id',
        target: '25-30 seeds',
        note: 'Deterministic. Not first-N rows. READ-ONLY SELECT export.'
      },
      safety: {
        db_mutation: 'NONE',
        queries: 'SELECT only via assertReadOnlySql'
      },
      seeds
    }

    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n', 'utf8')
    console.log(`Wrote ${seeds.length} seeds → ${OUT}`)
    console.log(
      'Books represented:',
      [...new Set(seeds.map((s) => s.book_id))].sort((a, b) => a - b).join(', ')
    )
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
