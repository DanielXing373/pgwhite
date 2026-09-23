import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LIBRARY_ENTRY_UNIQUE_INDEX,
  isDuplicateLibraryMembershipError,
  validateLibraryMembershipIds
} from '../../server/utils/libraryEntries'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const migration = readFileSync(
  resolve(root, 'database/migrations/0002_users_and_library_entries.sql'),
  'utf8'
)

describe('Sprint 1A schema — users + library_entries', () => {
  it('defines users independently of quotes (no quote FK on users)', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS users/i)
    assert.match(migration, /display_name VARCHAR\(255\) NOT NULL/i)
    assert.match(migration, /created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP/i)
    assert.match(migration, /seed_key VARCHAR\(64\) NULL/i)
    // users table body must not reference quotes
    const usersBlock = migration.slice(
      migration.indexOf('CREATE TABLE IF NOT EXISTS users'),
      migration.indexOf('CREATE TABLE IF NOT EXISTS library_entries')
    )
    assert.equal(/REFERENCES quotes/i.test(usersBlock), false)
  })

  it('library_entries links user↔quote with UNIQUE(user_id, quote_id)', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS library_entries/i)
    assert.match(migration, /UNIQUE KEY uq_library_entries_user_quote \(user_id, quote_id\)/)
    assert.equal(LIBRARY_ENTRY_UNIQUE_INDEX, 'uq_library_entries_user_quote')
    assert.match(migration, /REFERENCES users \(id\)/i)
    assert.match(migration, /REFERENCES quotes \(id\)/i)
  })

  it('does not create favorites tables or favorite_id columns', () => {
    assert.equal(/CREATE TABLE IF NOT EXISTS favorites\b/i.test(migration), false)
    assert.equal(/\bfavorite_id\b/i.test(migration), false)
  })

  it('does not assign legacy quotes to any user (no INSERT into library_entries)', () => {
    assert.equal(/INSERT\s+INTO\s+library_entries/i.test(migration), false)
    assert.equal(/INSERT\s+INTO\s+users/i.test(migration), false)
  })
})

describe('library membership validation + duplicate detection', () => {
  it('accepts positive integer user/quote ids', () => {
    assert.deepEqual(validateLibraryMembershipIds(1, 123), {
      ok: true,
      userId: 1,
      quoteId: 123
    })
  })

  it('rejects invalid ids', () => {
    assert.equal(validateLibraryMembershipIds(0, 1).ok, false)
    assert.equal(validateLibraryMembershipIds(1, -1).ok, false)
    assert.equal(validateLibraryMembershipIds('x', 1).ok, false)
  })

  it('recognizes MySQL duplicate-key errors for (user, quote)', () => {
    assert.equal(
      isDuplicateLibraryMembershipError({
        code: 'ER_DUP_ENTRY',
        errno: 1062,
        message: `Duplicate entry '1-123' for key '${LIBRARY_ENTRY_UNIQUE_INDEX}'`
      }),
      true
    )
    assert.equal(isDuplicateLibraryMembershipError({ code: 'ER_NO_REFERENCED_ROW_2' }), false)
  })
})

describe('shared canonical quote (conceptual uniqueness)', () => {
  it('documents that two users share one quote_id without duplicating quotes rows', () => {
    // Relationship model: two library_entries rows, one quotes.id
    const userAEntry = { user_id: 1, quote_id: 42 }
    const userBEntry = { user_id: 2, quote_id: 42 }
    assert.equal(userAEntry.quote_id, userBEntry.quote_id)
    assert.notEqual(userAEntry.user_id, userBEntry.user_id)
    // Unique key would be (user_id, quote_id) — same quote, different users → two allowed rows
    const key = (e: { user_id: number; quote_id: number }) => `${e.user_id}:${e.quote_id}`
    assert.notEqual(key(userAEntry), key(userBEntry))
  })
})
