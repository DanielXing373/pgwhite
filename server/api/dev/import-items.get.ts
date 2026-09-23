// GET /api/dev/import-items?importId= — list items + raw payloads (dev proof)
import { getDbPool } from '../../utils/db'
import { assertDevDataTools } from '../../utils/devTools'

export default defineEventHandler(async event => {
  assertDevDataTools()
  const importId = Number(getQuery(event).importId)
  if (!Number.isInteger(importId) || importId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'importId required' })
  }

  try {
    const pool = getDbPool()
    const [rows] = await pool.query(
      `SELECT id, import_id, external_id, raw_payload, status, library_entry_id,
              error_message, created_at, processed_at
       FROM import_items
       WHERE import_id = ?
       ORDER BY id`,
      [importId]
    )
    return {
      importId,
      items: rows,
      note: 'Failed/pending items keep raw_payload for inspect/retry (retry not implemented).'
    }
  } catch (err) {
    console.error('[api/dev/import-items GET]', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to list import items.' })
  }
})
