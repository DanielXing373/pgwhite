import {
  COPY_VERSION,
  DATASET_VERSION,
  PROTOCOL_VERSION,
  QUESTIONS_PER_PARTICIPANT,
  RANDOMIZATION_VERSION,
  SOURCE_IDS,
  type StudyMode
} from './constants'
import { buildAssignment } from './assign'
import { COPY } from './copy'
import { loadInternalMaster, quoteIds } from './dataset'
import { createMemoryStore } from './memoryStore'
import { createMysqlStore } from './mysqlStore'
import { modePolicy } from './policy'
import { assertNoSourceLeak, toPublicSession } from './publicPayload'
import {
  createMemoryRateLimiter,
  createMysqlRateLimiter,
  rateLimitConfig,
  type RateLimiter
} from './rateLimit'
import { randomHex } from './rng'
import type { PublicAnswer, PublicSession, ResponseRecord, SessionRecord } from './types'

type MemoryStore = ReturnType<typeof createMemoryStore>
type MysqlStore = ReturnType<typeof createMysqlStore>
type AnyStore = MemoryStore | MysqlStore
type ResolvedStore = { kind: 'mysql' | 'memory'; store: AnyStore; limiter: RateLimiter }

let cached:
  | {
      master: ReturnType<typeof loadInternalMaster>
      memory: MemoryStore
      memoryLimiter: RateLimiter
    }
  | null = null

export function getMaster() {
  if (!cached) {
    const master = loadInternalMaster()
    cached = {
      master,
      memory: createMemoryStore(quoteIds(master.master)),
      memoryLimiter: createMemoryRateLimiter()
    }
  }
  return cached
}

export function resetMasterCache() {
  cached = null
}

export class BadRequestError extends Error {
  status = 400
}

/** Rejects any key outside the allow-list so stray fields (e.g. contact details) are never stored. */
export function assertBodyKeys(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (body == null) return {}
  if (typeof body !== 'object' || Array.isArray(body)) throw new BadRequestError('body must be an object')
  const extra = Object.keys(body).filter(k => !allowed.includes(k))
  if (extra.length) throw new BadRequestError(`unexpected field: ${extra.join(',')}`)
  return body as Record<string, unknown>
}

export function metaPayload() {
  const { master } = getMaster()
  const body = {
    copy: COPY,
    dataset_version: DATASET_VERSION,
    protocol_version: PROTOCOL_VERSION,
    randomization_version: RANDOMIZATION_VERSION,
    copy_version: COPY_VERSION,
    quote_count: master.master.quotes.length,
    questions_per_participant: QUESTIONS_PER_PARTICIPANT
  }
  assertNoSourceLeak(body, 'meta')
  return body
}

/** AC1_HS_STORE=memory keeps every session in process memory and never opens a database connection. */
function memoryOnly(env: Record<string, string | undefined> = process.env) {
  return env.AC1_HS_STORE === 'memory'
}

async function mysqlOrNull(): Promise<ResolvedStore | null> {
  if (memoryOnly()) return null
  try {
    const { dbSettings, getDbPool } = await import('../db')
    const db = dbSettings()
    if (!db.host || !db.user || !db.database) return null
    const pool = getDbPool()
    return {
      kind: 'mysql',
      store: createMysqlStore(pool, quoteIds(getMaster().master.master)),
      limiter: createMysqlRateLimiter(pool)
    }
  } catch {
    return null
  }
}

function memoryStore(): ResolvedStore {
  const { memory, memoryLimiter } = getMaster()
  return { kind: 'memory', store: memory, limiter: memoryLimiter }
}

export async function resolveStore(): Promise<ResolvedStore> {
  return (await mysqlOrNull()) ?? memoryStore()
}

/** Store a new session of this mode would be written to, or null when the mode is not allowed here. */
export async function storeForMode(mode: StudyMode): Promise<ResolvedStore | null> {
  const decision = modePolicy(mode)
  if (!decision.allowed) return null
  return decision.store === 'memory' ? memoryStore() : resolveStore()
}

