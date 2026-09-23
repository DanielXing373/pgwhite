/**
 * Pure helpers for WeRead → SQL generation (Import pipeline, offline).
 * Kept separate so unit tests can cover SQL shape without calling WeRead.
 *
 * Terminology: this is Import (external highlight → PGWhite), not Favorite.
 */

export function sqlEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")
}

/**
 * @param {object} opts
 * @param {Array<{ wereadBookId: string, title: string, author: string, highlights: string[] }>} opts.books
 * @param {number} [opts.startAuthorId=5]
 * @param {number} [opts.startBookId=5]
 * @param {number} [opts.startQuoteId=119]
 * @param {string} [opts.generatedAt]
 */
export function generateWereadImportSql(opts) {
  const books = opts.books || []
  let authorId = opts.startAuthorId ?? 5
  let bookId = opts.startBookId ?? 5
  let quoteId = opts.startQuoteId ?? 119
  let totalQuotes = 0

  const lines = []
  lines.push('-- =====================================================')
  lines.push('-- pgwhite_weread_import.sql')
  lines.push('-- 增量导入：微信读书划线 → quotes（仅 zh，无 tag/人物）')
  lines.push(`-- 生成: ${opts.generatedAt || new Date().toISOString()}`)
  lines.push('-- 执行前请确认 Railway 上 authors/books/quotes 的 MAX(id) 未与本文件冲突')
  lines.push('-- =====================================================')
  lines.push('')
  lines.push('USE pgwhite;')
  lines.push('')

  for (const book of books) {
    const items = (book.highlights || []).map(t => String(t).trim()).filter(Boolean)
    if (!items.length) {
      lines.push(`-- 跳过 ${book.title}（无划线）`)
      lines.push('')
      continue
    }

    const authorZh = String(book.author || '未知作者').trim()
    const authorEn = authorZh
    const title = book.title || `book-${book.wereadBookId}`
    const emoji = opts.authorEmojiGuess ? opts.authorEmojiGuess(authorZh) : '📖'

    lines.push(
      `-- 微信读书 bookId=${book.wereadBookId} · ${title} · ${authorZh} · ${items.length} 条划线`
    )
    lines.push(`INSERT INTO authors (id, emoji) VALUES (${authorId}, '${emoji}');`)
    lines.push(
      `INSERT INTO author_translations (author_id, language_code, name) VALUES (${authorId}, 'zh', '${sqlEscape(authorZh)}'), (${authorId}, 'en', '${sqlEscape(authorEn)}');`
    )
    lines.push(`INSERT INTO books (id, author_id, emoji) VALUES (${bookId}, ${authorId}, '📚');`)
    lines.push(
      `INSERT INTO book_translations (book_id, language_code, title) VALUES (${bookId}, 'zh', '${sqlEscape(title)}'), (${bookId}, 'en', '${sqlEscape(title)}');`
    )
    lines.push('')

    for (const text of items) {
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

  lines.push(`-- 合计新增 ${totalQuotes} 条 quote（${books.length} 本书）`)
  lines.push('SELECT COUNT(*) AS quotes_after_import FROM quotes;')

  return {
    sql: lines.join('\n') + '\n',
    totalQuotes,
    nextAuthorId: authorId,
    nextBookId: bookId,
    nextQuoteId: quoteId
  }
}
