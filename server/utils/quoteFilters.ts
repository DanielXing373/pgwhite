// =====================================================
// Quote list filter SQL builder (shared by /api/quotes + unit tests)
// Semantics documented in architecture audit / useFilterEngine comments.
// =====================================================
import { getTagKindParams, type TagKindConfig } from './tagKind'

export function parseCsv(v: unknown): string[] {
  if (v == null || v === '') return []
  if (Array.isArray(v)) return (v as string[]).map(String).filter(Boolean)
  return String(v)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

export function parseBool(v: unknown, defaultVal: boolean): boolean {
  if (v === 'true' || v === true) return true
  if (v === 'false' || v === false) return false
  return defaultVal
}

/**
 * 筛选语义：
 * - 未选作者：作者 / 书目 / 人物 之间为 AND（与场景时间、主题、修辞、全文同一套 AND）。
 * - 已选至少一位作者：作者 ∪ 书目 ∪ 人物 为 OR，再与全文、标签维度 AND。
 * - 同一维度内多选：IN = OR。
 * - timesAll / themesAll / devicesAll：该维度内多选改为 AND（每条 EXISTS）。
 */
export function buildFilterSql(
  query: Record<string, unknown>,
  config: TagKindConfig
): { fragments: string[]; params: unknown[] } {
  const qText = typeof query.q === 'string' ? query.q.trim() : ''

  const authors = parseCsv(query.author ?? query.authors)
  const books = parseCsv(query.book ?? query.books)
  const characters = parseCsv(query.character ?? query.characters)
  const times = parseCsv(query.sceneTime ?? query.times)
  const themes = parseCsv(query.theme ?? query.themes)
  const devices = parseCsv(query.device ?? query.devices)

  const timesAll = parseBool(query.timesAll, false)
  const themesAll = parseBool(query.themesAll, false)
  const devicesAll = parseBool(query.devicesAll, false)

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
