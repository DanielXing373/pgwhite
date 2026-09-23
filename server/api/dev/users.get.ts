// GET /api/dev/users — list users (dev/R&D proof only; not auth)
import { getDbPool } from '../../utils/db'
import { assertDevDataTools } from '../../utils/devTools'
import type { UserRow } from '../../utils/libraryEntries'

export default defineEventHandler(async () => {
  assertDevDataTools()
  try {
    const pool = getDbPool()
    const [rows] = await pool.query(
      `SELECT id, display_name, created_at, seed_key
       FROM users
       ORDER BY id`
    )
    return {
      users: rows as UserRow[],
      note: 'Development/R&D identities only. Not authentication. Not Favorite.'
    }
  } catch (err) {
    console.error('[api/dev/users]', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to list users.' })
  }
})
