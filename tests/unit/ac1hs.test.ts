import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  COPY_VERSION,
  DATASET_VERSION,
  INTERNAL_MASTER_CONTENT_SHA256,
  POOL_SIZE,
  PROTOCOL_VERSION,
  QUESTIONS_PER_PARTICIPANT,
  RANDOMIZATION_VERSION,
  SOURCE_IDS
} from '../../server/utils/ac1hs/constants'
import { buildAssignment, emptyCounters, applyAssignmentToCounters } from '../../server/utils/ac1hs/assign'
import { contentSha256, loadInternalMaster, quoteIds } from '../../server/utils/ac1hs/dataset'
import { AC1_INTERNAL_MASTER } from '../../server/utils/ac1hs/dataset.generated'
import { createMemoryStore } from '../../server/utils/ac1hs/memoryStore'
import {
  assertNoSourceLeak,
  displayBookTitle,
  publicQuestion,
  toPublicSession
} from '../../server/utils/ac1hs/publicPayload'
import { parseSessionCookie } from '../../server/utils/ac1hs/cookie'
import { COPY } from '../../server/utils/ac1hs/copy'
import { modePolicy } from '../../server/utils/ac1hs/policy'
import {
  BadRequestError,
  createOrResumeSession,
  exportRows,
  EXPORT_COLUMNS,
  loadAuthenticated,
  metaPayload,
  normalizeAnswers,
  qualityFlags,
  resetMasterCache,
  saveDraft,
  submitSession,
  toCsv
} from '../../server/utils/ac1hs/service'
import type { SessionRecord } from '../../server/utils/ac1hs/types'

const loaded = loadInternalMaster()
const ids = quoteIds(loaded.master)

/** Deterministic PRNG so assignment tests are repeatable. */
function seeded(seed: number) {
  let s = seed >>> 0
  return (maxExclusive: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s % maxExclusive
  }
}

function fakeSession(group: 'control' | 'disclosure' = 'control'): SessionRecord {
  const assignment = buildAssignment(ids, emptyCounters(ids), seeded(7))
  assignment.group = group
  return {
    id: 1,
    session_public_id: 'a'.repeat(64),
    session_token_hash: 'b'.repeat(64),
    study_mode: 'test',
    experimental_group: group,
    protocol_version: PROTOCOL_VERSION,
    dataset_version: DATASET_VERSION,
    randomization_version: RANDOMIZATION_VERSION,
    copy_version: COPY_VERSION,
    assignment,
    consented: true,
    consented_at: '2026-11-12T00:00:00.000Z',
    completion_status: 'in_progress',
    created_at: '2026-11-12T00:00:00.000Z',
    last_seen_at: '2026-11-12T00:00:00.000Z',
    submitted_at: null
  }
}

function tagsOf(session: SessionRecord, position: number) {
  const item = session.assignment.items.find(i => i.position === position)!
  return loaded.quotesById.get(item.quote_id)!.tags
}

