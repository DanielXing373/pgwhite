// GET /api/dev/library-entries?userId= — list library memberships for a user (dev proof)
import { getDbPool } from '../../utils/db'
import { assertDevDataTools } from '../../utils/devTools'
import type { LibraryEntryRow } from '../../utils/libraryEntries'

export default defineEventHandler(async event => {
  assertDevDataTools()
  const query = getQuery(event)
  const userId = Number(query.userId)
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'userId required (positive integer)' })
  }

  try {
    const pool = getDbPool()
    const [rows] = await pool.query(
      `SELECT id, user_id, quote_id, created_at
       FROM library_entries
       WHERE user_id = ?
       ORDER BY id`,
      [userId]
    )
    return {
      userId,
      entries: rows as LibraryEntryRow[],
      note: 'Personal library membership (Import corpus relationship). Not Favorite/收藏.'
    }
  } catch (err) {
    console.error('[api/dev/library-entries GET]', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to list library entries.' })
  }
})
