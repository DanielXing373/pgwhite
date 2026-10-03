// =====================================================
// PGWhite WeRead import persistence
// Dual provenance: ImportItem→LibraryEntry and LibraryEntry.import_id→Import
// 1.3: Personal Quote always kept; canonical match = relationship only (no merge).
// =====================================================
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import {
  insertPersonalAnnotation,
  matchPersonalQuoteAgainstCommunity
} from '../canonicalMatching/persist'
import type {
  MatchDecisionStatus,
  PublicationEligibility
} from '../canonicalMatching/types'
import {
  deriveImportStatusFromItems,
  summarizeItemCounts,
  type ImportItemStatus
} from '../importStatuses'
import { DANIEL_SEED_KEY } from '../legacyWereadMigration'
import { assertNoCredentialInObject } from './client'
import {
  associationKey,
  type WereadBookmarkList,
  type WereadChapterInfo,
  type WereadReviewItem
} from './parseItems'

export type PersistBookInput = {
  wereadBookId: string
  title: string
  author: string
  bookmarkList: WereadBookmarkList
  reviews: WereadReviewItem[]
}

export type PersistQuoteMatchSummary = {
  quoteId: number
  matchStatus: MatchDecisionStatus
  publicationEligibility: PublicationEligibility
  relatedCommunityQuoteIds: number[]
}

export type PersistImportResult = {
  importId: number
  userId: number
  status: string
  counters: {
    total_items: number
    processed_items: number
    successful_items: number
    failed_items: number
  }
  books: Array<{
    wereadBookId: string
    pgBookId: number
    title: string
    bookmarkItems: number
    reviewItems: number
    quoteIds: number[]
    quoteMatches: PersistQuoteMatchSummary[]
  }>
}

