import {
  COPY_VERSION,
  DATASET_VERSION,
  PROTOCOL_VERSION,
  QUESTIONS_PER_PARTICIPANT,
  RANDOMIZATION_VERSION,
  type Choice,
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
import type { PublicSession, ResponseRecord, SessionRecord } from './types'

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

function parseChoice(value: unknown): Choice | null {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' || value === 'E'
    ? value
    : null
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

async function mysqlOrNull(): Promise<ResolvedStore | null> {
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
  const answers: Partial<Record<number, Choice>> = {}
  for (const r of responses) answers[r.position] = r.choice
  const body = toPublicSession(session, getMaster().master.quotesById, answers)
  assertNoSourceLeak(body, 'public-session')
  return body
}

export async function loadAuthenticated(publicId: string, token: string) {
  const primary = await resolveStore()
  const candidates = primary.kind === 'memory' ? [primary] : [primary, memoryStore()]
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

const ANSWER_KEYS = ['position', 'choice'] as const

function normalizeAnswers(session: SessionRecord, raw: unknown): ResponseRecord[] {
  if (!Array.isArray(raw)) throw new BadRequestError('answers required')
  const byPos = new Map<number, ResponseRecord>()
  const assigned = new Map(session.assignment.items.map(i => [i.position, i]))
  for (const row of raw) {
    const fields = assertBodyKeys(row, ANSWER_KEYS)
    const position = Number(fields.position)
    const choice = parseChoice(fields.choice)
    if (!Number.isInteger(position) || position < 1 || position > 10 || !choice) {
      throw new BadRequestError('invalid answer')
    }
    const item = assigned.get(position)
    if (!item) throw new BadRequestError('unknown position')
    byPos.set(position, {
      position,
      quote_id: item.quote_id,
      choice,
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

/**
 * Review flags only. They never delete or exclude data; analysts decide later,
 * using the rules in QUALITY-REVIEW.md.
 */
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
  const choices = responses.map(r => r.choice)
  if (choices.length === QUESTIONS_PER_PARTICIPANT) {
    if (choices.every(c => c === 'E')) flags.push('all_none')
    else if (new Set(choices).size === 1) flags.push('uniform_letter')
  }
  const created = Date.parse(session.created_at)
  if (Number.isFinite(created)) {
    const near = createdAtMs.filter(t => Math.abs(t - created) <= QUALITY_BURST_WINDOW_SECONDS * 1000).length
    if (near >= QUALITY_BURST_MIN_SESSIONS) flags.push('creation_burst')
  }
  return flags
}

export async function exportRows(mode?: StudyMode) {
  const { store } = await resolveStore()
  const completed = await Promise.resolve(store.listCompleted(mode))
  const createdAtMs = completed.map(s => Date.parse(s.created_at)).filter(Number.isFinite)
  const rows = []
  for (const session of completed) {
    const responses = await Promise.resolve(store.getResponses(session))
    const flags = qualityFlags(session, responses, createdAtMs).join(';')
    const byPos = new Map(responses.map(r => [r.position, r]))
    for (const item of session.assignment.items) {
      const resp = byPos.get(item.position)
      const choice = resp?.choice ?? null
      const mapped =
        choice == null
          ? null
          : choice === 'E'
            ? 'none'
            : choice === 'A'
              ? item.option_a_source
              : choice === 'B'
                ? item.option_b_source
                : choice === 'C'
                  ? item.option_c_source
                  : item.option_d_source
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
        quote_id: item.quote_id,
        option_a_source: item.option_a_source,
        option_b_source: item.option_b_source,
        option_c_source: item.option_c_source,
        option_d_source: item.option_d_source,
        choice,
        mapped_source: mapped,
        answered_at: resp?.answered_at ?? null
      })
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
  'quote_id',
  'option_a_source',
  'option_b_source',
  'option_c_source',
  'option_d_source',
  'choice',
  'mapped_source',
  'answered_at'
] as const

export function toCsv(rows: Awaited<ReturnType<typeof exportRows>>): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map(r => EXPORT_COLUMNS.map(k => esc((r as Record<string, unknown>)[k])).join(','))
  return [EXPORT_COLUMNS.join(','), ...lines].join('\n') + '\n'
}
