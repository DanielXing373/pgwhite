// POST /api/dev/library-entries — add Quote to a User's personal library (dev proof)
// Body: { userId, quoteId }
// Duplicate (user, quote) → 409. Not Favorite.
import { getDbPool } from '../../utils/db'
import { assertDevDataTools } from '../../utils/devTools'
import {
  isDuplicateLibraryMembershipError,
  validateLibraryMembershipIds
} from '../../utils/libraryEntries'

export default defineEventHandler(async event => {
  assertDevDataTools()
  const body = await readBody(event).catch(() => ({}))
  const parsed = validateLibraryMembershipIds(body?.userId, body?.quoteId)
  if (!parsed.ok) {
    throw createError({
      statusCode: 400,
      statusMessage:
        parsed.reason === 'invalid_user'
          ? 'userId must be a positive integer'
          : 'quoteId must be a positive integer'
    })
  }

  const pool = getDbPool()

  try {
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [parsed.userId])
    if (!(userRows as { id: number }[]).length) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }
    const [quoteRows] = await pool.query('SELECT id FROM quotes WHERE id = ?', [parsed.quoteId])
    if (!(quoteRows as { id: number }[]).length) {
      throw createError({ statusCode: 404, statusMessage: 'Quote not found' })
    }

    const [result] = await pool.query(
      `INSERT INTO library_entries (user_id, quote_id) VALUES (?, ?)`,
      [parsed.userId, parsed.quoteId]
    )
    const insertId = Number((result as { insertId?: number }).insertId || 0)
    return {
      ok: true,
      created: true,
      entry: { id: insertId, user_id: parsed.userId, quote_id: parsed.quoteId },
      note: 'Library Entry created. Not Favorite/收藏. Not Import provenance (deferred).'
    }
  } catch (err) {
    if (isDuplicateLibraryMembershipError(err)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Library membership already exists for this (user, quote)'
      })
    }
    console.error('[api/dev/library-entries POST]', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to create library entry.' })
  }
})
