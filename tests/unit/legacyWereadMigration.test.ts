import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  IMPORT_PROVENANCE_TYPES,
  LEGACY_WEREAD_RECONSTRUCTION_KEY,
  LEGACY_WEREAD_QUOTE_ID_MIN,
  LEGACY_WEREAD_QUOTE_ID_MAX,
  LEGACY_WEREAD_QUOTE_COUNT,
  LEGACY_GLOBAL_QUOTE_ID_MAX,
  LEGACY_GLOBAL_QUOTE_COUNT,
  DANIEL_SEED_KEY,
  isLegacyWereadQuoteId,
  isLegacyGlobalQuoteId,
  expectedDanielLibraryMembership
} from '../../server/utils/legacyWereadMigration'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const mig4 = readFileSync(
  resolve(root, 'database/migrations/0004_import_provenance_type_and_library_entry_import_id.sql'),
  'utf8'
)
const mig5 = readFileSync(
  resolve(root, 'database/migrations/0005_migrate_legacy_weread_to_daniel_library.sql'),
  'utf8'
)

describe('Sprint 1C schema — provenance_type + library_entries.import_id', () => {
  it('adds imports.provenance_type with runtime default', () => {
    assert.match(mig4, /ADD COLUMN provenance_type VARCHAR\(32\) NOT NULL DEFAULT 'runtime'/i)
  })

  it('adds unique reconstruction_key for idempotent reconstructed Imports', () => {
    assert.match(mig4, /ADD COLUMN reconstruction_key VARCHAR\(64\) NULL/i)
    assert.match(mig4, /UNIQUE KEY uq_imports_reconstruction_key \(reconstruction_key\)/i)
  })

  it('adds nullable library_entries.import_id FK ON DELETE SET NULL', () => {
    assert.match(mig4, /ADD COLUMN import_id INT NULL DEFAULT NULL/i)
    assert.match(
      mig4,
      /FOREIGN KEY \(import_id\) REFERENCES imports \(id\) ON DELETE SET NULL/i
    )
  })

  it('documents batch-level path without replacing import_items', () => {
    assert.match(mig4, /batch-level/i)
    assert.match(mig4, /ImportItem/i)
  })
})

describe('Sprint 1C data migration SQL — WeRead → Daniel library', () => {
  it('targets Daniel via seed_key and reconstruction_key', () => {
    assert.match(mig5, new RegExp(DANIEL_SEED_KEY))
    assert.match(mig5, new RegExp(LEGACY_WEREAD_RECONSTRUCTION_KEY))
    assert.match(mig5, /provenance_type[\s\S]*'reconstructed'/)
    assert.match(mig5, /source[\s\S]*'weread'/)
  })

  it('inserts library_entries only for quote ids 119–1287', () => {
    assert.match(mig5, /WHERE q\.id BETWEEN 119 AND 1287/)
    assert.match(mig5, /quote_id BETWEEN 1 AND 118/)
    assert.match(mig5, /ON DUPLICATE KEY UPDATE/i)
  })

  it('does not INSERT into import_items (no synthetic items)', () => {
    assert.equal(/INSERT\s+INTO\s+import_items/i.test(mig5), false)
  })

  it('does not modify quotes / quote_translations / quote_tags', () => {
    assert.equal(/INSERT\s+INTO\s+quotes\b/i.test(mig5), false)
    assert.equal(/UPDATE\s+quotes\b/i.test(mig5), false)
    assert.equal(/INSERT\s+INTO\s+quote_translations/i.test(mig5), false)
    assert.equal(/INSERT\s+INTO\s+quote_tags/i.test(mig5), false)
  })

  it('asserts zero ImportItems for reconstructed batch', () => {
    assert.match(mig5, /import_items/i)
    assert.match(mig5, /reconstruction_key = 'legacy_weread_batch_2026-07-26'/)
  })

  it('leaves started_at / completed_at NULL (no invented runtime times)', () => {
    assert.match(mig5, /NULL,\s*\n\s*NULL,\s*\n\s*1169/)
  })
})

describe('Sprint 1C membership boundary helpers', () => {
  it('Quote 118 → not Daniel Library; 119 and 1287 → Daniel Library', () => {
    assert.equal(expectedDanielLibraryMembership(118), false)
    assert.equal(expectedDanielLibraryMembership(119), true)
    assert.equal(expectedDanielLibraryMembership(1287), true)
  })

  it('range counts match reconstruction (1169 WeRead + 118 global)', () => {
    assert.equal(LEGACY_WEREAD_QUOTE_COUNT, LEGACY_WEREAD_QUOTE_ID_MAX - LEGACY_WEREAD_QUOTE_ID_MIN + 1)
    assert.equal(LEGACY_WEREAD_QUOTE_COUNT, 1169)
    assert.equal(LEGACY_GLOBAL_QUOTE_COUNT, LEGACY_GLOBAL_QUOTE_ID_MAX)
    assert.equal(isLegacyGlobalQuoteId(1), true)
    assert.equal(isLegacyGlobalQuoteId(118), true)
    assert.equal(isLegacyGlobalQuoteId(119), false)
    assert.equal(isLegacyWereadQuoteId(118), false)
    assert.equal(isLegacyWereadQuoteId(119), true)
    assert.equal(isLegacyWereadQuoteId(1287), true)
  })

  it('exposes runtime | reconstructed provenance vocabulary', () => {
    assert.deepEqual([...IMPORT_PROVENANCE_TYPES], ['runtime', 'reconstructed'])
  })
})

describe('Sprint 1C.0 reconstruction artifact alignment', () => {
  it('artifact agrees on WeRead HIGH count and id range when present', () => {
    const path = resolve(root, 'analysis/legacy-provenance-reconstruction.json')
    assert.equal(existsSync(path), true)
    const art = JSON.parse(readFileSync(path, 'utf8'))
    assert.equal(art.aggregate.weread_import.total, LEGACY_WEREAD_QUOTE_COUNT)
    assert.equal(art.aggregate.weread_import.HIGH, LEGACY_WEREAD_QUOTE_COUNT)
    assert.equal(art.aggregate.legacy_curated.total, LEGACY_GLOBAL_QUOTE_COUNT)
    assert.equal(art.weread_coverage.sql_id_min, LEGACY_WEREAD_QUOTE_ID_MIN)
    assert.equal(art.weread_coverage.sql_id_max, LEGACY_WEREAD_QUOTE_ID_MAX)
    assert.equal(art.production_quote_count, 1287)

    const wereadIds = art.quotes
      .filter((q: { provenance_class: string }) => q.provenance_class === 'weread_import')
      .map((q: { quote_id: number }) => q.quote_id)
    assert.equal(wereadIds.length, 1169)
    assert.equal(Math.min(...wereadIds), 119)
    assert.equal(Math.max(...wereadIds), 1287)

    // Boundary quotes
    const byId = new Map(
      art.quotes.map((q: { quote_id: number; provenance_class: string }) => [
        q.quote_id,
        q.provenance_class
      ])
    )
    assert.equal(byId.get(118), 'legacy_curated')
    assert.equal(byId.get(119), 'weread_import')
    assert.equal(byId.get(1287), 'weread_import')
  })

  it('analysis README declares non-runtime forensic purpose', () => {
    const readme = readFileSync(resolve(root, 'analysis/README.md'), 'utf8')
    assert.match(readme, /NOT.*runtime/i)
    assert.match(readme, /forensic/i)
  })
})
