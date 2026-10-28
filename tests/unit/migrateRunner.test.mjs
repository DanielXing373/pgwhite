import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertSafeTarget,
  isRemoteHost,
  parseArgs,
  resolveOnly,
  selectMigrations
} from '../../scripts/migrate.mjs'

const FILES = [
  '0001_baseline_current_schema.sql',
  '0002_users_and_library_entries.sql',
  '0005_migrate_legacy_weread_to_daniel_library.sql',
  '0006_canonical_matching_and_personal_layer.sql',
  '0007_el2_human_study.sql'
]

describe('migrate runner: argument parsing', () => {
  it('keeps plain up and status unchanged', () => {
    assert.deepEqual(parseArgs(['up']), { cmd: 'up', only: null })
    assert.deepEqual(parseArgs(['status']), { cmd: 'status' })
  })

  it('accepts --only <version> and --only=<version>', () => {
    assert.deepEqual(parseArgs(['up', '--only', '0007']), { cmd: 'up', only: '0007' })
    assert.deepEqual(parseArgs(['up', '--only=0007']), { cmd: 'up', only: '0007' })
  })

  it('rejects missing, repeated, non-numeric, or unknown arguments', () => {
    assert.throws(() => parseArgs(['up', '--only']))
    assert.throws(() => parseArgs(['up', '--only', '0007', '--only', '0006']))
    assert.throws(() => parseArgs(['up', '--only', '0007', 'extra']))
    assert.throws(() => parseArgs(['up', '--only', 'el2']))
    assert.throws(() => parseArgs(['up', '--force']))
    assert.throws(() => parseArgs(['up', '0007']))
    assert.throws(() => parseArgs(['status', '--only', '0007']))
    assert.throws(() => parseArgs(['mark']))
    assert.throws(() => parseArgs(['mark', '0001', '0002']))
  })

  it('reports unknown commands as invalid', () => {
    assert.equal(parseArgs(['migrate']).cmd, 'invalid')
    assert.equal(parseArgs([]).cmd, 'help')
  })
})

describe('migrate runner: migration selection', () => {
  it('without --only, selects every pending migration in order', () => {
    assert.deepEqual(selectMigrations(FILES, new Set(['0001']), null), FILES.slice(1))
  })

  it('with --only 0007, selects only 0007 even when 0001–0006 are pending', () => {
    assert.deepEqual(selectMigrations(FILES, new Set(), '0007'), ['0007_el2_human_study.sql'])
  })

  it('does not select 0007 again once it is recorded as applied', () => {
    assert.deepEqual(selectMigrations(FILES, new Set(['0007']), '0007'), [])
  })

  it('rejects unknown versions and prefixes', () => {
    assert.throws(() => resolveOnly(FILES, '0099'), /Unknown migration version/)
    assert.throws(() => resolveOnly(FILES, '7'), /Unknown migration version/)
    assert.throws(() => resolveOnly(FILES, '000'), /Unknown migration version/)
  })
})

describe('migrate runner: remote-write protection', () => {
  const saved = process.env.MIGRATE_ALLOW_REMOTE
  afterEach(() => {
    if (saved === undefined) delete process.env.MIGRATE_ALLOW_REMOTE
    else process.env.MIGRATE_ALLOW_REMOTE = saved
  })

  it('treats Railway public proxy and private network hosts as remote', () => {
    assert.equal(isRemoteHost('abc.proxy.rlwy.net'), true)
    assert.equal(isRemoteHost('mysql.railway.internal'), true)
    assert.equal(isRemoteHost('127.0.0.1'), false)
  })

  it('refuses remote writes without MIGRATE_ALLOW_REMOTE=1, including railway.internal', () => {
    delete process.env.MIGRATE_ALLOW_REMOTE
    for (const host of ['abc.proxy.rlwy.net', 'mysql.railway.internal']) {
      assert.throws(() => assertSafeTarget({ host, database: 'railway' }, { writing: true }), /Refusing remote host/)
      assert.doesNotThrow(() => assertSafeTarget({ host, database: 'railway' }, { writing: false }))
    }
  })

  it('allows remote writes only with MIGRATE_ALLOW_REMOTE=1', () => {
    process.env.MIGRATE_ALLOW_REMOTE = '1'
    assert.doesNotThrow(() => assertSafeTarget({ host: 'mysql.railway.internal', database: 'railway' }, { writing: true }))
  })
})
