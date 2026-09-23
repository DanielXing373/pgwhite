import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildFilterSql } from '../../server/utils/quoteFilters'

const defaultConfig = {
  tagKindColumn: 'source_code',
  tagKindTime: '1',
  tagKindTheme: '2',
  tagKindDevice: '3'
}

describe('buildFilterSql — current filter semantics', () => {
  it('within one dimension, multiple ids use IN (OR)', () => {
    const { fragments, params } = buildFilterSql({ books: '1,2' }, defaultConfig)
    assert.equal(fragments.length, 1)
    assert.ok(fragments[0].includes('q.book_id IN (?,?)'))
    assert.deepEqual(params, ['1', '2'])
  })

  it('without authors: books AND characters are ANDed as separate fragments', () => {
    const { fragments, params } = buildFilterSql(
      { books: '10', characters: '3,4' },
      defaultConfig
    )
    assert.equal(fragments.length, 2)
    assert.equal(fragments[0], 'q.book_id IN (?)')
    assert.ok(fragments[1].includes('quote_characters'))
    assert.ok(fragments[1].includes('character_id IN (?,?)'))
    assert.deepEqual(params, ['10', '3', '4'])
    assert.ok(fragments.join(' AND ').includes(' AND '))
  })

  it('with authors selected: authors ∪ books ∪ characters become a single OR group', () => {
    const { fragments, params } = buildFilterSql(
      { authors: '1', books: '99', characters: '5' },
      defaultConfig
    )
    assert.equal(fragments.length, 1)
    assert.ok(fragments[0].startsWith('('))
    assert.ok(fragments[0].includes(' OR '))
    assert.ok(fragments[0].includes('au.id IN (?)'))
    assert.ok(fragments[0].includes('q.book_id IN (?)'))
    assert.ok(fragments[0].includes('quote_characters'))
    assert.deepEqual(params, ['1', '99', '5'])
  })

  it('tag dimensions without *All use single EXISTS + IN (OR within dimension)', () => {
    const { fragments, params } = buildFilterSql({ themes: '7,8' }, defaultConfig)
    assert.equal(fragments.length, 1)
    assert.ok(fragments[0].includes('quote_tags'))
    assert.ok(fragments[0].includes('source_code = ?'))
    assert.ok(fragments[0].includes('tg.id IN (?,?)'))
    assert.deepEqual(params, [2, '7', '8'])
  })

  it('themesAll=true emits one EXISTS per id (AND within dimension)', () => {
    const { fragments, params } = buildFilterSql(
      { themes: '7,8', themesAll: 'true' },
      defaultConfig
    )
    assert.equal(fragments.length, 2)
    assert.ok(fragments.every(f => f.includes('tg.id = ?')))
    assert.deepEqual(params, [2, '7', 2, '8'])
  })

  it('times / themes / devices use distinct source_code kind values', () => {
    const { params } = buildFilterSql(
      { times: '1', themes: '2', devices: '3' },
      defaultConfig
    )
    assert.deepEqual(params, [1, '1', 2, '2', 3, '3'])
  })

  it('text search adds LOWER(qt.content) LIKE and ANDs with other filters', () => {
    const { fragments, params } = buildFilterSql({ q: '  Hello ', books: '1' }, defaultConfig)
    assert.equal(fragments[0], 'LOWER(qt.content) LIKE ?')
    assert.equal(params[0], '%hello%')
    assert.ok(fragments[1].includes('book_id'))
  })
})
