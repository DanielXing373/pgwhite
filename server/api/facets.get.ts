// =====================================================
// GET /api/facets — 筛选栏全量选项（当前语言下的 label），与 data/*.json 无关
// Query: lang=zh|en
// =====================================================
import { getDbPool } from '../utils/db'
import { getTagKindParams } from '../utils/tagKind'
import type { FacetOptions } from '~/composables/dimensions'

function prependEmoji(emoji: string | null | undefined, label: string): string {
  const e = emoji?.trim()
  if (!e) return label
  return `${e} ${label}`.trim()
}

function formatBookLabel(title: string, lang: 'zh' | 'en'): string {
  return lang === 'zh' ? `《${title}》` : title
}

export default defineEventHandler(async event => {
  const query = getQuery(event) as Record<string, unknown>
  const config = useRuntimeConfig()
  const lang = (query.lang === 'zh' || query.lang === 'en' ? query.lang : 'en') as 'zh' | 'en'
  const dbLang = lang === 'zh' ? String(config.dbLangZh || 'zh') : String(config.dbLangEn || 'en')
  const { kindCol, kTime, kTheme, kDevice } = getTagKindParams(config)

  try {
    const pool = getDbPool()

    const [authorRows] = await pool.query(
      `SELECT au.id, au.emoji, at.name
       FROM authors au
       INNER JOIN author_translations at ON at.author_id = au.id AND at.language_code = ?
       ORDER BY at.name`,
      [dbLang]
    )

    const [bookRows] = await pool.query(
      `SELECT b.id, b.emoji, bt.title AS title
       FROM books b
       INNER JOIN book_translations bt ON bt.book_id = b.id AND bt.language_code = ?
       ORDER BY bt.title`,
      [dbLang]
    )

    const [characterRows] = await pool.query(
      `SELECT c.id, c.emoji, ct.name
       FROM characters c
       INNER JOIN character_translations ct ON ct.character_id = c.id AND ct.language_code = ?
       ORDER BY ct.name`,
      [dbLang]
    )

    const tagSql = `
      SELECT tg.id, tg.emoji, tt.tag_name
      FROM tags tg
      INNER JOIN tag_translations tt ON tt.tag_id = tg.id AND tt.language_code = ?
      WHERE tg.${kindCol} = ?
      ORDER BY tt.tag_name
    `

    const [timeRows] = await pool.query(tagSql, [dbLang, kTime])
    const [themeRows] = await pool.query(tagSql, [dbLang, kTheme])
    const [deviceRows] = await pool.query(tagSql, [dbLang, kDevice])

    const authors = (authorRows as { id: unknown; emoji: unknown; name: unknown }[]).map(r => ({
      id: String(r.id),
      label: prependEmoji(r.emoji != null ? String(r.emoji) : '', String(r.name ?? ''))
    }))

    const books = (bookRows as { id: unknown; emoji: unknown; title: unknown }[]).map(r => ({
      id: String(r.id),
      label: prependEmoji(r.emoji != null ? String(r.emoji) : '', formatBookLabel(String(r.title ?? ''), lang))
    }))

    const characters = (characterRows as { id: unknown; emoji: unknown; name: unknown }[]).map(r => ({
      id: String(r.id),
      label: prependEmoji(r.emoji != null ? String(r.emoji) : '', String(r.name ?? ''))
    }))

    const mapTag = (rows: { id: unknown; emoji: unknown; tag_name: unknown }[]) =>
      rows.map(r => ({
        id: String(r.id),
        label: prependEmoji(r.emoji != null ? String(r.emoji) : '', String(r.tag_name ?? ''))
      }))

    const payload: FacetOptions = {
      authors,
      books,
      characters,
      times: mapTag(timeRows as { id: unknown; tag_name: unknown }[]),
      themes: mapTag(themeRows as { id: unknown; tag_name: unknown }[]),
      devices: mapTag(deviceRows as { id: unknown; tag_name: unknown }[])
    }

    return payload
  } catch (err) {
    console.error('[api/facets]', err)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load facets.'
    })
  }
})
