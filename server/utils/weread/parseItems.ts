// =====================================================
// Parse /book/bookmarklist + /review/list/mine
// =====================================================

export type WereadBookmarkItem = {
  bookmarkId: string
  bookId: string
  chapterUid: number | null
  chapterIdx: number | null
  range: string | null
  markText: string
  colorStyle: number | null
  type: number | null
  createTime: number | null
  raw: Record<string, unknown>
}

export type WereadChapterInfo = {
  chapterUid: number
  chapterIdx: number | null
  title: string | null
}

export type WereadBookmarkList = {
  book: Record<string, unknown>
  chapters: WereadChapterInfo[]
  bookmarks: WereadBookmarkItem[]
  synckey: unknown
  removed: unknown
  raw: Record<string, unknown>
}

export type WereadReviewItem = {
  reviewId: string
  bookId: string
  content: string
  abstract: string | null
  range: string | null
  chapterUid: number | null
  chapterIdx: number | null
  chapterName: string | null
  createTime: number | null
  isPrivate: boolean | null
  type: number | null
  raw: Record<string, unknown>
}

export function associationKey(
  bookId: string,
  chapterUid: number | null | undefined,
  range: string | null | undefined
): string | null {
  const r = range != null ? String(range).trim() : ''
  if (!bookId || !r) return null
  const ch = chapterUid == null || Number.isNaN(Number(chapterUid)) ? '' : String(Number(chapterUid))
  return `${bookId}|${ch}|${r}`
}

export function parseBookmarkListResponse(data: Record<string, unknown>): WereadBookmarkList {
  const book = (data.book && typeof data.book === 'object'
    ? data.book
    : {}) as Record<string, unknown>
  const chaptersRaw = Array.isArray(data.chapters) ? data.chapters : []
  const chapters: WereadChapterInfo[] = chaptersRaw
    .filter(c => c && typeof c === 'object')
    .map(c => {
      const row = c as Record<string, unknown>
      return {
        chapterUid: Number(row.chapterUid),
        chapterIdx: row.chapterIdx == null ? null : Number(row.chapterIdx),
        title: row.title != null ? String(row.title) : null
      }
    })
    .filter(c => Number.isFinite(c.chapterUid))

  const updated = Array.isArray(data.updated) ? data.updated : []
  const bookmarks: WereadBookmarkItem[] = []
  for (const u of updated) {
    if (!u || typeof u !== 'object') continue
    const row = u as Record<string, unknown>
    const markText = String(row.markText ?? '').trim()
    const bookmarkId = String(row.bookmarkId ?? '').trim()
    if (!markText || !bookmarkId) continue
    bookmarks.push({
      bookmarkId,
      bookId: String(row.bookId ?? book.bookId ?? '').trim(),
      chapterUid: row.chapterUid == null ? null : Number(row.chapterUid),
      chapterIdx: row.chapterIdx == null ? null : Number(row.chapterIdx),
      range: row.range != null ? String(row.range) : null,
      markText,
      colorStyle: row.colorStyle == null ? null : Number(row.colorStyle),
      type: row.type == null ? null : Number(row.type),
      createTime: row.createTime == null ? null : Number(row.createTime),
      raw: row
    })
  }

  return {
    book,
    chapters,
    bookmarks,
    synckey: data.synckey,
    removed: data.removed,
    raw: data
  }
}

export function parseReviewListMineResponse(data: Record<string, unknown>): {
  reviews: WereadReviewItem[]
  hasMore: boolean
  synckey: unknown
  totalCount: number
} {
  const reviewsRaw = Array.isArray(data.reviews) ? data.reviews : []
  const reviews: WereadReviewItem[] = []
  for (const wrap of reviewsRaw) {
    if (!wrap || typeof wrap !== 'object') continue
    const w = wrap as Record<string, unknown>
    const review =
      w.review && typeof w.review === 'object'
        ? (w.review as Record<string, unknown>)
        : w
    const reviewId = String(review.reviewId ?? w.reviewId ?? '').trim()
    if (!reviewId) continue
    const content = String(review.content ?? '').trim()
    const abstract = review.abstract != null ? String(review.abstract).trim() : null
    reviews.push({
      reviewId,
      bookId: String(review.bookId ?? '').trim(),
      content,
      abstract: abstract || null,
      range: review.range != null ? String(review.range) : null,
      chapterUid: review.chapterUid == null ? null : Number(review.chapterUid),
      chapterIdx: review.chapterIdx == null ? null : Number(review.chapterIdx),
      chapterName:
        review.chapterName != null
          ? String(review.chapterName)
          : review.chapterTitle != null
            ? String(review.chapterTitle)
            : null,
      createTime: review.createTime == null ? null : Number(review.createTime),
      isPrivate: review.isPrivate == null ? null : Boolean(review.isPrivate),
      type: review.type == null ? null : Number(review.type),
      raw: review
    })
  }

  return {
    reviews,
    hasMore: Number(data.hasMore ?? 0) === 1,
    synckey: data.synckey,
    totalCount: Number(data.totalCount ?? reviews.length) || reviews.length
  }
}