function sessionAllowedIn(session: SessionRecord, kind: ResolvedStore['kind']) {
  const decision = modePolicy(session.study_mode)
  if (!decision.allowed) return false
  return decision.store === 'any' || kind === 'memory'
}

export function publicView(session: SessionRecord, responses: ResponseRecord[]) {
  const answers: Partial<Record<number, PublicAnswer>> = {}
  for (const r of responses) answers[r.position] = { selected: r.selected_tag_ids, none: r.none_selected }
  const body = toPublicSession(session, getMaster().master.quotesById, answers)
  assertNoSourceLeak(body, 'public-session')
  return body
}

/**
 * Memory is checked first: a memory session (local or preview test mode) is then served without
 * touching the database at all.
 */
export async function loadAuthenticated(publicId: string, token: string) {
  const memory = memoryStore()
  const primary = await resolveStore()
  const candidates = primary.kind === 'memory' ? [memory] : [memory, primary]
  for (const resolved of candidates) {
    const session = await Promise.resolve(resolved.store.authenticate(publicId, token))
    if (!session) continue
    if (!sessionAllowedIn(session, resolved.kind)) return null
    const responses = await Promise.resolve(resolved.store.getResponses(session))
    return { session, responses, resolved, public: publicView(session, responses) }
  }
  return null
}

export type CreateSessionResult =
  | { error: 'mode_disabled' }
  | { error: 'needs_database' }
  | { error: 'rate_limited'; retryAfterSeconds: number }
  | { error: null; resumed: boolean; session: SessionRecord; token: string | null; public: PublicSession }

/**
 * Resumes the caller's in-progress session of the same mode (refresh, double click)
 * without counting against the rate limit; otherwise rate-limits, then assigns.
 */
export async function createOrResumeSession(input: {
  studyMode: StudyMode
  clientIp: string
  cookie: { publicId: string; token: string } | null
}): Promise<CreateSessionResult> {
  const target = await storeForMode(input.studyMode)
  if (!target) return { error: 'mode_disabled' }
  if (input.studyMode === 'study' && target.kind === 'memory') return { error: 'needs_database' }

  if (input.cookie) {
    const existing = await loadAuthenticated(input.cookie.publicId, input.cookie.token)
    if (
      existing &&
      existing.session.study_mode === input.studyMode &&
      existing.session.completion_status === 'in_progress'
    ) {
      return { error: null, resumed: true, session: existing.session, token: null, public: existing.public }
    }
  }

  const limit = await target.limiter.hit(input.clientIp, rateLimitConfig())
  if (!limit.allowed) return { error: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds }

  const ids = quoteIds(getMaster().master.master)
  const publicId = randomHex(32)
  const token = randomHex(32)
  const build = (counters: Parameters<typeof buildAssignment>[1]) => buildAssignment(ids, counters)
  const session =
    target.kind === 'memory'
      ? (target.store as MemoryStore).createWithAssignment({
          publicId,
          token,
          studyMode: input.studyMode,
          protocolVersion: PROTOCOL_VERSION,
          datasetVersion: DATASET_VERSION,
          randomizationVersion: RANDOMIZATION_VERSION,
          copyVersion: COPY_VERSION,
          build
        })
      : await (target.store as MysqlStore).createSession({
          publicId,
          token,
          studyMode: input.studyMode,
          build
        })
  return { error: null, resumed: false, session, token, public: publicView(session, []) }
}

const ANSWER_KEYS = ['position', 'selected', 'none'] as const

/**
 * An answer is valid in exactly two shapes: at least one ticked tag and none=false, or no ticked
 * tag and none=true. Every ticked tag must belong to that excerpt. A tag that is not ticked is
 * recorded as "不合适" by absence; there is no third state.
 */
