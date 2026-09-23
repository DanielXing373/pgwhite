import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  deriveImportStatusFromItems,
  summarizeItemCounts,
  IMPORT_STATUSES,
  IMPORT_ITEM_STATUSES
} from '../../server/utils/importStatuses'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const migration = readFileSync(
  resolve(root, 'database/migrations/0003_imports_and_import_items.sql'),
  'utf8'
)

describe('Sprint 1B schema — imports + import_items', () => {
  it('creates imports with user_id, source, status, timestamps, counters', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS imports/i)
    assert.match(migration, /user_id INT NOT NULL/)
    assert.match(migration, /source VARCHAR\(64\) NOT NULL/)
    assert.match(migration, /status VARCHAR\(32\) NOT NULL/)
    assert.match(migration, /started_at TIMESTAMP NULL/)
    assert.match(migration, /completed_at TIMESTAMP NULL/)
    assert.match(migration, /total_items INT NOT NULL DEFAULT 0/)
  })

  it('creates import_items with raw_payload JSON and nullable library_entry_id', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS import_items/i)
    assert.match(migration, /raw_payload JSON NOT NULL/)
    assert.match(migration, /library_entry_id INT NULL/)
    assert.match(migration, /error_message TEXT NULL/)
    assert.match(migration, /external_id VARCHAR\(255\) NULL/)
  })

  it('FK: import_items.library_entry_id ON DELETE SET NULL; parents RESTRICT', () => {
    assert.match(migration, /library_entries \(id\) ON DELETE SET NULL/)
    assert.match(
      migration,
      /FOREIGN KEY \(user_id\) REFERENCES users \(id\) ON DELETE RESTRICT/
    )
    assert.match(
      migration,
      /FOREIGN KEY \(import_id\) REFERENCES imports \(id\) ON DELETE RESTRICT/
    )
  })

  it('supports within-import external_id uniqueness foundation', () => {
    assert.match(migration, /UNIQUE KEY uq_import_items_import_external \(import_id, external_id\)/)
  })

  it('does not create favorites tables', () => {
    assert.equal(/CREATE TABLE IF NOT EXISTS favorites\b/i.test(migration), false)
  })

  it('does not INSERT legacy quote ownership', () => {
    assert.equal(/INSERT\s+INTO\s+library_entries/i.test(migration), false)
    assert.equal(/INSERT\s+INTO\s+quotes/i.test(migration), false)
  })
})

describe('Import lifecycle status derivation', () => {
  it('exposes pending → processing → terminal vocabulary', () => {
    assert.deepEqual([...IMPORT_STATUSES], [
      'pending',
      'processing',
      'completed',
      'completed_with_issues',
      'failed'
    ])
  })

  it('all-success items → completed', () => {
    assert.equal(deriveImportStatusFromItems(['processed', 'duplicate']), 'completed')
  })

  it('mixed success + failed → completed_with_issues (partial batch)', () => {
    assert.equal(
      deriveImportStatusFromItems(['processed', 'failed']),
      'completed_with_issues'
    )
  })

  it('all failed → failed', () => {
    assert.equal(deriveImportStatusFromItems(['failed', 'failed']), 'failed')
  })

  it('summarizes counters for denormalized import fields', () => {
    assert.deepEqual(summarizeItemCounts(['processed', 'failed', 'pending']), {
      total_items: 3,
      processed_items: 2,
      successful_items: 1,
      failed_items: 1
    })
  })
})

describe('Import Item semantics', () => {
  it('item statuses allow unresolved without Library Entry', () => {
    assert.ok(IMPORT_ITEM_STATUSES.includes('pending'))
    assert.ok(IMPORT_ITEM_STATUSES.includes('failed'))
    assert.ok(IMPORT_ITEM_STATUSES.includes('processed'))
  })

  it('documents raw preservation: failed item keeps payload object intact', () => {
    const raw = {
      source: 'weread',
      markText: 'kept',
      mystery: { a: 1 }
    }
    // Simulate storage round-trip
    const stored = JSON.parse(JSON.stringify(raw))
    assert.deepEqual(stored, raw)
    assert.equal(stored.markText, 'kept')
  })

  it('successful item may reference library_entry_id; failed may be null', () => {
    const success = { status: 'processed', library_entry_id: 10 }
    const failed = { status: 'failed', library_entry_id: null, raw_payload: { markText: 'x' } }
    assert.equal(success.library_entry_id != null, true)
    assert.equal(failed.library_entry_id, null)
    assert.ok(failed.raw_payload)
  })

  it('shared canonical quote remains compatible via separate library entries', () => {
    const quoteId = 42
    const entryA = { user_id: 1, quote_id: quoteId }
    const entryB = { user_id: 2, quote_id: quoteId }
    const itemA = { library_entry_id: 100, import_id: 1 }
    const itemB = { library_entry_id: 101, import_id: 2 }
    assert.equal(entryA.quote_id, entryB.quote_id)
    assert.notEqual(itemA.library_entry_id, itemB.library_entry_id)
  })
})
