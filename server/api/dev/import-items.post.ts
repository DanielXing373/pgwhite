// POST /api/dev/import-items — add Import Item with raw JSON (dev proof)
// Body: { importId, rawPayload, externalId?, status?, libraryEntryId?, errorMessage? }
import { getDbPool } from '../../utils/db'
import { assertDevDataTools } from '../../utils/devTools'
import { isImportItemStatus, type ImportItemStatus } from '../../utils/importStatuses'

export default defineEventHandler(async event => {
  assertDevDataTools()
  const body = await readBody(event).catch(() => ({}))
  const importId = Number(body?.importId)
  const rawPayload = body?.rawPayload
  const externalId =
    body?.externalId == null || body?.externalId === ''
      ? null
      : String(body.externalId).slice(0, 255)
  const status = (body?.status as ImportItemStatus) || 'pending'
  const libraryEntryId =
    body?.libraryEntryId == null || body?.libraryEntryId === ''
      ? null
      : Number(body.libraryEntryId)
  const errorMessage =
    body?.errorMessage == null || body?.errorMessage === ''
      ? null
      : String(body.errorMessage)

  if (!Number.isInteger(importId) || importId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'importId must be a positive integer' })
  }
  if (rawPayload == null || typeof rawPayload !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'rawPayload object required' })
  }
  if (!isImportItemStatus(status)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid import item status' })
  }
  if (libraryEntryId != null && (!Number.isInteger(libraryEntryId) || libraryEntryId <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'libraryEntryId invalid' })
  }

  const pool = getDbPool()
  try {
    const [imports] = await pool.query('SELECT id FROM imports WHERE id = ?', [importId])
    if (!(imports as { id: number }[]).length) {
      throw createError({ statusCode: 404, statusMessage: 'Import not found' })
    }
    if (libraryEntryId != null) {
      const [le] = await pool.query('SELECT id FROM library_entries WHERE id = ?', [libraryEntryId])
      if (!(le as { id: number }[]).length) {
        throw createError({ statusCode: 404, statusMessage: 'Library entry not found' })
      }
    }

    const processedAt = status === 'pending' ? null : new Date()
    const [result] = await pool.query(
      `INSERT INTO import_items
         (import_id, external_id, raw_payload, status, library_entry_id, error_message, processed_at)
       VALUES (?, ?, CAST(? AS JSON), ?, ?, ?, ?)`,
      [
        importId,
        externalId,
        JSON.stringify(rawPayload),
        status,
        libraryEntryId,
        errorMessage,
        processedAt
      ]
    )
    const id = Number((result as { insertId?: number }).insertId || 0)
    return {
      ok: true,
      item: {
        id,
        import_id: importId,
        external_id: externalId,
        status,
        library_entry_id: libraryEntryId
      },
      note: 'Import Item stored with raw_payload. May have null library_entry_id. Not Favorite.'
    }
  } catch (err) {
    const e = err as { code?: string; statusCode?: number }
    if (e?.statusCode) throw err
    if (e?.code === 'ER_DUP_ENTRY') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Duplicate external_id within this Import'
      })
    }
    console.error('[api/dev/import-items POST]', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to create import item.' })
  }
})
