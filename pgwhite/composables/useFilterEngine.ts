// =====================================================
// File: composables/useFilterEngine.ts
// 标题：过滤引擎（文本 + 交集 + 语言隐形筛选）
// 说明：未选=全选；语言由 i18n.locale 决定（隐形）
// =====================================================
import type { Sentence } from './useDataset'

export type Filters = {
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

export function useFilterEngine() {
  const { locale } = useI18n() // zh / en

  function filter(sentences: Sentence[], f: Filters): Sentence[] {
    const activeLang = (locale.value === 'en' ? 'en' : 'zh') as 'zh' | 'en'

    return sentences.filter(s => {
      // —— 语言隐形筛选 —— //
      if (s.language !== activeLang) return false

      // —— 文本筛选（精确包含，不分大小写） —— //
      if (f.q && !includesIgnoreCase(s.text, f.q)) return false

      // —— 维度交集（未选=全选） —— //
      if (f.authors.length && !f.authors.includes(s.authorId)) return false
      if (f.books.length   && !f.books.includes(s.bookId))     return false
      if (f.genres.length  && !f.genres.every(id => s.genreIds.includes(id))) return false
      if (f.times.length   && !f.times.every(id => s.timeIds.includes(id)))   return false
      if (f.themes.length  && !f.themes.every(id => s.themeIds.includes(id))) return false
      if (f.devices.length && !f.devices.every(id => s.deviceIds.includes(id))) return false

      return true
    })
  }

  return { filter }
}