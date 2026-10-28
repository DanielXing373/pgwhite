import { createHash } from 'node:crypto'
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import {
  COPY_VERSION,
  DATASET_VERSION,
  PROTOCOL_VERSION,
  RANDOMIZATION_VERSION,
  type Choice,
  type StudyMode
} from './constants'
import { emptyCounters } from './assign'
import type {
  AssignmentItem,
  AssignmentJson,
  ExposureCounters,
  ResponseRecord,
  SessionRecord
} from './types'

function hashToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function asSession(row: RowDataPacket): SessionRecord {
  const assignment =
    typeof row.assignment_json === 'string'
      ? JSON.parse(row.assignment_json)
      : row.assignment_json
  return {
    id: Number(row.id),
    session_public_id: String(row.session_public_id),
    session_token_hash: String(row.session_token_hash),
    study_mode: row.study_mode,
    experimental_group: row.experimental_group,
    protocol_version: row.protocol_version,
    dataset_version: row.dataset_version,
    randomization_version: row.randomization_version,
    copy_version: row.copy_version,
    assignment,
    consented: Boolean(row.consented),
    consented_at: row.consented_at ? new Date(row.consented_at).toISOString() : null,
    completion_status: row.completion_status,
    created_at: new Date(row.created_at).toISOString(),
    last_seen_at: new Date(row.last_seen_at).toISOString(),
    submitted_at: row.submitted_at ? new Date(row.submitted_at).toISOString() : null
  }
}

