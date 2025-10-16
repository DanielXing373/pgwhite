// =====================================================
// File: composables/useFilterEngine.ts
// 标题：过滤引擎（语言+文本预过滤；authors 为空=全局 AND；authors 非空=跨维度并集 OR）
// 说明：满足需求：选 JK+JRR 后再选"哈利波特"→ 返回 JK 全部 ∪ 哈利波特全部（示例数据下即 10 条）。
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
  const { locale } = useI18n()

  // —— 语言 + 文本 预过滤 —— //
  function prefilter(all: Sentence[], f: Filters): Sentence[] {
    const activeLang = (locale.value === 'en' ? 'en' : 'zh') as 'zh' | 'en'
    return all.filter(s => {
      if (s.language !== activeLang) return false
      if (f.q && !includesIgnoreCase(s.text, f.q)) return false
      return true
    })
  }

  // —— 旧逻辑：全局 AND（authors 为空时使用） —— //
  function globalAND(base: Sentence[], f: Filters): Sentence[] {
    return base.filter(s => {
      if (f.authors.length && !f.authors.includes(s.authorId)) return false
      if (f.books.length   && !f.books.includes(s.bookId))     return false
      if (f.genres.length  && !f.genres.every(id => s.genreIds.includes(id))) return false
      if (f.times.length   && !f.times.every(id => s.timeIds.includes(id)))   return false
      if (f.themes.length  && !f.themes.every(id => s.themeIds.includes(id))) return false
      if (f.devices.length && !f.devices.every(id => s.deviceIds.includes(id))) return false
      return true
    })
  }

  // —— 新逻辑：authors 非空 → 作者OR + 其他维度AND —— //
  function authorOR_othersAND(base: Sentence[], f: Filters): Sentence[] {
    // 先按作者筛选（OR逻辑）
    let authorFiltered = base
    if (f.authors.length) {
      const aSet = new Set(f.authors)
      authorFiltered = base.filter(s => aSet.has(s.authorId))
    }

    // 再按其他维度筛选（AND逻辑）
    return authorFiltered.filter(s => {
      if (f.books.length   && !f.books.includes(s.bookId))     return false
      if (f.genres.length  && !f.genres.every(id => s.genreIds.includes(id))) return false
      if (f.times.length   && !f.times.every(id => s.timeIds.includes(id)))   return false
      if (f.themes.length  && !f.themes.every(id => s.themeIds.includes(id))) return false
      if (f.devices.length && !f.devices.every(id => s.deviceIds.includes(id))) return false
      return true
    })
  }

  function filter(sentences: Sentence[], f: Filters): Sentence[] {
    const base = prefilter(sentences, f)
    if (!f.authors.length) {
      // 未选择作者 → 保持旧行为（全局 AND）
      return globalAND(base, f)
    }
    // 选择了作者 → 作者OR + 其他维度AND
    return authorOR_othersAND(base, f)
  }

  return { filter }
}