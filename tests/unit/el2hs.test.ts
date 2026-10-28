import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DATASET_VERSION,
  INTERNAL_MASTER_SHA256,
  QUESTIONS_PER_PARTICIPANT,
  SOURCE_IDS
} from '../../server/utils/el2hs/constants'
import {
  assertPermutation,
  buildAssignment,
  emptyCounters,
  sourceForChoice
} from '../../server/utils/el2hs/assign'
import { loadInternalMaster, quoteIds, sha256Buffer } from '../../server/utils/el2hs/dataset'
import { createMemoryStore } from '../../server/utils/el2hs/memoryStore'
import {
  assertNoSourceLeak,
  displayAuthorName,
  publicQuestion,
  sectionNotices,
  toPublicSession
} from '../../server/utils/el2hs/publicPayload'
import { parseSessionCookie } from '../../server/utils/el2hs/cookie'
import { COPY } from '../../server/utils/el2hs/copy'
import {
  EXPORT_COLUMNS,
  assertBodyKeys,
  createOrResumeSession,
  exportRows,
  loadAuthenticated,
  qualityFlags,
  resetMasterCache,
  saveDraft,
  submitSession,
  toCsv
} from '../../server/utils/el2hs/service'
import { deployEnv, modePolicy } from '../../server/utils/el2hs/policy'
import { createMemoryRateLimiter, rateLimitConfig } from '../../server/utils/el2hs/rateLimit'

const root = process.cwd()

describe('EL2 human-study dataset', () => {
  it('loads the frozen 20-quote master with matching SHA-256', () => {
    const loaded = loadInternalMaster(root)
    assert.equal(loaded.sha256, INTERNAL_MASTER_SHA256)
    assert.equal(loaded.master.dataset_version, DATASET_VERSION)
    assert.equal(loaded.master.quotes.length, 20)
    for (const q of loaded.master.quotes) {
      assert.ok(q.attribution.author_name_zh)
      assert.ok(q.attribution.book_title_zh)
      assert.ok(q.text_zh.length > 0)
    }
    const disk = sha256Buffer(
      readFileSync(resolve(root, 'research/retrieval/formal-study/el2/human-study/datasets/el2-hs-questions.internal.v1.json'))
    )
    assert.equal(disk, INTERNAL_MASTER_SHA256)
  })
})

describe('EL2 assignment', () => {
  it('assigns 10 unique quotes, permutes A–D, and keeps E as none', () => {
    const { master } = loadInternalMaster(root)
    const ids = quoteIds(master)
    const assignment = buildAssignment(ids, emptyCounters(ids), () => 0)
    assert.equal(assignment.items.length, QUESTIONS_PER_PARTICIPANT)
    assert.equal(new Set(assignment.items.map(i => i.quote_id)).size, 10)
    assert.equal(assignment.items.filter(i => i.section === 1).length, 5)
    assert.equal(assignment.items.filter(i => i.section === 2).length, 5)
    for (const item of assignment.items) {
      assertPermutation(item)
      assert.equal(sourceForChoice(item, 'E'), 'none')
    }
  })

  it('does not reshuffle an existing memory session', () => {
    const { master } = loadInternalMaster(root)
    const ids = quoteIds(master)
    const store = createMemoryStore(ids)
    const first = store.createWithAssignment({
      publicId: 'a'.repeat(64),
      token: 'b'.repeat(64),
      studyMode: 'test',
      protocolVersion: 'p',
      datasetVersion: DATASET_VERSION,
      randomizationVersion: 'el2-assignment.v1',
      copyVersion: 'el2-hs-copy.v1',
      build: c => buildAssignment(ids, c)
    })
    const again = store.authenticate('a'.repeat(64), 'b'.repeat(64))
    assert.deepEqual(again?.assignment, first.assignment)
  })

  it('rejects a wrong session token', () => {
    const { master } = loadInternalMaster(root)
    const ids = quoteIds(master)
    const store = createMemoryStore(ids)
    store.createSession({
      publicId: 'c'.repeat(64),
      token: 'd'.repeat(64),
      studyMode: 'test',
      assignment: buildAssignment(ids, emptyCounters(ids), () => 0),
      protocolVersion: 'p',
      datasetVersion: DATASET_VERSION,
      randomizationVersion: 'r',
      copyVersion: 'c'
    })
    assert.equal(store.authenticate('c'.repeat(64), 'e'.repeat(64)), null)
  })

  it('locks answers after submit', () => {
    const { master } = loadInternalMaster(root)
    const ids = quoteIds(master)
    const store = createMemoryStore(ids)
    const assignment = buildAssignment(ids, emptyCounters(ids), () => 0)
    const session = store.createSession({
      publicId: 'f'.repeat(64),
      token: '1'.repeat(64),
      studyMode: 'test',
      assignment,
      protocolVersion: 'p',
      datasetVersion: DATASET_VERSION,
      randomizationVersion: 'r',
      copyVersion: 'c'
    })
    const items = assignment.items.map(i => ({
      position: i.position,
      quote_id: i.quote_id,
      choice: 'E' as const,
      answered_at: new Date().toISOString()
    }))
    assert.equal(store.submit(session, items).already, false)
    assert.equal(store.submit(session, items).already, true)
    assert.throws(() => store.saveDraft(session, items))
  })
})

