// POST /api/dev/imports — create Import for a user (dev proof; not auth / not Favorite)
import { getDbPool } from '../../utils/db'
import { assertDevDataTools } from '../../utils/devTools'
import { isImportStatus, type ImportStatus } from '../../utils/importStatuses'

export default defineEventHandler(async event => {
  assertDevDataTools()
  const body = await readBody(event).catch(() => ({}))
  const userId = Number(body?.userId)
  const source = String(body?.source || '').trim()
  const status = (body?.status as ImportStatus) || 'pending'

  if (!Number.isInteger(userId) || userId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'userId must be a positive integer' })
  }
  if (!source || source.length > 64) {
    throw createError({ statusCode: 400, statusMessage: 'source required (e.g. weread, manual)' })
  }
  if (!isImportStatus(status)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid import status' })
  }

  const pool = getDbPool()
  try {
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [userId])
    if (!(users as { id: number }[]).length) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    const startedAt = status === 'pending' ? null : new Date()
    const [result] = await pool.query(
      `INSERT INTO imports (user_id, source, status, started_at)
       VALUES (?, ?, ?, ?)`,
      [userId, source, status, startedAt]
    )
    const id = Number((result as { insertId?: number }).insertId || 0)
    return {
      ok: true,
      import: { id, user_id: userId, source, status },
      note: 'Import event created. Not Favorite. WeRead-first source string is free-form.'
    }
  } catch (err) {
    console.error('[api/dev/imports POST]', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to create import.' })
  }
})