export function normalizeAnswers(session: SessionRecord, raw: unknown): ResponseRecord[] {
  if (!Array.isArray(raw)) throw new BadRequestError('answers required')
  const { quotesById } = getMaster().master
  const byPos = new Map<number, ResponseRecord>()
  const assigned = new Map(session.assignment.items.map(i => [i.position, i]))
  for (const row of raw) {
    const fields = assertBodyKeys(row, ANSWER_KEYS)
    const position = Number(fields.position)
    if (!Number.isInteger(position) || position < 1 || position > QUESTIONS_PER_PARTICIPANT) {
      throw new BadRequestError('invalid answer')
    }
    const item = assigned.get(position)
    if (!item) throw new BadRequestError('unknown position')
    if (typeof fields.none !== 'boolean' || !Array.isArray(fields.selected)) {
      throw new BadRequestError('invalid answer')
    }
    const quote = quotesById.get(item.quote_id)
    if (!quote) throw new BadRequestError('unknown quote')
    const allowed = new Set(quote.tags.map(tag => tag.tag_id))
    const selected: string[] = []
    for (const id of fields.selected) {
      if (typeof id !== 'string' || !allowed.has(id) || selected.includes(id)) {
        throw new BadRequestError('invalid tag')
      }
      selected.push(id)
    }
    if (fields.none ? selected.length > 0 : selected.length === 0) {
      throw new BadRequestError('answer must tick a tag or choose none')
    }
    // Stored in the excerpt's display order, not click order.
    const ordered = quote.tags.map(tag => tag.tag_id).filter(id => selected.includes(id))
    byPos.set(position, {
      position,
      quote_id: item.quote_id,
      selected_tag_ids: ordered,
      none_selected: fields.none,
      answered_at: new Date().toISOString()
    })
  }
  return [...byPos.values()]
}

export async function saveDraft(publicId: string, token: string, rawAnswers: unknown) {
  const auth = await loadAuthenticated(publicId, token)
  if (!auth) return { error: 'unauthorized' as const }
  if (auth.session.completion_status === 'completed') return { error: 'immutable' as const, public: auth.public }
  const items = normalizeAnswers(auth.session, rawAnswers)
  try {
    await Promise.resolve(auth.resolved.store.saveDraft(auth.session, items))
  } catch (err) {
    if ((err as { code?: string }).code === 'immutable') {
      return { error: 'immutable' as const, public: auth.public }
    }
    throw err
  }
  const again = await loadAuthenticated(publicId, token)
  return { error: null, public: again?.public ?? auth.public }
}

/** The ten answers are the whole submission; nothing else is accepted or stored. */
export async function submitSession(publicId: string, token: string, rawAnswers: unknown) {
  const auth = await loadAuthenticated(publicId, token)
  if (!auth) return { error: 'unauthorized' as const }
  const items = normalizeAnswers(auth.session, rawAnswers)
  const positions = new Set(items.map(i => i.position))
  if (items.length !== QUESTIONS_PER_PARTICIPANT || positions.size !== QUESTIONS_PER_PARTICIPANT) {
    return { error: 'incomplete' as const, public: auth.public }
  }
  const result = await Promise.resolve(auth.resolved.store.submit(auth.session, items))
  const again = await loadAuthenticated(publicId, token)
  return {
    error: null,
    already: result.already,
    public: again?.public ?? publicView(auth.session, items)
  }
}

/** Seconds from consent to submit below which a session is flagged for manual review. */
export const QUALITY_FAST_SECONDS = 120
/** Completed sessions created within this many seconds of each other count toward a burst. */
export const QUALITY_BURST_WINDOW_SECONDS = 60
export const QUALITY_BURST_MIN_SESSIONS = 10

