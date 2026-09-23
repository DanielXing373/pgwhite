// =====================================================
// GET /api/quotes — 规范化 schema；items 含 display（翻译文案由 DB 提供）
//
// tag 种类列默认 source_code：1=场景时间 2=主题 3=修辞
// tag_translations: tag_id, language_code, tag_name
// =====================================================
import { getDbPool } from '../utils/db'
import { getTagKindParams } from '../utils/tagKind'
import { buildFilterSql } from '../utils/quoteFilters'
import { buildQuotesBaseFrom, buildQuotesListSelect } from '../utils/quoteQueryParts'

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

export default defineEventHandler(async event => {
  const query = getQuery(event)
  const config = useRuntimeConfig()
  const { kindCol, kTime, kTheme, kDevice } = getTagKindParams(config)

  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const pageSizeRaw = parseInt(String(query.pageSize ?? '10'), 10) || 10
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw))
  const offset = (page - 1) * pageSize

  const lang = (query.lang === 'zh' || query.lang === 'en' ? query.lang : 'zh') as 'zh' | 'en'
  const dbLang = lang === 'zh' ? String(config.dbLangZh || 'zh') : String(config.dbLangEn || 'en')
  const sortOrder = query.sort === 'desc' ? 'DESC' : 'ASC'

  const { fragments, params: filterParams } = buildFilterSql(query as Record<string, unknown>, config)
  const whereExtra = fragments.length ? `AND ${fragments.join(' AND ')}` : ''

  const baseFrom = buildQuotesBaseFrom(whereExtra)
  const countSql = `SELECT COUNT(*) AS total ${baseFrom}`
  const listSql = buildQuotesListSelect(kindCol, whereExtra, sortOrder)

  try {
    const pool = getDbPool()
    const countParams = [dbLang, ...filterParams]
    const [countRows] = await pool.query(countSql, countParams)
    const total = Number((countRows as { total: number }[])[0]?.total ?? 0)

    const listParams = [
      dbLang,
      dbLang,
      dbLang,
      dbLang,
      kTime,
      dbLang,
      kTheme,
      dbLang,
      kDevice,
      dbLang,
      ...filterParams,
      pageSize,
      offset
    ]
    const [rows] = await pool.query(listSql, listParams)
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
  }
})
