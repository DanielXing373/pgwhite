// =====================================================
// Shared SQL shape for /api/quotes — language + partial-quote joins.
// Extracted for regression tests (behavior must stay intentional).
// =====================================================

/** Tag aggregation subquery: LEFT JOIN so quotes without tags still return. */
export function tagAggSubquery(kindCol: string, alias: string, jsonAlias: string): string {
  return `
LEFT JOIN (
  SELECT rqt.quote_id,
    JSON_ARRAYAGG(JSON_OBJECT('id', tg.id, 'name', tt.tag_name, 'emoji', tg.emoji)) AS ${jsonAlias}
  FROM quote_tags rqt
  INNER JOIN tags tg ON tg.id = rqt.tag_id AND tg.${kindCol} = ?
  INNER JOIN tag_translations tt ON tt.tag_id = tg.id AND tt.language_code = ?
  GROUP BY rqt.quote_id
) ${alias} ON ${alias}.quote_id = q.id`
}

/**
 * CURRENT language behavior (do not change without product decision):
 * quote_translations is INNER JOIN on language_code.
 * A quote with only zh content does NOT appear when lang=en.
 */
export function buildQuotesBaseFrom(whereExtra: string): string {
  return `
FROM quotes q
INNER JOIN quote_translations qt ON qt.quote_id = q.id AND qt.language_code = ?
INNER JOIN books b ON b.id = q.book_id
INNER JOIN authors au ON au.id = b.author_id
WHERE 1=1
${whereExtra}
`
}

/**
 * CURRENT partial-quote behavior:
 * characters / scene times / themes / devices use LEFT JOIN (+ COALESCE empty array).
 * Quotes with no quote_characters / quote_tags rows still appear in results.
 */
export function buildQuotesListSelect(kindCol: string, whereExtra: string, sortOrder: 'ASC' | 'DESC'): string {
  return `
SELECT
  q.id,
  qt.content AS text,
  qt.language_code AS lang_raw,
  au.id AS author_id,
  au.emoji AS author_emoji,
  b.emoji AS book_emoji,
  q.book_id AS book_id,
  at.name AS author_name,
  bt.title AS book_title,
  COALESCE(ch.characters_json, JSON_ARRAY()) AS characters_json,
  COALESCE(st.scene_times_json, JSON_ARRAY()) AS scene_times_json,
  COALESCE(th.themes_json, JSON_ARRAY()) AS themes_json,
  COALESCE(dv.devices_json, JSON_ARRAY()) AS devices_json
FROM quotes q
INNER JOIN quote_translations qt ON qt.quote_id = q.id AND qt.language_code = ?
INNER JOIN books b ON b.id = q.book_id
INNER JOIN authors au ON au.id = b.author_id
LEFT JOIN author_translations at ON at.author_id = au.id AND at.language_code = ?
LEFT JOIN book_translations bt ON bt.book_id = b.id AND bt.language_code = ?
LEFT JOIN (
  SELECT qc.quote_id,
    JSON_ARRAYAGG(JSON_OBJECT('id', c.id, 'name', ct.name, 'emoji', c.emoji)) AS characters_json
  FROM quote_characters qc
  INNER JOIN characters c ON c.id = qc.character_id
  INNER JOIN character_translations ct ON ct.character_id = c.id AND ct.language_code = ?
  GROUP BY qc.quote_id
) ch ON ch.quote_id = q.id
${tagAggSubquery(kindCol, 'st', 'scene_times_json')}
${tagAggSubquery(kindCol, 'th', 'themes_json')}
${tagAggSubquery(kindCol, 'dv', 'devices_json')}
WHERE 1=1
${whereExtra}
ORDER BY q.id ${sortOrder}
LIMIT ? OFFSET ?
`
}