describe('EL2 public payload', () => {
  it('omits source identities from participant JSON', () => {
    const { master, quotesById } = loadInternalMaster(root)
    const ids = quoteIds(master)
    const assignment = buildAssignment(ids, emptyCounters(ids), () => 0)
    const q = publicQuestion(quotesById.get(assignment.items[0].quote_id)!, assignment.items[0])
    assertNoSourceLeak(q, 'question')
    assert.equal(q.options.length, 4)
    const session = toPublicSession(
      {
        id: 1,
        session_public_id: 'x',
        session_token_hash: 'y',
        study_mode: 'test',
        experimental_group: assignment.group,
        protocol_version: 'p',
        dataset_version: DATASET_VERSION,
        randomization_version: 'r',
        copy_version: 'c',
        assignment,
        consented: true,
        consented_at: null,
        completion_status: 'in_progress',
        created_at: '',
        last_seen_at: '',
        submitted_at: null
      },
      quotesById,
      {}
    )
    assertNoSourceLeak(session, 'session')
    assert.match(COPY.disclosure_notice, /AI/)
    assert.equal(COPY.disclosure_notice.includes('四组都是'), false)
  })
})

describe('EL2 author display', () => {
  it('drops a leading nationality bracket so all authors are shown alike', () => {
    assert.equal(displayAuthorName('[波兰]斯坦尼斯瓦夫·莱姆'), '斯坦尼斯瓦夫·莱姆')
    assert.equal(displayAuthorName('赫尔曼·黑塞'), '赫尔曼·黑塞')
    const { master, quotesById } = loadInternalMaster(root)
    for (const id of quoteIds(master)) {
      const item = { position: 1, section: 1 as const, quote_id: id, option_a_source: SOURCE_IDS[0], option_b_source: SOURCE_IDS[1], option_c_source: SOURCE_IDS[2], option_d_source: SOURCE_IDS[3] }
      assert.doesNotMatch(publicQuestion(quotesById.get(id)!, item).author_name_zh ?? '', /^[\[［【(（]/)
    }
  })
})

describe('EL2 cookie', () => {
  it('parses only 64-hex public id and token', () => {
    const id = 'ab'.repeat(32)
    const token = 'cd'.repeat(32)
    assert.deepEqual(parseSessionCookie(`${id}.${token}`), { publicId: id, token })
    assert.equal(parseSessionCookie('1.2'), null)
    assert.equal(parseSessionCookie(undefined), null)
  })
})

describe('EL2 randomization simulation (memory store)', () => {
  it('keeps group and quote exposure reasonably balanced', () => {
    const { master } = loadInternalMaster(root)
    const ids = quoteIds(master)
    const store = createMemoryStore(ids)
    const n = 2000
    for (let i = 0; i < n; i += 1) {
      const session = store.createWithAssignment({
        publicId: i.toString(16).padStart(64, '0'),
        token: (i + 1).toString(16).padStart(64, '0'),
        studyMode: 'test',
        protocolVersion: 'p',
        datasetVersion: DATASET_VERSION,
        randomizationVersion: 'el2-assignment.v1',
        copyVersion: 'c',
        build: c => buildAssignment(ids, c)
      })
      if (i % 10 === 0) continue
      const items = session.assignment.items.map(it => ({
        position: it.position,
        quote_id: it.quote_id,
        choice: 'A' as const,
        answered_at: new Date().toISOString()
      }))
      store.submit(session, items)
    }
    const completed = store.listCompleted('test')
    const control = completed.filter(s => s.experimental_group === 'control').length
    const disclosure = completed.filter(s => s.experimental_group === 'disclosure').length
    assert.equal(completed.length, 1800)
    assert.ok(Math.abs(control - disclosure) / completed.length < 0.05)
    const exposure = Object.fromEntries(ids.map(id => [id, 0]))
    const section1 = Object.fromEntries(ids.map(id => [id, 0]))
    for (const s of completed) {
      for (const item of s.assignment.items) {
        exposure[item.quote_id] += 1
        if (item.section === 1) section1[item.quote_id] += 1
      }
    }
    const values = Object.values(exposure)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const cv = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) / mean
    assert.ok(cv < 0.15, `cv ${cv}`)
    for (const id of ids) {
      const p = section1[id] / exposure[id]
      assert.ok(p >= 0.4 && p <= 0.6, `${id} section1 ${p}`)
    }
  })
})

describe('EL2 participant copy', () => {
  it('never frames the task as 题', () => {
    assert.doesNotMatch(JSON.stringify(COPY), /(?<!主)题/)
  })

  it('differs between groups only by the page-2 disclosure notice', () => {
    assert.equal(COPY.second_section_disclosure, COPY.second_section_control)
    assert.deepEqual(sectionNotices('control'), { 1: null, 2: null })
    assert.deepEqual(sectionNotices('disclosure'), { 1: null, 2: COPY.disclosure_notice })
  })
})

const CONTACT_PATTERN = /followup|contact|wechat|email|phone|微信|邮箱|手机|电话|访谈|联系方式/i

describe('EL2 anonymity (no contact collection)', () => {
  it('questionnaire page and copy request no contact information', () => {
    const page = readFileSync(resolve(root, 'pages/el2test.vue'), 'utf8')
    assert.doesNotMatch(page, CONTACT_PATTERN)
    assert.doesNotMatch(page, /<input|<textarea/)
    assert.doesNotMatch(JSON.stringify(COPY), CONTACT_PATTERN)
  })

  it('migration stores no contact, IP, or user-agent columns', () => {
    const sql = readFileSync(resolve(root, 'database/migrations/0007_el2_human_study.sql'), 'utf8')
    const ddl = sql.replace(/--.*$/gm, '')
    assert.doesNotMatch(ddl, /contact|email|wechat|phone|user_agent|ip_address|ip_hash/i)
    assert.match(ddl, /el2-hs-copy\.v3/)
  })

  it('rejects unexpected body and answer fields instead of storing them', () => {
    assert.deepEqual(assertBodyKeys({ answers: [] }, ['answers']), { answers: [] })
    assert.throws(() => assertBodyKeys({ answers: [], followup_contact: 'a@b.cn' }, ['answers']))
    assert.throws(() => assertBodyKeys({ email: 'a@b.cn' }, ['answers']))
    assert.throws(() => assertBodyKeys(['answers'], ['answers']))
  })

  it('export columns carry no contact or network identifiers', () => {
    const header = toCsv([]).trim()
    assert.equal(header, EXPORT_COLUMNS.join(','))
    assert.doesNotMatch(header, CONTACT_PATTERN)
    assert.doesNotMatch(header, /ip|user_agent/)
  })
})

describe('EL2 deployment mode policy', () => {
  it('detects the deployment environment', () => {
    assert.equal(deployEnv({}), 'local')
    assert.equal(deployEnv({ NODE_ENV: 'development' }), 'local')
    assert.equal(deployEnv({ NODE_ENV: 'production' }), 'production')
    assert.equal(deployEnv({ VERCEL_ENV: 'preview', NODE_ENV: 'production' }), 'preview')
    assert.equal(deployEnv({ VERCEL_ENV: 'production', NODE_ENV: 'production' }), 'production')
  })

  it('never allows test mode on Vercel production, even with the flag', () => {
    const env = { VERCEL_ENV: 'production', NODE_ENV: 'production', EL2_HS_ALLOW_TEST_MODE: '1' }
    assert.deepEqual(modePolicy('test', env), { allowed: false, reason: 'test_mode_disabled' })
    assert.deepEqual(modePolicy('study', env), { allowed: true, store: 'any' })
  })

  it('keeps preview test sessions in memory and preview study closed by default', () => {
    const preview = { VERCEL_ENV: 'preview', NODE_ENV: 'production' }
    assert.equal(modePolicy('test', preview).allowed, false)
    assert.deepEqual(modePolicy('test', { ...preview, EL2_HS_ALLOW_TEST_MODE: '1' }), { allowed: true, store: 'memory' })
    assert.deepEqual(modePolicy('study', preview), { allowed: false, reason: 'study_mode_disabled' })
    assert.equal(modePolicy('study', { ...preview, EL2_HS_ALLOW_PREVIEW_STUDY: '1' }).allowed, true)
  })

  it('allows local test mode and needs an explicit flag on other production builds', () => {
    assert.deepEqual(modePolicy('test', {}), { allowed: true, store: 'any' })
    assert.equal(modePolicy('test', { NODE_ENV: 'production' }).allowed, false)
    assert.deepEqual(modePolicy('test', { NODE_ENV: 'production', EL2_HS_ALLOW_TEST_MODE: '1' }), {
      allowed: true,
      store: 'memory'
    })
  })
})

describe('EL2 session-creation rate limit', () => {
  it('reads defaults and clamps overrides', () => {
    assert.deepEqual(rateLimitConfig({}), { perClient: 20, global: 300, windowSeconds: 600 })
    assert.deepEqual(
      rateLimitConfig({ EL2_HS_RATE_LIMIT_PER_CLIENT: '3', EL2_HS_RATE_LIMIT_GLOBAL: 'x', EL2_HS_RATE_LIMIT_WINDOW_SECONDS: '1' }),
      { perClient: 3, global: 300, windowSeconds: 10 }
    )
  })

  it('blocks a client past its quota, then resets in the next window', async () => {
    let now = 1_000_000
    const limiter = createMemoryRateLimiter(() => now)
    const cfg = { perClient: 2, global: 100, windowSeconds: 60 }
    assert.equal((await limiter.hit('198.51.100.7', cfg)).allowed, true)
    assert.equal((await limiter.hit('198.51.100.7', cfg)).allowed, true)
    const blocked = await limiter.hit('198.51.100.7', cfg)
    assert.equal(blocked.allowed, false)
    assert.ok(!blocked.allowed && blocked.retryAfterSeconds >= 1 && blocked.retryAfterSeconds <= 60)
    assert.equal((await limiter.hit('203.0.113.9', cfg)).allowed, true)
    now += 60_000
    assert.equal((await limiter.hit('198.51.100.7', cfg)).allowed, true)
  })

  it('enforces the global ceiling across clients', async () => {
    const limiter = createMemoryRateLimiter(() => 0)
    const cfg = { perClient: 10, global: 2, windowSeconds: 60 }
    assert.equal((await limiter.hit('a', cfg)).allowed, true)
    assert.equal((await limiter.hit('b', cfg)).allowed, true)
    assert.equal((await limiter.hit('c', cfg)).allowed, false)
  })
})

function withEnv<T>(patch: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const saved = Object.fromEntries(Object.keys(patch).map(k => [k, process.env[k]]))
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  return fn().finally(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })
}