describe('AC1 questionnaire dataset', () => {
  it('is frozen, has 20 attributed excerpts, and matches the content hash', () => {
    assert.equal(loaded.master.quotes.length, POOL_SIZE)
    assert.equal(loaded.sha256, INTERNAL_MASTER_CONTENT_SHA256)
    assert.equal(contentSha256(AC1_INTERNAL_MASTER.quotes), AC1_INTERNAL_MASTER.content_sha256)
    assert.deepEqual(loaded.master.source_ids, [...SOURCE_IDS])
    for (const quote of loaded.master.quotes) {
      assert.ok(quote.attribution.author_name_zh && quote.attribution.book_title_zh)
      assert.ok(quote.tags.length >= 2)
      assert.equal(new Set(quote.tags.map(t => t.tag_id)).size, quote.tags.length)
      // grouped by dimension in display order
      const order = quote.tags.map(t => ['theme', 'rhetoric', 'technique'].indexOf(t.dimension))
      assert.deepEqual(order, [...order].sort((a, b) => a - b))
    }
  })

  it('refuses a tampered question set', () => {
    const tampered = structuredClone(AC1_INTERNAL_MASTER)
    tampered.quotes[0]!.text_zh += '。'
    assert.throws(() => loadInternalMaster(tampered), /SHA-256 mismatch/)
  })

  // The research copy lives on the research branch only; compare when it is present locally.
  const researchCopy = resolve(
    process.cwd(),
    'research/annotation-competition/questionnaire/ac1-hs-questions.internal.v1.json'
  )
  it('the generated module and the research JSON are the same data', { skip: !existsSync(researchCopy) }, () => {
    const json = JSON.parse(readFileSync(researchCopy, 'utf8'))
    assert.deepEqual(json, JSON.parse(JSON.stringify(AC1_INTERNAL_MASTER)))
  })

  it('the migration seeds the same versions and hash as the server constants', () => {
    const sql = readFileSync(resolve(process.cwd(), 'database/migrations/0008_ac1_human_study.sql'), 'utf8')
    for (const value of [PROTOCOL_VERSION, DATASET_VERSION, RANDOMIZATION_VERSION, COPY_VERSION, INTERNAL_MASTER_CONTENT_SHA256]) {
      assert.ok(sql.includes(`'${value}'`), `migration is missing ${value}`)
    }
    const statements = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)
    assert.ok(!statements.some(s => /\bel2_hs_/.test(s)), 'migration must not touch el2_hs_* tables')
    for (const s of statements) {
      assert.match(s, /^(CREATE TABLE IF NOT EXISTS ac1_hs_|INSERT IGNORE INTO ac1_hs_)/, `not additive: ${s.slice(0, 60)}`)
    }
    assert.equal(statements.filter(s => s.startsWith('CREATE TABLE')).length, 8)
  })
})

describe('AC1 assignment', () => {
  it('gives 10 unique excerpts, 5 per page, positions 1–10', () => {
    const a = buildAssignment(ids, emptyCounters(ids), seeded(1))
    assert.equal(a.items.length, QUESTIONS_PER_PARTICIPANT)
    assert.equal(new Set(a.items.map(i => i.quote_id)).size, 10)
    assert.deepEqual(a.items.map(i => i.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    assert.deepEqual(a.items.map(i => i.section), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2])
    assert.deepEqual(Object.keys(a.items[0]!).sort(), ['position', 'quote_id', 'section'])
  })

  it('balances groups and excerpt exposure over many sessions', () => {
    const counters = emptyCounters(ids)
    const rand = seeded(42)
    for (let i = 0; i < 200; i += 1) applyAssignmentToCounters(counters, buildAssignment(ids, counters, rand), 'completed')
    assert.equal(counters.group.control.completed, 100)
    assert.equal(counters.group.disclosure.completed, 100)
    const totals = Object.values(counters.quote).map(q => q.total)
    assert.equal(totals.reduce((a, b) => a + b, 0), 2000)
    // Same tolerances as the el2hs simulation test: the algorithm is unchanged.
    const mean = 2000 / totals.length
    const cv = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length) / mean
    assert.ok(cv < 0.15, `cv ${cv}`)
    for (const [id, q] of Object.entries(counters.quote)) {
      const p = q.bySection[1] / q.total
      assert.ok(p >= 0.4 && p <= 0.6, `${id} section1 ${p}`)
    }
  })
})

