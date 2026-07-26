#!/usr/bin/env node
/**
 * 从微信读书拉取划线，生成 pgwhite_weread_import.sql（增量，不 TRUNCATE）
 * 用法: node scripts/generate-weread-import.mjs
 * 需要 .env 中的 WEREAD_API_KEY（勿提交）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

function sqlEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")
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
    items
  }
}

async function main() {
  const key = loadWereadKey()
  const lines = []
  lines.push('-- =====================================================')
  lines.push('-- pgwhite_weread_import.sql')
  lines.push('-- 增量导入：微信读书划线 → quotes（仅 zh，无 tag/人物）')
  lines.push(`-- 生成: ${new Date().toISOString()}`)
  lines.push('-- 执行前请确认 Railway 上 authors/books/quotes 的 MAX(id) 未与本文件冲突')
  lines.push('-- =====================================================')
  lines.push('')
  lines.push('USE pgwhite;')
  lines.push('')

  let authorId = START_AUTHOR_ID
  let bookId = START_BOOK_ID
  let quoteId = START_QUOTE_ID
  let totalQuotes = 0

  for (const wereadBookId of WEREAD_BOOK_IDS) {
    const { title, author, items } = await fetchHighlights(key, wereadBookId)
    if (!items.length) {
      lines.push(`-- 跳过 ${title}（无划线）`)
      lines.push('')
      continue
    }

    const authorZh = author.trim()
    const authorEn = authorZh // 暂用同名占位，后续可补
    const emoji = authorEmojiGuess(authorZh)

    lines.push(`-- 微信读书 bookId=${wereadBookId} · ${title} · ${authorZh} · ${items.length} 条划线`)
    lines.push(`INSERT INTO authors (id, emoji) VALUES (${authorId}, '${emoji}');`)
    lines.push(
      `INSERT INTO author_translations (author_id, language_code, name) VALUES (${authorId}, 'zh', '${sqlEscape(authorZh)}'), (${authorId}, 'en', '${sqlEscape(authorEn)}');`
    )
    lines.push(`INSERT INTO books (id, author_id, emoji) VALUES (${bookId}, ${authorId}, '📚');`)
    lines.push(
      `INSERT INTO book_translations (book_id, language_code, title) VALUES (${bookId}, 'zh', '${sqlEscape(title)}'), (${bookId}, 'en', '${sqlEscape(title)}');`
    )
    lines.push('')

    for (const item of items) {
      const text = (item.markText || '').trim()
      lines.push(`INSERT INTO quotes (id, book_id) VALUES (${quoteId}, ${bookId});`)
      lines.push(
        `INSERT INTO quote_translations (quote_id, language_code, content) VALUES (${quoteId}, 'zh', '${sqlEscape(text)}');`
      )
      quoteId++
      totalQuotes++
    }

    lines.push('')
    authorId++
    bookId++
  }

  lines.push(`-- 合计新增 ${totalQuotes} 条 quote（${WEREAD_BOOK_IDS.length} 本书）`)
  lines.push('SELECT COUNT(*) AS quotes_after_import FROM quotes;')

  writeFileSync(OUT, lines.join('\n') + '\n', 'utf8')
  console.log(`Wrote ${OUT} (${totalQuotes} quotes)`)
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