describe('EL2 session flow (memory store, local)', () => {
  const localEnv = { NODE_ENV: undefined, VERCEL_ENV: undefined, EL2_HS_RATE_LIMIT_PER_CLIENT: '2' }

  it('resumes an in-progress session without counting against the limit', () =>
    withEnv(localEnv, async () => {
      resetMasterCache()
      const first = await createOrResumeSession({ studyMode: 'test', clientIp: '192.0.2.1', cookie: null })
      assert.equal(first.error, null)
      if (first.error !== null || !first.token) throw new Error('expected new session')
      const cookie = { publicId: first.session.session_public_id, token: first.token }
      for (let i = 0; i < 5; i += 1) {
        const again = await createOrResumeSession({ studyMode: 'test', clientIp: '192.0.2.1', cookie })
        assert.equal(again.error, null)
        assert.ok(again.error === null && again.resumed && again.token === null)
        assert.equal(again.error === null && again.session.session_public_id, cookie.publicId)
      }
      const recovered = await loadAuthenticated(cookie.publicId, cookie.token)
      assert.equal(recovered?.session.session_public_id, cookie.publicId)
      const second = await createOrResumeSession({ studyMode: 'test', clientIp: '192.0.2.1', cookie: null })
      assert.equal(second.error, null)
      const third = await createOrResumeSession({ studyMode: 'test', clientIp: '192.0.2.1', cookie: null })
      assert.equal(third.error, 'rate_limited')
    }))

  it('refuses study mode without a database', () =>
    withEnv(localEnv, async () => {
      resetMasterCache()
      const r = await createOrResumeSession({ studyMode: 'study', clientIp: '192.0.2.2', cookie: null })
      assert.equal(r.error, 'needs_database')
    }))

  it('refuses test sessions on Vercel production, including existing cookies', () =>
    withEnv(localEnv, async () => {
      resetMasterCache()
      const made = await createOrResumeSession({ studyMode: 'test', clientIp: '192.0.2.3', cookie: null })
      if (made.error !== null || !made.token) throw new Error('expected new session')
      await withEnv({ VERCEL_ENV: 'production', NODE_ENV: 'production', EL2_HS_ALLOW_TEST_MODE: '1' }, async () => {
        const r = await createOrResumeSession({ studyMode: 'test', clientIp: '192.0.2.3', cookie: null })
        assert.equal(r.error, 'mode_disabled')
        assert.equal(await loadAuthenticated(made.session.session_public_id, made.token!), null)
      })
    }))

  it('submits anonymously with exactly the ten answers and exports no extra fields', () =>
    withEnv(localEnv, async () => {
      resetMasterCache()
      const made = await createOrResumeSession({ studyMode: 'test', clientIp: '192.0.2.4', cookie: null })
      if (made.error !== null || !made.token) throw new Error('expected new session')
      const { session_public_id: pid } = made.session
      const token = made.token
      const answers = made.session.assignment.items.map(i => ({ position: i.position, choice: 'B' }))

      await assert.rejects(
        submitSession(pid, token, answers.map(a => ({ ...a, contact: 'a@b.cn' }))),
        /unexpected field/
      )
      const partial = await submitSession(pid, token, answers.slice(0, 9))
      assert.equal(partial.error, 'incomplete')
      await saveDraft(pid, token, answers.slice(0, 3))

      const done = await submitSession(pid, token, answers)
      assert.equal(done.error, null)
      assert.equal(done.error === null && done.public.completion_status, 'completed')
      assertNoSourceLeak(done.error === null && done.public, 'submit-response')

      const rows = (await exportRows('test')).filter(r => r.session_public_id === pid)
      assert.equal(rows.length, QUESTIONS_PER_PARTICIPANT)
      for (const row of rows) {
        assert.deepEqual(Object.keys(row), [...EXPORT_COLUMNS])
        assert.doesNotMatch(JSON.stringify(row), CONTACT_PATTERN)
        assert.equal(row.choice, 'B')
      }
    }))
})