async function resolveDanielUserId(conn: PoolConnection): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM users WHERE seed_key = ? LIMIT 1`,
    [DANIEL_SEED_KEY]
  )
  if (!rows.length) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Daniel user missing; run pnpm db:seed:dev-users'
    })
  }
  return Number(rows[0]!.id)
}

/** Exact zh name match only — no fuzzy canonical matching (1.3). */
export async function findOrCreateAuthorId(
  conn: PoolConnection,
  authorZh: string
): Promise<number> {
  const name = authorZh.trim() || '未知作者'
  const [existing] = await conn.query<RowDataPacket[]>(
    `SELECT at.author_id AS id
     FROM author_translations at
     WHERE at.language_code = 'zh' AND at.name = ?
     LIMIT 1`,
    [name]
  )
  if (existing.length) return Number(existing[0]!.id)

  const [ins] = await conn.query<ResultSetHeader>(
    `INSERT INTO authors (emoji) VALUES ('📖')`
  )
  const authorId = Number(ins.insertId)
  await conn.query(
    `INSERT INTO author_translations (author_id, language_code, name)
     VALUES (?, 'zh', ?), (?, 'en', ?)`,
    [authorId, name, authorId, name]
  )
  return authorId
}

/** Exact title + author_id match — no fuzzy matching. */
export async function findOrCreateBookId(
  conn: PoolConnection,
  authorId: number,
  titleZh: string
): Promise<number> {
  const title = titleZh.trim() || '未命名'
  const [existing] = await conn.query<RowDataPacket[]>(
    `SELECT b.id AS id
     FROM books b
     INNER JOIN book_translations bt
       ON bt.book_id = b.id AND bt.language_code = 'zh' AND bt.title = ?
     WHERE b.author_id = ?
     LIMIT 1`,
    [title, authorId]
  )
  if (existing.length) return Number(existing[0]!.id)

  const [ins] = await conn.query<ResultSetHeader>(
    `INSERT INTO books (author_id, emoji) VALUES (?, '📚')`,
    [authorId]
  )
  const bookId = Number(ins.insertId)
  await conn.query(
    `INSERT INTO book_translations (book_id, language_code, title)
     VALUES (?, 'zh', ?), (?, 'en', ?)`,
    [bookId, title, bookId, title]
  )
  return bookId
}

function chapterTitleFromList(
  chapters: WereadChapterInfo[],
  chapterUid: number | null | undefined
): string | null {
  if (chapterUid == null) return null
  const hit = chapters.find((c) => c.chapterUid === Number(chapterUid))
  return hit?.title ? String(hit.title) : null
}

/**
 * Insert a Personal Quote row. Never reuses/replaces a Community Quote row.
 * Matcher may later attach a relationship; text always remains this import's text.
 */
async function insertPersonalQuoteWithZh(
  conn: PoolConnection,
  opts: {
    bookId: number
    content: string
    sourceChapterUid: string | null
    chapterTitle: string | null
  }
): Promise<number> {
  const [ins] = await conn.query<ResultSetHeader>(
    `INSERT INTO quotes
       (book_id, corpus_layer, source_chapter_uid, chapter_title, publication_eligibility)
     VALUES (?, 'personal', ?, ?, NULL)`,
    [opts.bookId, opts.sourceChapterUid, opts.chapterTitle]
  )
  const quoteId = Number(ins.insertId)
  await conn.query(
    `INSERT INTO quote_translations (quote_id, language_code, content)
     VALUES (?, 'zh', ?)`,
    [quoteId, opts.content]
  )
  return quoteId
}

async function runCanonicalMatchForPersonalQuote(
  conn: PoolConnection,
  opts: {
    quoteId: number
    content: string
    bookId: number
    sourceChapterUid: string | null
  }
): Promise<PersistQuoteMatchSummary> {
  const decision = await matchPersonalQuoteAgainstCommunity(conn, {
    sourceQuoteId: opts.quoteId,
    sourceText: opts.content,
    sourceBookId: opts.bookId,
    sourceChapterUid: opts.sourceChapterUid
  })
  return {
    quoteId: opts.quoteId,
    matchStatus: decision.status,
    publicationEligibility: decision.publicationEligibility,
    relatedCommunityQuoteIds: decision.relations.map((r) => r.targetQuoteId)
  }
}

async function ensureLibraryEntry(
  conn: PoolConnection,
  userId: number,
  quoteId: number,
  importId: number
): Promise<number> {
  await conn.query(
    `INSERT INTO library_entries (user_id, quote_id, import_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       import_id = IF(library_entries.import_id IS NULL, VALUES(import_id), library_entries.import_id)`,
    [userId, quoteId, importId]
  )
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM library_entries WHERE user_id = ? AND quote_id = ? LIMIT 1`,
    [userId, quoteId]
  )
  if (!rows.length) {
    throw new Error('library_entry missing after upsert')
  }
  return Number(rows[0]!.id)
}

