// POST /api/weread/import — runtime WeRead import for Daniel (R&D MVP)
// Body: { apiKey, bookIds: string[] }
// API key is request-scoped only — never written to DB.
import { getDbPool } from '../../utils/db'
import { wereadGatewayPost } from '../../utils/weread/client'
import { parseBookmarkListResponse } from '../../utils/weread/parseItems'
import {
  fetchAllReviewsForBook,
  persistWereadImport,
  type PersistBookInput
} from '../../utils/weread/persistImport'

export default defineEventHandler(async event => {
  const body = await readBody(event).catch(() => ({}))
  const apiKey = String(body?.apiKey || '').trim()
  const bookIdsRaw: unknown[] = Array.isArray(body?.bookIds) ? (body.bookIds as unknown[]) : []
  const bookIds = Array.from(
    new Set(
      bookIdsRaw.map(x => String(x).trim()).filter(id => id.length > 0)
    )
  ) as string[]

  if (!bookIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'bookIds required' })
  }
  if (bookIds.length > 20) {
    throw createError({ statusCode: 400, statusMessage: 'Select at most 20 books per import' })
  }

  const prepared: PersistBookInput[] = []

  for (const bookId of bookIds) {
    const bookmarkRaw = await wereadGatewayPost<Record<string, unknown>>(apiKey, {
      api_name: '/book/bookmarklist',
      bookId
    })
    const bookmarkList = parseBookmarkListResponse(bookmarkRaw)
    const title =
      String(bookmarkList.book.title ?? '').trim() || `book-${bookId}`
    const author =
      String(bookmarkList.book.author ?? '').trim() || '未知作者'
    const reviews = await fetchAllReviewsForBook(apiKey, bookId)

    prepared.push({
      wereadBookId: bookId,
      title,
      author,
      bookmarkList,
      reviews
    })
  }

  const pool = getDbPool()
  try {
    const result = await persistWereadImport(pool, prepared)
    return {
      ok: true,
      ...result,
      note: 'Import complete. Quotes are in the global Result corpus and Daniel Library. Not Favorite.'
    }
  } catch (err: unknown) {
    // Never include apiKey in logs
    console.error('[api/weread/import]', err instanceof Error ? err.message : 'import failed')
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({ statusCode: 500, statusMessage: 'WeRead import failed' })
  }
})
