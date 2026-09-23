// POST /api/dev/imports/:id/finalize — set counters + terminal import status from items (dev proof)
import { getDbPool } from '../../../../utils/db'
import { assertDevDataTools } from '../../../../utils/devTools'
import {
  deriveImportStatusFromItems,
  summarizeItemCounts,
  type ImportItemStatus
} from '../../../../utils/importStatuses'

export default defineEventHandler(async event => {
  assertDevDataTools()
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid import id' })
  }

  const pool = getDbPool()
  try {
    const [imports] = await pool.query('SELECT id FROM imports WHERE id = ?', [id])
    if (!(imports as { id: number }[]).length) {
      throw createError({ statusCode: 404, statusMessage: 'Import not found' })
    }

    const [itemRows] = await pool.query(
      `SELECT status FROM import_items WHERE import_id = ?`,
      [id]
    )
    const statuses = (itemRows as { status: ImportItemStatus }[]).map(r => r.status)
    const derived = deriveImportStatusFromItems(statuses)
    const counts = summarizeItemCounts(statuses)

    await pool.query(
      `UPDATE imports
       SET status = ?,
           completed_at = CURRENT_TIMESTAMP,
           started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
           total_items = ?,
           processed_items = ?,
           successful_items = ?,
           failed_items = ?
       WHERE id = ?`,
      [
        derived,
        counts.total_items,
        counts.processed_items,
        counts.successful_items,
        counts.failed_items,
        id
      ]
    )

    return {
      ok: true,
      importId: id,
      status: derived,
      counts,
      note: 'Terminal status derived from items. completed_with_issues ≠ total failure.'
    }
  } catch (err) {
    const e = err as { statusCode?: number }
    if (e?.statusCode) throw err
    console.error('[api/dev/imports finalize]', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to finalize import.' })
  }
})