async function insertImportItem(
  conn: PoolConnection,
  opts: {
    importId: number
    externalId: string
    rawPayload: Record<string, unknown>
    status: ImportItemStatus
    libraryEntryId: number | null
    errorMessage: string | null
  }
): Promise<'inserted' | 'duplicate'> {
  assertNoCredentialInObject(opts.rawPayload)
  try {
    await conn.query(
      `INSERT INTO import_items
         (import_id, external_id, raw_payload, status, library_entry_id, error_message, processed_at)
       VALUES (?, ?, CAST(? AS JSON), ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        opts.importId,
        opts.externalId,
        JSON.stringify(opts.rawPayload),
        opts.status,
        opts.libraryEntryId,
        opts.errorMessage
      ]
    )
    return 'inserted'
  } catch (err: unknown) {
    const e = err as { code?: string; errno?: number }
    if (e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062) return 'duplicate'
    throw err
  }
}

export async function persistWereadImport(
  pool: Pool,
  books: PersistBookInput[]
): Promise<PersistImportResult> {
  const conn = await pool.getConnection()
  const itemStatuses: ImportItemStatus[] = []
  const bookSummaries: PersistImportResult['books'] = []

  try {
    await conn.beginTransaction()
    const userId = await resolveDanielUserId(conn)

    const [impRes] = await conn.query<ResultSetHeader>(
      `INSERT INTO imports
         (user_id, source, provenance_type, status, started_at, reconstruction_key)
       VALUES (?, 'weread', 'runtime', 'processing', CURRENT_TIMESTAMP, NULL)`,
      [userId]
    )
    const importId = Number(impRes.insertId)

    for (const bookIn of books) {
      const title = bookIn.title.trim() || String(bookIn.bookmarkList.book.title || '')
      const author = bookIn.author.trim() || String(bookIn.bookmarkList.book.author || '未知作者')
      const authorId = await findOrCreateAuthorId(conn, author)
      const pgBookId = await findOrCreateBookId(conn, authorId, title)

      const quoteIds: number[] = []
      const quoteMatches: PersistQuoteMatchSummary[] = []
      const assocToEntry = new Map<string, { libraryEntryId: number; quoteId: number }>()
      let bookmarkItems = 0
      let reviewItems = 0

      for (const bm of bookIn.bookmarkList.bookmarks) {
        bookmarkItems++
        const externalId = `weread:bookmark:${bm.bookmarkId}`
        try {
          if (!bm.markText.trim()) {
            const r = await insertImportItem(conn, {
              importId,
              externalId,
              rawPayload: { kind: 'weread_bookmark', item: bm.raw },
              status: 'failed',
              libraryEntryId: null,
              errorMessage: 'Empty markText'
            })
            itemStatuses.push(r === 'duplicate' ? 'duplicate' : 'failed')
            continue
          }

          const sourceChapterUid =
            bm.chapterUid == null ? null : String(bm.chapterUid)
          const chapterTitle = chapterTitleFromList(
            bookIn.bookmarkList.chapters,
            bm.chapterUid
          )
          const quoteId = await insertPersonalQuoteWithZh(conn, {
            bookId: pgBookId,
            content: bm.markText,
            sourceChapterUid,
            chapterTitle
          })
          const libraryEntryId = await ensureLibraryEntry(conn, userId, quoteId, importId)
          const r = await insertImportItem(conn, {
            importId,
            externalId,
            rawPayload: {
              kind: 'weread_bookmark',
              item: bm.raw,
              chapters: bookIn.bookmarkList.chapters,
              book: bookIn.bookmarkList.book
            },
            status: 'processed',
            libraryEntryId,
            errorMessage: null
          })
          if (r === 'duplicate') {
            itemStatuses.push('duplicate')
            // Roll back orphan quote if item was duplicate — avoid litter.
            // Unique is on import+external_id; duplicate within same import means retry.
            await conn.query(`DELETE FROM quotes WHERE id = ?`, [quoteId])
          } else {
            itemStatuses.push('processed')
            quoteIds.push(quoteId)
            const matchSummary = await runCanonicalMatchForPersonalQuote(conn, {
              quoteId,
              content: bm.markText,
              bookId: pgBookId,
              sourceChapterUid
            })
            quoteMatches.push(matchSummary)
            const key = associationKey(bm.bookId || bookIn.wereadBookId, bm.chapterUid, bm.range)
            if (key) assocToEntry.set(key, { libraryEntryId, quoteId })
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'bookmark persist failed'
          const r = await insertImportItem(conn, {
            importId,
            externalId,
            rawPayload: { kind: 'weread_bookmark', item: bm.raw },
            status: 'failed',
            libraryEntryId: null,
            errorMessage: msg.slice(0, 500)
          })
          itemStatuses.push(r === 'duplicate' ? 'duplicate' : 'failed')
        }
      }

      for (const rv of bookIn.reviews) {
        reviewItems++
        const externalId = `weread:review:${rv.reviewId}`
        try {
          const key = associationKey(
            rv.bookId || bookIn.wereadBookId,
            rv.chapterUid,
            rv.range
          )
          const linked = key ? assocToEntry.get(key) : undefined

          if (linked) {
            // Reliable structural association: same ImportItem→LibraryEntry as highlight.
            // Annotation is Personal metadata — never written onto a Community Quote.
            const annotationText = rv.content.trim()
            if (annotationText) {
              await insertPersonalAnnotation(conn, {
                libraryEntryId: linked.libraryEntryId,
                content: annotationText,
                source: 'weread_review',
                externalId,
                rawPayload: rv.raw
              })
            }
            const r = await insertImportItem(conn, {
              importId,
              externalId,
              rawPayload: {
                kind: 'weread_review',
                associatedBookmarkKey: key,
                associatedQuoteId: linked.quoteId,
                item: rv.raw
              },
              status: 'processed',
              libraryEntryId: linked.libraryEntryId,
              errorMessage: null
            })
            itemStatuses.push(r === 'duplicate' ? 'duplicate' : 'processed')
            continue
          }

          // No reliable association — still import as its own Personal Quote when content exists.
          // (1.2 orphan-review behavior retained; short labels remain product debt, not deleted.)
          const text = rv.content.trim() || (rv.abstract || '').trim()
          if (!text) {
            const r = await insertImportItem(conn, {
              importId,
              externalId,
              rawPayload: { kind: 'weread_review', item: rv.raw },
              status: 'partial',
              libraryEntryId: null,
              errorMessage: 'Review has no content/abstract and no bookmark association'
            })
            itemStatuses.push(r === 'duplicate' ? 'duplicate' : 'partial')
            continue
          }

          const sourceChapterUid =
            rv.chapterUid == null ? null : String(rv.chapterUid)
          const chapterTitle =
            rv.chapterName ||
            chapterTitleFromList(bookIn.bookmarkList.chapters, rv.chapterUid)
          const quoteId = await insertPersonalQuoteWithZh(conn, {
            bookId: pgBookId,
            content: text,
            sourceChapterUid,
            chapterTitle
          })
          const libraryEntryId = await ensureLibraryEntry(conn, userId, quoteId, importId)
          // Also keep annotation row for orphan review content (Personal metadata).
          await insertPersonalAnnotation(conn, {
            libraryEntryId,
            content: text,
            source: 'weread_review_orphan',
            externalId,
            rawPayload: rv.raw
          })
          const r = await insertImportItem(conn, {
            importId,
            externalId,
            rawPayload: {
              kind: 'weread_review',
              associatedBookmarkKey: null,
              item: rv.raw
            },
            status: 'processed',
            libraryEntryId,
            errorMessage: null
          })
          if (r === 'duplicate') {
            itemStatuses.push('duplicate')
            await conn.query(`DELETE FROM quotes WHERE id = ?`, [quoteId])
          } else {
            itemStatuses.push('processed')
            quoteIds.push(quoteId)
            quoteMatches.push(
              await runCanonicalMatchForPersonalQuote(conn, {
                quoteId,
                content: text,
                bookId: pgBookId,
                sourceChapterUid
              })
            )
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'review persist failed'
          const r = await insertImportItem(conn, {
            importId,
            externalId,
            rawPayload: { kind: 'weread_review', item: rv.raw },
            status: 'failed',
            libraryEntryId: null,
            errorMessage: msg.slice(0, 500)
          })
          itemStatuses.push(r === 'duplicate' ? 'duplicate' : 'failed')
        }
      }

      bookSummaries.push({
        wereadBookId: bookIn.wereadBookId,
        pgBookId,
        title,
        bookmarkItems,
        reviewItems,
        quoteIds,
        quoteMatches
      })
    }

    const status = deriveImportStatusFromItems(itemStatuses)
    const counters = summarizeItemCounts(itemStatuses)
    await conn.query(
      `UPDATE imports SET status = ?, completed_at = CURRENT_TIMESTAMP,
         total_items = ?, processed_items = ?, successful_items = ?, failed_items = ?
       WHERE id = ?`,
      [
        status,
        counters.total_items,
        counters.processed_items,
        counters.successful_items,
        counters.failed_items,
        importId
      ]
    )

    await conn.commit()
    return {
      importId,
      userId,
      status,
      counters,
      books: bookSummaries
    }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

import { wereadGatewayPost } from './client'
import { parseReviewListMineResponse } from './parseItems'

/** Fetch all pages of /review/list/mine for a book */
export async function fetchAllReviewsForBook(
  apiKey: string,
  bookId: string
): Promise<WereadReviewItem[]> {
  const all: WereadReviewItem[] = []
  let synckey = 0
  let guard = 0
  while (guard++ < 50) {
    const data = await wereadGatewayPost<Record<string, unknown>>(apiKey, {
      api_name: '/review/list/mine',
      bookid: bookId,
      synckey,
      count: 50
    })
    const parsed = parseReviewListMineResponse(data)
    all.push(...parsed.reviews)
    if (!parsed.hasMore) break
    synckey = Number(parsed.synckey ?? 0) || synckey
  }
  return all
}
