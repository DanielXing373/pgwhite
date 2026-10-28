import { createHash } from 'node:crypto'
import { INFLIGHT_TTL_MS, type Choice, type StudyMode } from './constants'
import { emptyCounters } from './assign'
import type {
  AssignmentJson,
  ExposureCounters,
  ResponseRecord,
  SessionRecord
} from './types'

function nowIso() {
  return new Date().toISOString()
}

function hashToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function createMemoryStore(quoteIds: string[]) {
  let seq = 1
  const sessions = new Map<string, SessionRecord>()
  const tokens = new Map<string, string>()
  const responses = new Map<number, Map<number, ResponseRecord>>()
  const locks = new Set<number>()

  function expireStale(mode: StudyMode, at = Date.now()) {
    for (const session of sessions.values()) {
      if (session.study_mode !== mode) continue
      if (session.completion_status !== 'in_progress') continue
      const seen = Date.parse(session.last_seen_at)
      if (Number.isFinite(seen) && at - seen > INFLIGHT_TTL_MS) {
        session.completion_status = 'abandoned'
      }
    }
  }

  function counters(mode: StudyMode): ExposureCounters {
    expireStale(mode)
    const c = emptyCounters(quoteIds)
    for (const session of sessions.values()) {
      if (session.study_mode !== mode) continue
      const kind =
        session.completion_status === 'completed'
          ? 'completed'
          : session.completion_status === 'in_progress'
            ? 'inflight'
            : null
      if (!kind) continue
      c.group[session.experimental_group][kind] += 1
      for (const item of session.assignment.items) {
        const q = c.quote[item.quote_id]
        if (!q) continue
        q.total += 1
        q.byGroup[session.experimental_group] += 1
        q.bySection[item.section] += 1
      }
    }
    return c
  }

  return {
    expireStale,
    counters,
    createWithAssignment(input: {
      publicId: string
      token: string
      studyMode: StudyMode
      protocolVersion: string
      datasetVersion: string
      randomizationVersion: string
      copyVersion: string
      build: (counters: ExposureCounters) => AssignmentJson
    }): SessionRecord {
      expireStale(input.studyMode)
      const assignment = input.build(counters(input.studyMode))
      return this.createSession({ ...input, assignment })
    },
    createSession(input: {
      publicId: string
      token: string
      studyMode: StudyMode
      assignment: AssignmentJson
      protocolVersion: string
      datasetVersion: string
      randomizationVersion: string
      copyVersion: string
    }): SessionRecord {
      const created = nowIso()
      const row: SessionRecord = {
        id: seq++,
        session_public_id: input.publicId,
        session_token_hash: hashToken(input.token),
        study_mode: input.studyMode,
        experimental_group: input.assignment.group,
        protocol_version: input.protocolVersion,
        dataset_version: input.datasetVersion,
        randomization_version: input.randomizationVersion,
        copy_version: input.copyVersion,
        assignment: input.assignment,
        consented: true,
        consented_at: created,
        completion_status: 'in_progress',
        created_at: created,
        last_seen_at: created,
        submitted_at: null
      }
      sessions.set(input.publicId, row)
      tokens.set(input.publicId, input.token)
      responses.set(row.id, new Map())
      return row
    },
    getByPublicId(publicId: string): SessionRecord | null {
      return sessions.get(publicId) ?? null
    },
    authenticate(publicId: string, token: string): SessionRecord | null {
      const row = sessions.get(publicId)
      if (!row) return null
      if (row.session_token_hash !== hashToken(token)) return null
      row.last_seen_at = nowIso()
      return row
    },
    saveDraft(session: SessionRecord, items: ResponseRecord[]) {
      if (session.completion_status === 'completed') {
        throw Object.assign(new Error('immutable'), { code: 'immutable' })
      }
      const map = responses.get(session.id)!
      for (const item of items) {
        map.set(item.position, item)
      }
      session.last_seen_at = nowIso()
    },
    getResponses(session: SessionRecord): ResponseRecord[] {
      return [...(responses.get(session.id)?.values() ?? [])]
    },
    submit(session: SessionRecord, items: ResponseRecord[]) {
      if (session.completion_status === 'completed' || locks.has(session.id)) {
        return { already: true as const }
      }
      const map = responses.get(session.id)!
      for (const item of items) map.set(item.position, item)
      locks.add(session.id)
      session.completion_status = 'completed'
      session.submitted_at = nowIso()
      session.last_seen_at = session.submitted_at
      return { already: false as const }
    },
    listCompleted(mode?: StudyMode): SessionRecord[] {
      return [...sessions.values()].filter(
        s => s.completion_status === 'completed' && (mode ? s.study_mode === mode : true)
      )
    }
  }
}

export type MemoryStore = ReturnType<typeof createMemoryStore>
