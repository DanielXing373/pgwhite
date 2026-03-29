// =====================================================
// GET /api/quotes — 规范化 schema；items 含 display（翻译文案由 DB 提供）
//
// tag 种类列默认 kind：1=场景时间 2=主题 3=修辞
// tag_translations: tag_id, language_code, tag_name
// =====================================================
import { createDbConnection } from '../utils/db'
import { getTagKindParams } from '../utils/tagKind'

function parseCsv(v: unknown): string[] {
  if (v == null || v === '') return []
  if (Array.isArray(v)) return (v as string[]).map(String).filter(Boolean)
  return String(v)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function parseBool(v: unknown, defaultVal: boolean): boolean {
  if (v === 'true' || v === true) return true
  if (v === 'false' || v === false) return false
  return defaultVal
}

function parseJsonNamedList(raw: unknown): { id: string; name: string }[] {
  if (raw == null) return []
  let arr: unknown
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  } else if (Array.isArray(raw)) {
    arr = raw
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
    return parseJsonNamedList(raw.toString('utf8'))
  } else {
    return []
  }
  if (!Array.isArray(arr)) return []
  return arr
    .map((x: Record<string, unknown>) => {
      const emojiRaw = x?.emoji
      return {
        id: String(x?.id ?? ''),
        name: String(x?.name ?? ''),
        ...(emojiRaw != null && String(emojiRaw) !== ''
          ? { emoji: String(emojiRaw) }
          : {})
      }
    })
    .filter(x => x.id)
}

function mapRow(row: Record<string, unknown>, config: ReturnType<typeof useRuntimeConfig>) {
  const langRaw = String(row.lang_raw ?? '')
  const en = String(config.dbLangEn || 'en')
  const language: 'zh' | 'en' =
    langRaw === en || langRaw.toLowerCase().startsWith('en') ? 'en' : 'zh'

  const authorId = String(row.author_id ?? '')
  const bookId = String(row.book_id ?? '')
  const authorName = String(row.author_name ?? '').trim()
  const bookTitle = String(row.book_title ?? '').trim()
  const authorEmoji = row.author_emoji != null && row.author_emoji !== '' ? String(row.author_emoji) : null
  const bookEmoji = row.book_emoji != null && row.book_emoji !== '' ? String(row.book_emoji) : null

  const characters = parseJsonNamedList(row.characters_json)
  const sceneTimes = parseJsonNamedList(row.scene_times_json)
  const themes = parseJsonNamedList(row.themes_json)
  const devices = parseJsonNamedList(row.devices_json)

  return {
    id: String(row.id ?? ''),
    text: String(row.text ?? ''),
    language,
    authorId,
    bookId,
    chapter: undefined as string | undefined,
    characterIds: characters.map(c => c.id),
    timeIds: sceneTimes.map(t => t.id),
    themeIds: themes.map(t => t.id),
    deviceIds: devices.map(t => t.id),
    display: {
      author: authorId
        ? { id: authorId, name: authorName || authorId, emoji: authorEmoji }
        : undefined,
      book: bookId ? { id: bookId, title: bookTitle || bookId, emoji: bookEmoji } : undefined,
      characters,
      sceneTimes,
      themes,
      devices
    }
  }
}

/**
 * 筛选语义（与 composables/useFilterEngine 一致）：
 * - 未选作者：作者 / 书目 / 人物 之间为 AND（与场景时间、主题、修辞、全文同一套 AND）。
 * - 已选至少一位作者：作者 ∪ 书目 ∪ 人物 为 OR（例：作者 A + 非 A 的书 B → A 的全部 ∪ B 的全部），
 *   再与全文、标签维度 AND。
 * - 同一维度内多选：IN = OR。
 */
function buildFilterSql(
  query: ReturnType<typeof getQuery>,
  config: ReturnType<typeof useRuntimeConfig>
): { fragments: string[]; params: unknown[] } {
  const q = query as Record<string, unknown>
  const qText = typeof q.q === 'string' ? q.q.trim() : ''

  const authors = parseCsv(q.author ?? q.authors)
  const books = parseCsv(q.book ?? q.books)
  const characters = parseCsv(q.character ?? q.characters)
  const times = parseCsv(q.sceneTime ?? q.times)
  const themes = parseCsv(q.theme ?? q.themes)
  const devices = parseCsv(q.device ?? q.devices)

  const timesAll = parseBool(q.timesAll, false)
  const themesAll = parseBool(q.themesAll, false)
  const devicesAll = parseBool(q.devicesAll, false)

  const { kindCol, kTime, kTheme, kDevice } = getTagKindParams(config)

  const fragments: string[] = []
  const params: unknown[] = []

  if (qText.length > 0) {
    fragments.push('LOWER(qt.content) LIKE ?')
    params.push(`%${qText.toLowerCase()}%`)
  }

  if (authors.length > 0) {
    const entityOr: string[] = []
    entityOr.push(`au.id IN (${authors.map(() => '?').join(',')})`)
    params.push(...authors)
    if (books.length > 0) {
      entityOr.push(`q.book_id IN (${books.map(() => '?').join(',')})`)
      params.push(...books)
    }
    if (characters.length > 0) {
      entityOr.push(
        `EXISTS (SELECT 1 FROM quote_characters qc WHERE qc.quote_id = q.id AND qc.character_id IN (${characters.map(() => '?').join(',')}))`
      )
      params.push(...characters)
    }
    fragments.push(`(${entityOr.join(' OR ')})`)
  } else {
    if (books.length > 0) {
      fragments.push(`q.book_id IN (${books.map(() => '?').join(',')})`)
      params.push(...books)
    }
    if (characters.length > 0) {
      fragments.push(
        `EXISTS (SELECT 1 FROM quote_characters qc WHERE qc.quote_id = q.id AND qc.character_id IN (${characters.map(() => '?').join(',')}))`
      )
      params.push(...characters)
    }
  }

  function addTagFilter(ids: string[], all: boolean, kindVal: number) {
    if (ids.length === 0) return
    if (all) {
      for (const id of ids) {
        fragments.push(
          `EXISTS (SELECT 1 FROM quote_tags rqt INNER JOIN tags tg ON tg.id = rqt.tag_id AND tg.${kindCol} = ? WHERE rqt.quote_id = q.id AND tg.id = ?)`
        )
        params.push(kindVal, id)
      }
    } else {
      fragments.push(
        `EXISTS (SELECT 1 FROM quote_tags rqt INNER JOIN tags tg ON tg.id = rqt.tag_id AND tg.${kindCol} = ? WHERE rqt.quote_id = q.id AND tg.id IN (${ids.map(() => '?').join(',')}))`
      )
      params.push(kindVal, ...ids)
    }
  }

  addTagFilter(times, timesAll, kTime)
  addTagFilter(themes, themesAll, kTheme)
  addTagFilter(devices, devicesAll, kDevice)

  return { fragments, params }
}