describe('EL2 quality flags', () => {
  const base = {
    id: 1,
    session_public_id: 'f'.repeat(64),
    session_token_hash: '0'.repeat(64),
    study_mode: 'study' as const,
    experimental_group: 'control' as const,
    protocol_version: 'p',
    dataset_version: DATASET_VERSION,
    randomization_version: 'r',
    copy_version: 'c',
    assignment: { algorithm_version: 'a', group: 'control' as const, items: [] },
    consented: true,
    completion_status: 'completed' as const,
    last_seen_at: ''
  }
  const responses = (choices: string[]) =>
    choices.map((choice, i) => ({ position: i + 1, quote_id: `q${i}`, choice: choice as 'A', answered_at: '' }))

  it('flags but never removes fast, uniform, all-none, and burst sessions', () => {
    const t0 = Date.parse('2026-11-01T00:00:00Z')
    const fast = {
      ...base,
      consented_at: new Date(t0).toISOString(),
      created_at: new Date(t0).toISOString(),
      submitted_at: new Date(t0 + 60_000).toISOString()
    }
    assert.deepEqual(qualityFlags(fast, responses(Array(10).fill('A'))), ['fast_completion', 'uniform_letter'])
    const slow = { ...fast, submitted_at: new Date(t0 + 600_000).toISOString() }
    assert.deepEqual(qualityFlags(slow, responses(Array(10).fill('E'))), ['all_none'])
    assert.deepEqual(qualityFlags(slow, responses(['A', 'B', 'C', 'D', 'E', 'A', 'B', 'C', 'D', 'E'])), [])
    const burst = Array.from({ length: 10 }, (_, i) => t0 + i * 1000)
    assert.deepEqual(qualityFlags(slow, responses(['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']), burst), [
      'creation_burst'
    ])
  })
})