describe('AC1 public payload', () => {
  it('shows tag names grouped by dimension and never the source of a tag', () => {
    const session = fakeSession('disclosure')
    const body = toPublicSession(session, loaded.quotesById, {})
    assert.doesNotThrow(() => assertNoSourceLeak(body, 'test'))
    const json = JSON.stringify(body)
    for (const id of SOURCE_IDS) assert.ok(!json.includes(id))
    for (const q of body.questions) {
      assert.ok(q.groups.length >= 1)
      for (const g of q.groups) {
        assert.ok(g.tags.length >= 1)
        assert.ok(['主题', '修辞', '描写手法'].includes(g.label_zh))
        for (const t of g.tags) assert.deepEqual(Object.keys(t).sort(), ['label_zh', 'tag_id'])
      }
      assert.equal(q.none_label_zh, '都不合适')
      assert.ok(q.author_name_zh && q.book_title_zh)
    }
    assert.throws(() => assertNoSourceLeak({ x: 'gpt-6-luna-low' }, 'test'), /leaked/)
    assert.throws(() => assertNoSourceLeak(AC1_INTERNAL_MASTER, 'test'), /leaked/)
  })

  it('shows the AI notice only to the disclosure group on page 2', () => {
    const control = toPublicSession(fakeSession('control'), loaded.quotesById, {})
    const disclosure = toPublicSession(fakeSession('disclosure'), loaded.quotesById, {})
    assert.deepEqual(control.section_notices, { 1: null, 2: null })
    assert.deepEqual(disclosure.section_notices, { 1: null, 2: COPY.disclosure_notice })
    assert.deepEqual(control.section_instructions, disclosure.section_instructions)
  })

  it('strips edition blurbs from book titles for display only', () => {
    assert.equal(displayBookTitle('局外人（译文经典）'), '局外人')
    assert.equal(displayBookTitle('一个叫欧维的男人决定去死（同名电影原著）'), '一个叫欧维的男人决定去死')
    assert.equal(displayBookTitle('显克维奇中短篇小说选（人文社外国文学名著经典·网格本）'), '显克维奇中短篇小说选')
    assert.equal(displayBookTitle('冰岛往事.1，狂暴海'), '冰岛往事.1，狂暴海')
    assert.equal(displayBookTitle('（全是括号）'), '（全是括号）')
    const item = { position: 1, section: 1 as const, quote_id: 'holdout-036' }
    assert.equal(publicQuestion(loaded.quotesById.get('holdout-036')!, item).book_title_zh, '局外人')
    assert.equal(loaded.quotesById.get('holdout-036')!.attribution.book_title_zh, '局外人（译文经典）')
  })
})

describe('AC1 answers: tick = 合适, no tick = 不合适, every excerpt answered', () => {
  const session = fakeSession()
  const tags = tagsOf(session, 1)
  const first = tags[0]!.tag_id
  const last = tags[tags.length - 1]!.tag_id

  it('accepts ticked tags or 「都不合适」, and stores ticks in display order', () => {
    const [ticked] = normalizeAnswers(session, [{ position: 1, selected: [last, first], none: false }])
    assert.deepEqual(ticked!.selected_tag_ids, [first, last])
    assert.equal(ticked!.none_selected, false)
    const [none] = normalizeAnswers(session, [{ position: 1, selected: [], none: true }])
    assert.deepEqual(none!.selected_tag_ids, [])
    assert.equal(none!.none_selected, true)
  })

  it('rejects an unanswered excerpt, a contradiction, foreign tags, duplicates and stray fields', () => {
    const bad = [
      [{ position: 1, selected: [], none: false }],
      [{ position: 1, selected: [first], none: true }],
      [{ position: 1, selected: ['theme-9999-不存在'], none: false }],
      [{ position: 1, selected: [tagsOf(session, 2).find(t => !tags.some(x => x.tag_id === t.tag_id))?.tag_id ?? 'x'], none: false }],
      [{ position: 1, selected: [first, first], none: false }],
      [{ position: 1, selected: [first] }],
      [{ position: 1, selected: 'x', none: false }],
      [{ position: 11, selected: [], none: true }],
      [{ position: 1, selected: [first], none: false, email: 'a@b.c' }],
      [{ position: 1, choice: 'A' }]
    ]
    for (const raw of bad) assert.throws(() => normalizeAnswers(session, raw), BadRequestError, JSON.stringify(raw))
    assert.throws(() => normalizeAnswers(session, 'nope'), BadRequestError)
  })
})

