// =====================================================
// Persist match relations + eligibility (additive only)
// =====================================================

import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { decideCanonicalMatch } from './decide'
import type { MatchDecision, QuoteCandidate } from './types'

export async function loadCommunityCandidatesForBook(
  conn: PoolConnection,
  bookId: number
): Promise<QuoteCandidate[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT q.id AS quote_id,
            q.book_id AS book_id,
            q.source_chapter_uid AS source_chapter_uid,
            q.corpus_layer AS corpus_layer,
            qt.content AS content
       FROM quotes q
       INNER JOIN quote_translations qt
         ON qt.quote_id = q.id AND qt.language_code = 'zh'
      WHERE q.book_id = ?
        AND q.corpus_layer = 'community'`,
    [bookId]
  )
  return rows.map((r) => ({
    quoteId: Number(r.quote_id),
    bookId: Number(r.book_id),
    content: String(r.content),
    sourceChapterUid:
      r.source_chapter_uid == null ? null : String(r.source_chapter_uid),
    corpusLayer: 'community' as const
  }))
}

export async function persistMatchDecision(
  conn: PoolConnection,
  sourceQuoteId: number,
  decision: MatchDecision
): Promise<void> {
  await conn.query(
    `UPDATE quotes
        SET publication_eligibility = ?
      WHERE id = ?`,
    [decision.publicationEligibility, sourceQuoteId]
  )

  for (const rel of decision.relations) {
    await conn.query(
      `INSERT INTO quote_match_relations
         (source_quote_id, target_quote_id, relation_status,
          publication_eligibility, score_features, matcher_rule, matcher_version)
       VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, ?)
       ON DUPLICATE KEY UPDATE
         relation_status = VALUES(relation_status),
         publication_eligibility = VALUES(publication_eligibility),
         score_features = VALUES(score_features),
         matcher_rule = VALUES(matcher_rule),
         matcher_version = VALUES(matcher_version)`,
      [
        sourceQuoteId,
        rel.targetQuoteId,
        rel.relationStatus,
        rel.publicationEligibility,
        JSON.stringify(rel.features),
        rel.matcherRule,
        decision.matcherVersion
      ]
    )
  }
}

export async function matchPersonalQuoteAgainstCommunity(
  conn: PoolConnection,
  input: {
    sourceQuoteId: number
    sourceText: string
    sourceBookId: number
    sourceChapterUid: string | null
  }
): Promise<MatchDecision> {
  const candidates = await loadCommunityCandidatesForBook(conn, input.sourceBookId)
  const decision = decideCanonicalMatch({
    sourceText: input.sourceText,
    sourceBookId: input.sourceBookId,
    sourceChapterUid: input.sourceChapterUid,
    communityCandidates: candidates
  })
  await persistMatchDecision(conn, input.sourceQuoteId, decision)
  return decision
}

export async function insertPersonalAnnotation(
  conn: PoolConnection,
  input: {
    libraryEntryId: number
    content: string
    source?: string
    externalId?: string | null
    rawPayload?: unknown
  }
): Promise<number | null> {
  const content = input.content.trim()
  if (!content) return null
  const [res] = await conn.query<ResultSetHeader>(
    `INSERT INTO personal_annotations
       (library_entry_id, content, source, external_id, raw_payload)
     VALUES (?, ?, ?, ?, CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE
       content = VALUES(content),
       raw_payload = VALUES(raw_payload)`,
    [
      input.libraryEntryId,
      content,
      input.source || 'weread_review',
      input.externalId ?? null,
      JSON.stringify(input.rawPayload ?? null)
    ]
  )
  return Number(res.insertId) || null
}