describe('EL2 public payload', () => {
  it('shows Theme names without definitions or model identities', () => {
    const { master, quotesById } = loadInternalMaster(root)
    const ids = quoteIds(master)
    const assignment = buildAssignment(ids, emptyCounters(ids), () => 0)
    for (const group of ['control', 'disclosure'] as const) {
      const view = toPublicSession(
        {
          ...{ id: 1, session_public_id: 'a'.repeat(64), session_token_hash: '', study_mode: 'test' },
          experimental_group: group,
          protocol_version: 'p',
          dataset_version: DATASET_VERSION,
          randomization_version: 'r',
          copy_version: 'c',
          assignment: { ...assignment, group },
          consented: true,
          consented_at: null,
          completion_status: 'in_progress',
          created_at: '',
          last_seen_at: '',
          submitted_at: null
        },
        quotesById,
        {}
      )
      assertNoSourceLeak(view, group)
      assert.doesNotMatch(JSON.stringify(view), /definition/)
      assert.equal(view.section_instructions[1], COPY.first_section)
      assert.equal(view.section_notices[1], null)
      assert.equal(view.section_notices[2], group === 'disclosure' ? COPY.disclosure_notice : null)
      if (group === 'control') assert.doesNotMatch(JSON.stringify(view), /AI|人工智能/)
    }
  })
})
