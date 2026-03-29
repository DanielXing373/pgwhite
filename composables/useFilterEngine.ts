// =====================================================
// File: composables/useFilterEngine.ts
// 标题：过滤引擎（语言+文本预过滤；authors 为空=作者/书/人物全局 AND；authors 非空=作者∪书∪人物 OR）
// 说明：选 JK+JRR 后再选《哈利波特》→ JK 全部 ∪ JRR 全部 ∪ 该书全部（与 GET /api/quotes 一致）。
// =====================================================
import type { Sentence } from './useDataset'

export type Filters = {
  q: string
  authors: string[]
  books: string[]
  characters: string[]
  times: string[]
  themes: string[]
  devices: string[]
  timesAll: boolean  // 场景时间是否使用 AND 逻辑
  themesAll: boolean // 主题是否使用 AND 逻辑
  devicesAll: boolean // 修辞手法是否使用 AND 逻辑
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
      if (f.characters.length  && !f.characters.some(id => s.characterIds.includes(id))) return false
      
      // 后三个维度根据复选框状态决定 AND/OR
      if (f.times.length) {
        if (f.timesAll) {
          // AND 逻辑：必须包含所有选中的标签
          if (!f.times.every(id => s.timeIds.includes(id))) return false
        } else {
          // OR 逻辑：包含任意一个即可
          if (!f.times.some(id => s.timeIds.includes(id))) return false
        }
      }
      
      if (f.themes.length) {
        if (f.themesAll) {
          if (!f.themes.every(id => s.themeIds.includes(id))) return false
        } else {
          if (!f.themes.some(id => s.themeIds.includes(id))) return false
        }
      }
      
      if (f.devices.length) {
        if (f.devicesAll) {
          if (!f.devices.every(id => s.deviceIds.includes(id))) return false
        } else {
          if (!f.devices.some(id => s.deviceIds.includes(id))) return false
        }
      }
      
      return true
    })
  }

  /** authors 非空：作者 / 书 / 人物 三者为 OR，再与 times/themes/devices AND */
  function authorUnion_entityOR_tagsAND(base: Sentence[], f: Filters): Sentence[] {
    return base.filter(s => {
      const entityParts: boolean[] = []
      if (f.authors.length) entityParts.push(f.authors.includes(s.authorId))
      if (f.books.length) entityParts.push(f.books.includes(s.bookId))
      if (f.characters.length) {
        entityParts.push(f.characters.some(id => s.characterIds.includes(id)))
      }
      if (entityParts.length && !entityParts.some(Boolean)) return false

      if (f.times.length) {
        if (f.timesAll) {
          if (!f.times.every(id => s.timeIds.includes(id))) return false
        } else {
          if (!f.times.some(id => s.timeIds.includes(id))) return false
        }
      }

      if (f.themes.length) {
        if (f.themesAll) {
          if (!f.themes.every(id => s.themeIds.includes(id))) return false
        } else {
          if (!f.themes.some(id => s.themeIds.includes(id))) return false
        }
      }

      if (f.devices.length) {
        if (f.devicesAll) {
          if (!f.devices.every(id => s.deviceIds.includes(id))) return false
        } else {
          if (!f.devices.some(id => s.deviceIds.includes(id))) return false
        }
      }

      return true
    })
  }

  function filter(sentences: Sentence[], f: Filters): Sentence[] {
    const base = prefilter(sentences, f)
    if (!f.authors.length) {
      return globalAND(base, f)
    }
    return authorUnion_entityOR_tagsAND(base, f)
  }

  return { filter }
}