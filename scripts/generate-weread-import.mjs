#!/usr/bin/env node
/**
 * 从微信读书拉取划线，生成 pgwhite_weread_import.sql（增量，不 TRUNCATE）
 * 用法: node scripts/generate-weread-import.mjs
 * 需要 .env 中的 WEREAD_API_KEY（勿提交）
 *
 * 这是 Import（外部划线进入 PGWhite），不是 Favorite/收藏。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateWereadImportSql } from './lib/wereadImportSql.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'pgwhite_weread_import.sql')
const GATEWAY = 'https://i.weread.qq.com/api/agent/gateway'
const SKILL_VERSION = '1.0.3'

/** 要导入的微信读书 bookId；按笔记本最近活动排序 */
const WEREAD_BOOK_IDS = [
  '24953413', // 如果在冬夜，一个旅人
  '23863089' // 太古和其他的时间
]

/** 与现有 pgwhite_testing_data 不冲突的起始 id */
const START_AUTHOR_ID = 5
const START_BOOK_ID = 5
const START_QUOTE_ID = 119

function loadWereadKey() {
  if (process.env.WEREAD_API_KEY?.trim()) return process.env.WEREAD_API_KEY.trim()
  try {
    const env = readFileSync(resolve(ROOT, '.env'), 'utf8')
    for (const line of env.split('\n')) {
      const m = line.match(/^WEREAD_API_KEY=(.+)$/)
      if (m) return m[1].trim()
    }
  } catch {
    /* ignore */
  }
  throw new Error('缺少 WEREAD_API_KEY：请在 .env 中设置，勿写入代码仓库')
}

async function wereadPost(key, body) {
  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...body, skill_version: SKILL_VERSION })
  })
  const data = await res.json()
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`${body.api_name} errcode=${data.errcode} errmsg=${data.errmsg ?? ''}`)
  }
  return data
}

function authorEmojiGuess(authorName) {
  const n = authorName || ''
  if (/卡尔维诺|Calvino/i.test(n)) return '🇮🇹'
  if (/托卡尔丘克|Tokarczuk/i.test(n)) return '🇵🇱'
  if (/石黑|Ishiguro/i.test(n)) return '🇬🇧'
  if (/黑塞|Hesse/i.test(n)) return '🇩🇪'
  return '📖'
}

async function fetchHighlights(key, bookId) {
  const data = await wereadPost(key, { api_name: '/book/bookmarklist', bookId })
  const book = data.book || {}
  const items = (data.updated || [])
    .filter(u => (u.markText || '').trim())
    .sort((a, b) => (a.createTime || 0) - (b.createTime || 0))
  return {
    title: book.title || `book-${bookId}`,
    author: book.author || '未知作者',
    highlights: items.map(u => (u.markText || '').trim()).filter(Boolean)
  }
}

async function main() {
  const key = loadWereadKey()
  const books = []
  for (const wereadBookId of WEREAD_BOOK_IDS) {
    const fetched = await fetchHighlights(key, wereadBookId)
    books.push({ wereadBookId, ...fetched })
  }

  const { sql, totalQuotes } = generateWereadImportSql({
    books,
    startAuthorId: START_AUTHOR_ID,
    startBookId: START_BOOK_ID,
    startQuoteId: START_QUOTE_ID,
    authorEmojiGuess
  })

  writeFileSync(OUT, sql, 'utf8')
  console.log(`Wrote ${OUT} (${totalQuotes} quotes)`)
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