export function createMysqlStore(pool: Pool, quoteIds: string[]) {
  async function expireStale(conn: PoolConnection, mode: StudyMode) {
    await conn.query(
      `UPDATE el2_hs_session
       SET completion_status = 'abandoned'
       WHERE study_mode = ?
         AND completion_status = 'in_progress'
         AND last_seen_at < (UTC_TIMESTAMP() - INTERVAL 24 HOUR)`,
      [mode]
    )
  }

  async function counters(conn: PoolConnection, mode: StudyMode): Promise<ExposureCounters> {
    await expireStale(conn, mode)
    const c = emptyCounters(quoteIds)
    const [groupRows] = await conn.query<RowDataPacket[]>(
      `SELECT experimental_group,
              SUM(completion_status = 'completed') AS completed,
              SUM(completion_status = 'in_progress') AS inflight
       FROM el2_hs_session
       WHERE study_mode = ?
       GROUP BY experimental_group`,
      [mode]
    )
    for (const row of groupRows) {
      const g = row.experimental_group as 'control' | 'disclosure'
      c.group[g].completed = Number(row.completed)
      c.group[g].inflight = Number(row.inflight)
    }
    const [quoteRows] = await conn.query<RowDataPacket[]>(
      `SELECT a.quote_id, s.experimental_group, a.section,
              SUM(s.completion_status IN ('completed','in_progress')) AS n
       FROM el2_hs_assignment_item a
       JOIN el2_hs_session s ON s.id = a.session_id
       WHERE s.study_mode = ?
         AND s.completion_status IN ('completed','in_progress')
       GROUP BY a.quote_id, s.experimental_group, a.section`,
      [mode]
    )
    for (const row of quoteRows) {
      const q = c.quote[String(row.quote_id)]
      if (!q) continue
      const n = Number(row.n)
      q.total += n
      q.byGroup[row.experimental_group as 'control' | 'disclosure'] += n
      q.bySection[Number(row.section) as 1 | 2] += n
    }
    return c
  }

  return {
    async createSession(input: {
      publicId: string
      token: string
      studyMode: StudyMode
      assignment?: AssignmentJson
      build?: (counters: ExposureCounters) => AssignmentJson
    }): Promise<SessionRecord> {
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        await conn.query('SELECT lock_note FROM el2_hs_assign_lock WHERE study_mode = ? FOR UPDATE', [
          input.studyMode
        ])
        const assignment = input.build
          ? input.build(await counters(conn, input.studyMode))
          : input.assignment
        if (!assignment) throw new Error('assignment required')
        const [result] = await conn.query<any>(
          `INSERT INTO el2_hs_session (
             session_public_id, session_token_hash, study_mode, experimental_group,
             protocol_version, dataset_version, randomization_version, copy_version,
             assignment_json, consented, consented_at, completion_status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), 1, UTC_TIMESTAMP(), 'in_progress')`,
          [
            input.publicId,
            hashToken(input.token),
            input.studyMode,
            assignment.group,
            PROTOCOL_VERSION,
            DATASET_VERSION,
            RANDOMIZATION_VERSION,
            COPY_VERSION,
            JSON.stringify(assignment)
          ]
        )
        const sessionId = Number(result.insertId)
        for (const item of assignment.items) {
          await conn.query(
            `INSERT INTO el2_hs_assignment_item (
               session_id, position, section, quote_id,
               option_a_source, option_b_source, option_c_source, option_d_source
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sessionId,
              item.position,
              item.section,
              item.quote_id,
              item.option_a_source,
              item.option_b_source,
              item.option_c_source,
              item.option_d_source
            ]
          )
        }
        await conn.commit()
        const [rows] = await pool.query<RowDataPacket[]>(
          'SELECT * FROM el2_hs_session WHERE id = ?',
          [sessionId]
        )
        const inserted = rows[0]
        if (!inserted) throw new Error('missing session after insert')
        return asSession(inserted)
      } catch (err) {
        await conn.rollback()
        throw err
      } finally {
        conn.release()
      }
    },
    async authenticate(publicId: string, token: string): Promise<SessionRecord | null> {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM el2_hs_session WHERE session_public_id = ?',
        [publicId]
      )
      const row = rows[0]
      if (!row) return null
      if (String(row.session_token_hash) !== hashToken(token)) return null
      await pool.query(
        'UPDATE el2_hs_session SET last_seen_at = UTC_TIMESTAMP() WHERE id = ? AND completion_status = ?',
        [row.id, 'in_progress']
      )
      return asSession(row)
    },
    async loadCounters(mode: StudyMode): Promise<ExposureCounters> {
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        await conn.query('SELECT lock_note FROM el2_hs_assign_lock WHERE study_mode = ? FOR UPDATE', [
          mode
        ])
        const c = await counters(conn, mode)
        await conn.commit()
        return c
      } catch (err) {
        await conn.rollback()
        throw err
      } finally {
        conn.release()
      }
    },
    async saveDraft(session: SessionRecord, items: ResponseRecord[]) {
      if (session.completion_status === 'completed') {
        throw Object.assign(new Error('immutable'), { code: 'immutable' })
      }
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        const [fresh] = await conn.query<RowDataPacket[]>(
          'SELECT completion_status FROM el2_hs_session WHERE id = ? FOR UPDATE',
          [session.id]
        )
        if (fresh[0]?.completion_status === 'completed') {
          throw Object.assign(new Error('immutable'), { code: 'immutable' })
        }
        for (const item of items) {
          await conn.query(
            `INSERT INTO el2_hs_response (session_id, position, quote_id, choice, answered_at)
             VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE choice = VALUES(choice), quote_id = VALUES(quote_id), answered_at = UTC_TIMESTAMP()`,
            [session.id, item.position, item.quote_id, item.choice]
          )
        }
        await conn.query(
          'UPDATE el2_hs_session SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?',
          [session.id]
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      } finally {
        conn.release()
      }
    },
    async getResponses(session: SessionRecord): Promise<ResponseRecord[]> {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT position, quote_id, choice, answered_at FROM el2_hs_response WHERE session_id = ?',
        [session.id]
      )
      return rows.map(r => ({
        position: Number(r.position),
        quote_id: String(r.quote_id),
        choice: r.choice as Choice,
        answered_at: new Date(r.answered_at).toISOString()
      }))
    },
    async submit(session: SessionRecord, items: ResponseRecord[]) {
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        const [fresh] = await conn.query<RowDataPacket[]>(
          'SELECT * FROM el2_hs_session WHERE id = ? FOR UPDATE',
          [session.id]
        )
        if (!fresh[0]) throw new Error('missing session')
        if (fresh[0].completion_status === 'completed') {
          await conn.rollback()
          return { already: true as const }
        }
        try {
          await conn.query('INSERT INTO el2_hs_submit_lock (session_id) VALUES (?)', [session.id])
        } catch {
          await conn.rollback()
          return { already: true as const }
        }
        for (const item of items) {
          await conn.query(
            `INSERT INTO el2_hs_response (session_id, position, quote_id, choice, answered_at)
             VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE choice = VALUES(choice), quote_id = VALUES(quote_id), answered_at = UTC_TIMESTAMP()`,
            [session.id, item.position, item.quote_id, item.choice]
          )
        }
        await conn.query(
          `UPDATE el2_hs_session
           SET completion_status = 'completed', submitted_at = UTC_TIMESTAMP(), last_seen_at = UTC_TIMESTAMP()
           WHERE id = ?`,
          [session.id]
        )
        await conn.commit()
        return { already: false as const }
      } catch (err) {
        await conn.rollback()
        throw err
      } finally {
        conn.release()
      }
    },
    async listCompleted(mode?: StudyMode): Promise<SessionRecord[]> {
      const sql = mode
        ? 'SELECT * FROM el2_hs_session WHERE completion_status = ? AND study_mode = ?'
        : 'SELECT * FROM el2_hs_session WHERE completion_status = ?'
      const params = mode ? ['completed', mode] : ['completed']
      const [rows] = await pool.query<RowDataPacket[]>(sql, params)
      return rows.map(asSession)
    },
    async listAssignmentItems(sessionId: number): Promise<AssignmentItem[]> {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT position, section, quote_id, option_a_source, option_b_source, option_c_source, option_d_source
         FROM el2_hs_assignment_item WHERE session_id = ? ORDER BY position`,
        [sessionId]
      )
      return rows.map(r => ({
        position: Number(r.position),
        section: Number(r.section) as 1 | 2,
        quote_id: String(r.quote_id),
        option_a_source: r.option_a_source,
        option_b_source: r.option_b_source,
        option_c_source: r.option_c_source,
        option_d_source: r.option_d_source
      }))
    }
  }
}
