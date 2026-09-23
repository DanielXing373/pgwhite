// GET /api/dev/imports?userId= — list imports for a user (dev proof)
import { getDbPool } from '../../utils/db'
import { assertDevDataTools } from '../../utils/devTools'

export default defineEventHandler(async event => {
  assertDevDataTools()
  const userId = Number(getQuery(event).userId)
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'userId required' })
  }

  try {
    const pool = getDbPool()
    const [rows] = await pool.query(
      `SELECT id, user_id, source, status, started_at, completed_at, created_at,
              total_items, processed_items, successful_items, failed_items
       FROM imports
       WHERE user_id = ?
       ORDER BY id`,
      [userId]
    )
    return { userId, imports: rows }
  } catch (err) {
    console.error('[api/dev/imports GET]', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to list imports.' })
  }
})
