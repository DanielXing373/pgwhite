// =====================================================
// File: composables/useFacets.ts
// 标题：Facet 计算（保证始终返回 FacetOptions，不为 undefined）
// =====================================================
import { useDataset, type Sentence } from '~/composables/useDataset'
import { prependEmoji } from '~/composables/useUIHelpers'

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
        case 'authors': {
          const author = authorById.get(id)
          const base = isEN ? (author?.name_en || author?.name_zh || id)
                             : (author?.name_zh || author?.name_en || id)
          return prependEmoji(author?.emoji, base)
        }
        case 'books': {
          const book = bookById.get(id)
          const rawTitle = isEN ? (book?.title_en || book?.title_zh || id)
                                : (book?.title_zh || book?.title_en || id)
          const formatted = formatBookTitle(rawTitle, isEN)
          return prependEmoji(book?.emoji, formatted)
        }
        case 'genres': {
          const genre = genreById.get(id)
          const base = isEN ? (genre?.name_en || genre?.name_zh || id)
                             : (genre?.name_zh || genre?.name_en || id)
          return prependEmoji(genre?.emoji, base)
        }
        case 'times': {
          const time = timeById.get(id)
          const base = isEN ? (time?.name_en || time?.name_zh || id)
                            : (time?.name_zh || time?.name_en || id)
          return prependEmoji(time?.emoji, base)
        }
        case 'themes': {
          const theme = themeById.get(id)
          const base = isEN ? (theme?.name_en || theme?.name_zh || id)
                             : (theme?.name_zh || theme?.name_en || id)
          return prependEmoji(theme?.emoji, base)
        }
        case 'devices': {
          const device = deviceById.get(id)
          const base = isEN ? (device?.name_en || device?.name_zh || id)
                              : (device?.name_zh || device?.name_en || id)
          return prependEmoji(device?.emoji, base)
        }
      }
    }
    return Array.from(new Set(ids)).map(id => ({ id, label: mapLabel(id) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  function build(sentences: Sentence[], f: Filters) {
    // —— 只用语言来决定"候选集合"，不受文本搜索影响 —— //
    // 这样标签栏始终显示所有可用的选项，用户可以自由选择
    // 文本搜索和标签筛选都只影响搜索结果，不影响标签栏显示
    const activeLang = (locale.value === 'en' ? 'en' : 'zh') as 'zh' | 'en'
  
    // 只根据语言过滤，不考虑文本搜索
    const base = sentences.filter(s => {
      if (s.language !== activeLang) return false
      return true
    })
  
    // —— 不再根据其它维度（authors/books/…）裁剪 —— //
    // 显示当前语言下所有可用的标签选项
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