export default defineEventHandler(async event => {
  const query = getQuery(event)
  const config = useRuntimeConfig()
  const { kindCol, kTime, kTheme, kDevice } = getTagKindParams(config)

  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const pageSizeRaw = parseInt(String(query.pageSize ?? '10'), 10) || 10
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw))
  const offset = (page - 1) * pageSize

  const lang = (query.lang === 'zh' || query.lang === 'en' ? query.lang : 'en') as 'zh' | 'en'
  const dbLang = lang === 'zh' ? String(config.dbLangZh || 'zh') : String(config.dbLangEn || 'en')

  const { fragments, params: filterParams } = buildFilterSql(query, config)

  const whereExtra = fragments.length ? `AND ${fragments.join(' AND ')}` : ''

  const fromSql = `
FROM quotes q
INNER JOIN quote_translations qt ON qt.quote_id = q.id AND qt.language_code = ?
INNER JOIN books b ON b.id = q.book_id
INNER JOIN authors au ON au.id = b.author_id
WHERE 1=1
${whereExtra}
`

  const countSql = `
SELECT COUNT(DISTINCT q.id) AS total
${fromSql}
`

  const listSql = `
SELECT
  q.id,
  qt.content AS text,
  qt.language_code AS lang_raw,
  au.id AS author_id,
  au.emoji AS author_emoji,
  b.emoji AS book_emoji,
  q.book_id AS book_id,
  (SELECT at.name FROM author_translations at WHERE at.author_id = au.id AND at.language_code = ? LIMIT 1) AS author_name,
  (SELECT bt.title FROM book_translations bt WHERE bt.book_id = b.id AND bt.language_code = ? LIMIT 1) AS book_title,
  (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id', c.id, 'name', ct.name, 'emoji', c.emoji)), JSON_ARRAY())
   FROM quote_characters qc
   INNER JOIN characters c ON c.id = qc.character_id
   INNER JOIN character_translations ct ON ct.character_id = c.id AND ct.language_code = ?
   WHERE qc.quote_id = q.id) AS characters_json,
  (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id', tg.id, 'name', tt.tag_name, 'emoji', tg.emoji)), JSON_ARRAY())
   FROM quote_tags rqt
   INNER JOIN tags tg ON tg.id = rqt.tag_id AND tg.${kindCol} = ?
   INNER JOIN tag_translations tt ON tt.tag_id = tg.id AND tt.language_code = ?
   WHERE rqt.quote_id = q.id) AS scene_times_json,
  (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id', tg.id, 'name', tt.tag_name, 'emoji', tg.emoji)), JSON_ARRAY())
   FROM quote_tags rqt
   INNER JOIN tags tg ON tg.id = rqt.tag_id AND tg.${kindCol} = ?
   INNER JOIN tag_translations tt ON tt.tag_id = tg.id AND tt.language_code = ?
   WHERE rqt.quote_id = q.id) AS themes_json,
  (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id', tg.id, 'name', tt.tag_name, 'emoji', tg.emoji)), JSON_ARRAY())
   FROM quote_tags rqt
   INNER JOIN tags tg ON tg.id = rqt.tag_id AND tg.${kindCol} = ?
   INNER JOIN tag_translations tt ON tt.tag_id = tg.id AND tt.language_code = ?
   WHERE rqt.quote_id = q.id) AS devices_json
${fromSql}
ORDER BY q.id ASC
LIMIT ? OFFSET ?
`

  let connection
  try {
    connection = await createDbConnection()

    const countParams = [dbLang, ...filterParams]
    const [countRows] = await connection.query(countSql, countParams)
    const total = Number((countRows as { total: number }[])[0]?.total ?? 0)

    const listParams = [
      dbLang,
      dbLang,
      dbLang,
      kTime,
      dbLang,
      kTheme,
      dbLang,
      kDevice,
      dbLang,
      dbLang,
      ...filterParams,
      pageSize,
      offset
    ]
    const [rows] = await connection.query(listSql, listParams)

    const items = (rows as Record<string, unknown>[]).map(r => mapRow(r, config))

    return {
      page,
      pageSize,
      total,
      items
    }
  } catch (err) {
    console.error('[api/quotes]', err)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to query quotes.'
    })
  } finally {
    if (connection) {
      await connection.end().catch(() => {})
    }
  }
})