/** Review flags only. They never delete or exclude data; analysts decide later. */
export function qualityFlags(
  session: SessionRecord,
  responses: ResponseRecord[],
  createdAtMs: number[] = []
): string[] {
  const flags: string[] = []
  const start = Date.parse(session.consented_at ?? session.created_at)
  const end = session.submitted_at ? Date.parse(session.submitted_at) : NaN
  if (Number.isFinite(start) && Number.isFinite(end) && (end - start) / 1000 < QUALITY_FAST_SECONDS) {
    flags.push('fast_completion')
  }
  if (responses.length === QUESTIONS_PER_PARTICIPANT) {
    const { quotesById } = getMaster().master
    if (responses.every(r => r.none_selected)) flags.push('all_none')
    else if (
      responses.every(r => r.selected_tag_ids.length === (quotesById.get(r.quote_id)?.tags.length ?? -1))
    ) {
      flags.push('all_ticked')
    }
  }
  const created = Date.parse(session.created_at)
  if (Number.isFinite(created)) {
    const near = createdAtMs.filter(t => Math.abs(t - created) <= QUALITY_BURST_WINDOW_SECONDS * 1000).length
    if (near >= QUALITY_BURST_MIN_SESSIONS) flags.push('creation_burst')
  }
  return flags
}

/**
 * One row per (session, excerpt, tag): every tag shown to the participant, whether it was ticked,
 * and which arms produced it. This is the only place source ids leave the server, behind the token.
 */
export async function exportRows(mode?: StudyMode) {
  const { store } = await resolveStore()
  const { quotesById } = getMaster().master
  const completed = await Promise.resolve(store.listCompleted(mode))
  const createdAtMs = completed.map(s => Date.parse(s.created_at)).filter(Number.isFinite)
  const rows = []
  for (const session of completed) {
    const responses = await Promise.resolve(store.getResponses(session))
    const flags = qualityFlags(session, responses, createdAtMs).join(';')
    const byPos = new Map(responses.map(r => [r.position, r]))
    for (const item of session.assignment.items) {
      const resp = byPos.get(item.position)
      const quote = quotesById.get(item.quote_id)
      if (!quote) continue
      for (const tag of quote.tags) {
        rows.push({
          session_public_id: session.session_public_id,
          study_mode: session.study_mode,
          experimental_group: session.experimental_group,
          dataset_version: session.dataset_version,
          protocol_version: session.protocol_version,
          randomization_version: session.randomization_version,
          copy_version: session.copy_version,
          completion_status: session.completion_status,
          created_at: session.created_at,
          submitted_at: session.submitted_at,
          quality_flags: flags,
          position: item.position,
          section: item.section,
          disclosure_shown: session.experimental_group === 'disclosure' && item.section === 2 ? 1 : 0,
          quote_id: item.quote_id,
          none_selected: resp ? (resp.none_selected ? 1 : 0) : null,
          tag_id: tag.tag_id,
          dimension: tag.dimension,
          tag_label_zh: tag.label_zh,
          ticked: resp ? (resp.selected_tag_ids.includes(tag.tag_id) ? 1 : 0) : null,
          from_deepseek_flash: tag.sources.includes(SOURCE_IDS[0]) ? 1 : 0,
          from_gpt_6_luna_low: tag.sources.includes(SOURCE_IDS[1]) ? 1 : 0,
          from_gpt_6_luna_medium: tag.sources.includes(SOURCE_IDS[2]) ? 1 : 0,
          answered_at: resp?.answered_at ?? null
        })
      }
    }
  }
  return rows
}

export const EXPORT_COLUMNS = [
  'session_public_id',
  'study_mode',
  'experimental_group',
  'dataset_version',
  'protocol_version',
  'randomization_version',
  'copy_version',
  'completion_status',
  'created_at',
  'submitted_at',
  'quality_flags',
  'position',
  'section',
  'disclosure_shown',
  'quote_id',
  'none_selected',
  'tag_id',
  'dimension',
  'tag_label_zh',
  'ticked',
  'from_deepseek_flash',
  'from_gpt_6_luna_low',
  'from_gpt_6_luna_medium',
  'answered_at'
] as const

export function toCsv(rows: Awaited<ReturnType<typeof exportRows>>): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map(r => EXPORT_COLUMNS.map(k => esc((r as Record<string, unknown>)[k])).join(','))
  return [EXPORT_COLUMNS.join(','), ...lines].join('\n') + '\n'
}
