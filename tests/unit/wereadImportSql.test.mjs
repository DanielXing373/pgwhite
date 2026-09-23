import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateWereadImportSql, sqlEscape } from '../../scripts/lib/wereadImportSql.mjs'

describe('WeRead Import SQL generator (offline fixture)', () => {
  it('preserves highlight text and escapes SQL quotes', () => {
    assert.equal(sqlEscape("it's"), "it''s")
    const { sql, totalQuotes } = generateWereadImportSql({
      generatedAt: '2026-01-01T00:00:00.000Z',
      startAuthorId: 5,
      startBookId: 5,
      startQuoteId: 119,
      authorEmojiGuess: () => '🇮🇹',
      books: [
        {
          wereadBookId: '24953413',
          title: "If on a Winter's Night",
          author: 'Italo Calvino',
          highlights: ["it's a line", 'second highlight']
        }
      ]
    })

    assert.equal(totalQuotes, 2)
    assert.ok(sql.includes("it''s a line"))
    assert.ok(sql.includes('second highlight'))
    assert.ok(sql.includes("If on a Winter''s Night"))
  })

  it('generates untagged quotes: zh translation only, no quote_tags / quote_characters', () => {
    const { sql } = generateWereadImportSql({
      generatedAt: '2026-01-01T00:00:00.000Z',
      books: [
        {
          wereadBookId: '1',
          title: 'Demo',
          author: 'Author',
          highlights: ['only text']
        }
      ]
    })

    assert.ok(
      sql.includes(
        "INSERT INTO quote_translations (quote_id, language_code, content) VALUES (119, 'zh', 'only text');"
      )
    )
    assert.equal(/INSERT INTO quote_tags/i.test(sql), false)
    assert.equal(/INSERT INTO quote_characters/i.test(sql), false)
    assert.equal(
      /quote_translations \(quote_id, language_code, content\) VALUES \(\d+, 'en'/i.test(sql),
      false
    )
  })

  it('skips books with empty highlights without inserting quotes', () => {
    const { sql, totalQuotes } = generateWereadImportSql({
      generatedAt: '2026-01-01T00:00:00.000Z',
      books: [{ wereadBookId: 'x', title: 'Empty', author: 'A', highlights: [] }]
    })
    assert.equal(totalQuotes, 0)
    assert.ok(sql.includes('跳过 Empty'))
    assert.equal(/INSERT INTO quotes/i.test(sql), false)
  })
})
