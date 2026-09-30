// =====================================================
// Parse /user/notebooks (sanitized product view for Book Picker)
// =====================================================

export type WereadNotebookBook = {
  bookId: string
  title: string
  author: string
  translator: string | null
  cover: string | null
  readingProgress: number
  noteCount: number
  bookmarkCount: number
  reviewCount: number
  markedStatus: number | null
  version: string | null
  format: string | null
  language: string | null
}

export function parseNotebooksResponse(data: Record<string, unknown>): {
  totalBookCount: number
  totalNoteCount: number
  hasMore: boolean
  books: WereadNotebookBook[]
} {
  const booksRaw = Array.isArray(data.books) ? data.books : []
  const books: WereadNotebookBook[] = []

  for (const row of booksRaw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const book = (r.book && typeof r.book === 'object' ? r.book : {}) as Record<string, unknown>
    const bookId = String(r.bookId ?? book.bookId ?? '').trim()
    if (!bookId) continue
    books.push({
      bookId,
      title: String(book.title ?? '').trim() || `book-${bookId}`,
      author: String(book.author ?? '').trim() || '未知作者',
      translator: book.translator != null && String(book.translator).trim()
        ? String(book.translator).trim()
        : null,
      cover: book.cover != null && String(book.cover).trim() ? String(book.cover).trim() : null,
      readingProgress: Number(r.readingProgress ?? 0) || 0,
      noteCount: Number(r.noteCount ?? 0) || 0,
      bookmarkCount: Number(r.bookmarkCount ?? 0) || 0,
      reviewCount: Number(r.reviewCount ?? 0) || 0,
      markedStatus: r.markedStatus == null ? null : Number(r.markedStatus),
      version: book.version != null ? String(book.version) : null,
      format: book.format != null ? String(book.format) : null,
      language: book.language != null ? String(book.language) : null
    })
  }

  return {
    totalBookCount: Number(data.totalBookCount ?? books.length) || books.length,
    totalNoteCount: Number(data.totalNoteCount ?? 0) || 0,
    hasMore: Number(data.hasMore ?? 0) === 1,
    books
  }
}