describe('AC1 memory store', () => {
  it('a draft replaces the previous draft, so an un-ticked excerpt becomes unanswered again', () => {
    const store = createMemoryStore(ids)
    const s = store.createSession({
      publicId: 'c'.repeat(64),
      token: 'd'.repeat(64),
      studyMode: 'test',
      assignment: buildAssignment(ids, emptyCounters(ids), seeded(3)),
      protocolVersion: PROTOCOL_VERSION,
      datasetVersion: DATASET_VERSION,
      randomizationVersion: RANDOMIZATION_VERSION,
      copyVersion: COPY_VERSION
    })
    const answer = (position: number) => ({
      position,
      quote_id: s.assignment.items[position - 1]!.quote_id,
      selected_tag_ids: [] as string[],
      none_selected: true,
      answered_at: new Date().toISOString()
    })
    store.saveDraft(s, [answer(1), answer(2)])
    assert.equal(store.getResponses(s).length, 2)
    store.saveDraft(s, [answer(2)])
    assert.deepEqual(store.getResponses(s).map(r => r.position), [2])
    assert.equal(store.submit(s, [answer(1)]).already, false)
    assert.equal(store.submit(s, [answer(1)]).already, true)
    assert.throws(() => store.saveDraft(s, []), /immutable/)
  })
})

describe('AC1 session flow (memory store, local test mode)', () => {
  it('start → draft → resume → submit → locked, and the export has one row per shown tag', async () => {
    resetMasterCache()
    const created = await createOrResumeSession({ studyMode: 'test', clientIp: '203.0.113.9', cookie: null })
    assert.equal(created.error, null)
    if (created.error !== null) return
    const cookie = { publicId: created.session.session_public_id, token: created.token! }
    assert.ok(parseSessionCookie(`${cookie.publicId}.${cookie.token}`))
    assert.equal(created.public.questions.length, 10)

    const questions = created.public.questions
    const answerFor = (q: (typeof questions)[number], i: number) =>
      i % 3 === 0
        ? { position: q.position, selected: [], none: true }
        : { position: q.position, selected: [q.groups[0]!.tags[0]!.tag_id], none: false }

    const draft = await saveDraft(cookie.publicId, cookie.token, questions.slice(0, 4).map(answerFor))
    assert.equal(draft.error, null)
    assert.equal(Object.keys(draft.public!.answers).length, 4)

    const resumed = await createOrResumeSession({ studyMode: 'test', clientIp: '203.0.113.9', cookie })
    assert.equal(resumed.error, null)
    if (resumed.error === null) {
      assert.equal(resumed.resumed, true)
      assert.equal(Object.keys(resumed.public.answers).length, 4)
    }

    const incomplete = await submitSession(cookie.publicId, cookie.token, questions.slice(0, 9).map(answerFor))
    assert.equal(incomplete.error, 'incomplete')

    const done = await submitSession(cookie.publicId, cookie.token, questions.map(answerFor))
    assert.equal(done.error, null)
    assert.equal(done.public!.completion_status, 'completed')
    assert.deepEqual(done.public!.answers[1], { selected: [], none: true })

    const again = await submitSession(cookie.publicId, cookie.token, questions.map(answerFor))
    assert.equal(again.already, true)
    const locked = await saveDraft(cookie.publicId, cookie.token, [])
    assert.equal(locked.error, 'immutable')
    assert.equal(await loadAuthenticated(cookie.publicId, 'e'.repeat(64)), null)

    const rows = await exportRows('test')
    const shown = questions.reduce((n, q) => n + q.groups.reduce((m, g) => m + g.tags.length, 0), 0)
    assert.equal(rows.length, shown)
    assert.deepEqual(Object.keys(rows[0]!), [...EXPORT_COLUMNS])
    assert.equal(rows.filter(r => r.ticked === 1).length, questions.filter((_, i) => i % 3 !== 0).length)
    assert.ok(rows.every(r => r.ticked === 0 || r.ticked === 1))
    assert.ok(rows.every(r => r.from_deepseek_flash + r.from_gpt_6_luna_low + r.from_gpt_6_luna_medium >= 1))
    assert.ok(rows.filter(r => r.position === 1).every(r => r.none_selected === 1 && r.ticked === 0))
    assert.ok(toCsv(rows).startsWith(EXPORT_COLUMNS.join(',')))
    resetMasterCache()
  })

  it('study mode needs a database; meta carries copy but no sources', async () => {
    resetMasterCache()
    const study = await createOrResumeSession({ studyMode: 'study', clientIp: '203.0.113.10', cookie: null })
    assert.equal(study.error, 'needs_database')
    const meta = metaPayload()
    assert.equal(meta.quote_count, 20)
    assert.equal(meta.copy.none_of_the_above, '都不合适')
    resetMasterCache()
  })
})

