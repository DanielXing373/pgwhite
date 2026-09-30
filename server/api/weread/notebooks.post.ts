// POST /api/weread/notebooks — discover notebooks with ephemeral API key
import { wereadGatewayPost } from '../../utils/weread/client'
import { parseNotebooksResponse } from '../../utils/weread/notebooks'

export default defineEventHandler(async event => {
  const body = await readBody(event).catch(() => ({}))
  const apiKey = String(body?.apiKey || '').trim()

  // Fetch first page large enough for MVP picker; follow hasMore if needed
  const books: ReturnType<typeof parseNotebooksResponse>['books'] = []
  let lastSort: number | undefined
  let totalBookCount = 0
  let totalNoteCount = 0
  let guard = 0

  while (guard++ < 20) {
    const payload: Record<string, unknown> = {
      api_name: '/user/notebooks',
      count: 100
    }
    if (lastSort != null) payload.lastSort = lastSort

    const data = await wereadGatewayPost<Record<string, unknown>>(apiKey, payload)
    const parsed = parseNotebooksResponse(data)
    totalBookCount = parsed.totalBookCount
    totalNoteCount = parsed.totalNoteCount
    books.push(...parsed.books)
    if (!parsed.hasMore || !parsed.books.length) break
    // sort is on notebook entry — re-read from raw
    const rawBooks = Array.isArray(data.books) ? data.books : []
    const last = rawBooks[rawBooks.length - 1] as { sort?: number } | undefined
    if (last?.sort == null) break
    lastSort = Number(last.sort)
  }

  // Deduplicate by bookId (pagination edge)
  const seen = new Set<string>()
  const unique = books.filter(b => {
    if (seen.has(b.bookId)) return false
    seen.add(b.bookId)
    return true
  })

  return {
    totalBookCount,
    totalNoteCount,
    books: unique
  }
})
