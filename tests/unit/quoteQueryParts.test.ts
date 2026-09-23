import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildQuotesBaseFrom,
  buildQuotesListSelect,
  tagAggSubquery
} from '../../server/utils/quoteQueryParts'

describe('quote query parts — language + partial-quote tolerance', () => {
  it('CURRENT language behavior: quote_translations is INNER JOIN on language_code', () => {
    const sql = buildQuotesBaseFrom('')
    assert.ok(
      sql.includes(
        'INNER JOIN quote_translations qt ON qt.quote_id = q.id AND qt.language_code = ?'
      )
    )
    assert.equal(/LEFT JOIN quote_translations/i.test(sql), false)
  })

  it('CURRENT language behavior: en request uses the same INNER JOIN shape (caller supplies en code)', () => {
    // Documented: zh-only quotes are absent from lang=en because INNER JOIN requires a row.
    const sql = buildQuotesListSelect('source_code', '', 'ASC')
    const join =
      'INNER JOIN quote_translations qt ON qt.quote_id = q.id AND qt.language_code = ?'
    assert.ok(sql.includes(join))
  })

  it('partial quotes: characters aggregated via LEFT JOIN (missing characters still allowed)', () => {
    const sql = buildQuotesListSelect('source_code', '', 'ASC')
    assert.ok(/LEFT JOIN \(\s*SELECT qc\.quote_id/s.test(sql))
    assert.ok(sql.includes('COALESCE(ch.characters_json, JSON_ARRAY())'))
  })

  it('partial quotes: tag dimensions use LEFT JOIN aggregations (untagged quotes still allowed)', () => {
    const sql = buildQuotesListSelect('source_code', '', 'DESC')
    assert.ok(/^\s*LEFT JOIN/i.test(tagAggSubquery('source_code', 'st', 'scene_times_json')))
    assert.ok(sql.includes('COALESCE(st.scene_times_json, JSON_ARRAY())'))
    assert.ok(sql.includes('COALESCE(th.themes_json, JSON_ARRAY())'))
    assert.ok(sql.includes('COALESCE(dv.devices_json, JSON_ARRAY())'))
    assert.equal(/INNER JOIN quote_tags/i.test(sql), false)
  })
})