describe('AC1 deployment mode policy', () => {
  it('keeps local test sessions out of the database unless opted in', () => {
    assert.deepEqual(modePolicy('test', {}), { allowed: true, store: 'memory' })
    assert.deepEqual(modePolicy('test', { AC1_HS_LOCAL_TEST_MYSQL: '1' }), { allowed: true, store: 'any' })
    assert.deepEqual(modePolicy('study', {}), { allowed: true, store: 'any' })
  })
  it('production allows study only; preview is closed unless flagged', () => {
    assert.equal(modePolicy('test', { VERCEL_ENV: 'production', AC1_HS_ALLOW_TEST_MODE: '1' }).allowed, false)
    assert.deepEqual(modePolicy('study', { VERCEL_ENV: 'production' }), { allowed: true, store: 'any' })
    assert.equal(modePolicy('study', { VERCEL_ENV: 'preview' }).allowed, false)
    assert.equal(modePolicy('study', { VERCEL_ENV: 'preview', AC1_HS_ALLOW_PREVIEW_STUDY: '1' }).allowed, true)
    assert.equal(modePolicy('test', { VERCEL_ENV: 'preview' }).allowed, false)
    assert.deepEqual(modePolicy('test', { VERCEL_ENV: 'preview', AC1_HS_ALLOW_TEST_MODE: '1' }), { allowed: true, store: 'memory' })
    // the earlier questionnaire's flags do not open this one
    assert.equal(modePolicy('test', { VERCEL_ENV: 'preview', EL2_HS_ALLOW_TEST_MODE: '1' }).allowed, false)
  })
})

describe('AC1 quality flags', () => {
  const base = fakeSession()
  const responses = (pick: (position: number) => { selected_tag_ids: string[]; none_selected: boolean }) =>
    base.assignment.items.map(item => ({
      position: item.position,
      quote_id: item.quote_id,
      answered_at: '2026-11-12T00:05:00.000Z',
      ...pick(item.position)
    }))
  it('flags fast, all-none and all-ticked sessions without excluding them', () => {
    const fast = { ...base, submitted_at: '2026-11-12T00:01:00.000Z' }
    const slow = { ...base, submitted_at: '2026-11-12T00:10:00.000Z' }
    const allNone = responses(() => ({ selected_tag_ids: [], none_selected: true }))
    const allTicked = responses(p => ({ selected_tag_ids: tagsOf(base, p).map(t => t.tag_id), none_selected: false }))
    const mixed = responses(p => ({ selected_tag_ids: [tagsOf(base, p)[0]!.tag_id], none_selected: false }))
    assert.deepEqual(qualityFlags(fast, allNone), ['fast_completion', 'all_none'])
    assert.deepEqual(qualityFlags(slow, allTicked), ['all_ticked'])
    assert.deepEqual(qualityFlags(slow, mixed), [])
  })
})

describe('AC1 participant copy and page', () => {
  const page = readFileSync(resolve(process.cwd(), 'pages/ac1test.vue'), 'utf8')
  it('the page imports copy only, never the question set or source ids', () => {
    assert.ok(page.includes("from '../server/utils/ac1hs/copy'"))
    assert.ok(!page.includes('dataset.generated'))
    for (const id of SOURCE_IDS) assert.ok(!page.includes(id))
    assert.ok(!JSON.stringify(COPY).includes('source'))
  })
  it('collects no contact details and has no text inputs', () => {
    assert.ok(!/<input|<textarea/.test(page))
    assert.ok(!/邮箱|手机|微信|联系方式/.test(JSON.stringify(COPY)))
  })
  it('tells an unanswered excerpt to tick a tag or choose 「都不合适」', () => {
    assert.match(COPY.validation_incomplete, /必答/)
    assert.match(COPY.validation_incomplete, /都不合适/)
    assert.match(COPY.question_hint, /都不合适/)
    assert.equal(COPY.version, COPY_VERSION)
  })
})
