// =====================================================
// File: composables/useFacets.ts
// 标题：Facet 计算（保证始终返回 FacetOptions，不为 undefined）
// =====================================================
import { useDataset, type Sentence } from '~/composables/useDataset'
import { EMPTY_FACETS, type FacetOptions } from '~/composables/dimensions'

type Filters = {
  q: string
  authors: string[]
  books: string[]
  genres: string[]
  times: string[]
  themes: string[]
  devices: string[]
}

function includesIgnoreCase(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase())
}

export function useFacets() {
  const {
    authors, books, genres, times, themes, devices,
    authorById, bookById, genreById, timeById, themeById, deviceById
  } = useDataset()
  
  // 在 composable 顶层获取 locale，确保响应式
  const { locale } = useI18n()

  function baseByLangAndText(sentences: Sentence[], f: Filters): Sentence[] {
    const activeLang = (locale.value === 'en' ? 'en' : 'zh') as 'zh' | 'en'
    return sentences.filter(s => {
      if (s.language !== activeLang) return false
      if (f.q && !includesIgnoreCase(s.text, f.q)) return false
      return true
    })
  }

  function applyOtherDims(cands: Sentence[], f: Filters, exclude: keyof Filters): Sentence[] {
    const need = (key: keyof Filters) => (exclude === key ? [] : (f as any)[key] as string[])
    const authorsSel = need('authors')
    const booksSel   = need('books')
    const genresSel  = need('genres')
    const timesSel   = need('times')
    const themesSel  = need('themes')
    const devicesSel = need('devices')

    return cands.filter(s => {
      if (authorsSel.length && !authorsSel.includes(s.authorId)) return false
      if (booksSel.length   && !booksSel.includes(s.bookId))     return false
      if (genresSel.length  && !genresSel.every(id => s.genreIds.includes(id))) return false
      if (timesSel.length   && !timesSel.every(id => s.timeIds.includes(id)))   return false
      if (themesSel.length  && !themesSel.every(id => s.themeIds.includes(id))) return false
      if (devicesSel.length && !devicesSel.every(id => s.deviceIds.includes(id))) return false
      return true
    })
  }

  /**
   * 格式化书名：中文加书名号，英文返回原文本（在筛选区 chips 中通过 CSS 处理斜体）
   */
  function formatBookTitle(title: string, isEN: boolean): string {
    if (isEN) {
      return title // 英文：返回原文本，通过 CSS class 设置斜体
    } else {
      return `《${title}》` // 中文：加书名号
    }
  }

  function toOptions(ids: string[], dim: 'authors'|'books'|'genres'|'times'|'themes'|'devices') {
    // 使用 composable 顶层的 locale，确保响应式更新
    const isEN = locale.value === 'en'
    const mapLabel = (id: string): string => {
      switch (dim) {
        case 'authors': return isEN ? (authorById.get(id)?.name_en || authorById.get(id)?.name_zh || id)
                                    : (authorById.get(id)?.name_zh || authorById.get(id)?.name_en || id)
        case 'books':   {
          const rawTitle = isEN ? (bookById.get(id)?.title_en || bookById.get(id)?.title_zh || id)
                                : (bookById.get(id)?.title_zh || bookById.get(id)?.title_en || id)
          return formatBookTitle(rawTitle, isEN)
        }
        case 'genres':  return isEN ? (genreById.get(id)?.name_en || genreById.get(id)?.name_zh || id)
                                    : (genreById.get(id)?.name_zh || genreById.get(id)?.name_en || id)
        case 'times':   return isEN ? (timeById.get(id)?.name_en || timeById.get(id)?.name_zh || id)
                                    : (timeById.get(id)?.name_zh || timeById.get(id)?.name_en || id)
        case 'themes':  return isEN ? (themeById.get(id)?.name_en || themeById.get(id)?.name_zh || id)
                                    : (themeById.get(id)?.name_zh || themeById.get(id)?.name_en || id)
        case 'devices': return isEN ? (deviceById.get(id)?.name_en || deviceById.get(id)?.name_zh || id)
                                    : (deviceById.get(id)?.name_zh || deviceById.get(id)?.name_en || id)
      }
    }
    return Array.from(new Set(ids)).map(id => ({ id, label: mapLabel(id) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  function build(sentences: Sentence[], f: Filters) {
    // —— 只用 语言 + 文本 来决定"候选集合" —— //
    // 使用 composable 顶层的 locale，确保响应式更新
    const activeLang = (locale.value === 'en' ? 'en' : 'zh') as 'zh' | 'en'
  
    const base = sentences.filter(s => {
      if (s.language !== activeLang) return false
      if (f.q && !includesIgnoreCase(s.text, f.q)) return false
      return true
    })
  
    // —— 不再根据其它维度（authors/books/…）裁剪 —— //
    const candAuthors = Array.from(new Set(base.map(s => s.authorId)))
    const candBooks   = Array.from(new Set(base.map(s => s.bookId)))
    const candGenres  = Array.from(new Set(base.flatMap(s => s.genreIds)))
    const candTimes   = Array.from(new Set(base.flatMap(s => s.timeIds)))
    const candThemes  = Array.from(new Set(base.flatMap(s => s.themeIds)))
    const candDevices = Array.from(new Set(base.flatMap(s => s.deviceIds)))
  
    // —— 使用已有的映射函数把 id -> label（中/英） —— //
    return {
      authors: toOptions(candAuthors, 'authors'),
      books:   toOptions(candBooks,   'books'),
      genres:  toOptions(candGenres,  'genres'),
      times:   toOptions(candTimes,   'times'),
      themes:  toOptions(candThemes,  'themes'),
      devices: toOptions(candDevices, 'devices')
    }
  }

  return { build }
}