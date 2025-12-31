// =====================================================
// File: composables/useSearchResults.ts
// 标题：搜索结果排序和匹配计数
// 说明：计算匹配标签数量并排序搜索结果
// =====================================================
import type { Sentence } from './useDataset'
import type { Filters } from './useFilterEngine'

export function useSearchResults(
  filteredResults: Ref<Sentence[]>,
  filters: ComputedRef<Filters>
) {
  /**
   * 计算句子命中的标签数量
   */
  function countMatchedTags(sentence: Sentence): number {
    const f = filters.value
    let count = 0
    
    // 作者
    if (f.authors.length && f.authors.includes(sentence.authorId)) {
      count++
    }
    
    // 书籍
    if (f.books.length && f.books.includes(sentence.bookId)) {
      count++
    }
    
    // 人物（OR 逻辑：匹配数量）
    if (f.characters.length) {
      const matched = f.characters.filter(id => sentence.characterIds.includes(id)).length
      count += matched
    }
    
    // 场景时间
    if (f.times.length) {
      if (f.timesAll) {
        // AND 逻辑：全部匹配才算
        const allMatched = f.times.every(id => sentence.timeIds.includes(id))
        if (allMatched) count += f.times.length
      } else {
        // OR 逻辑：匹配数量
        const matched = f.times.filter(id => sentence.timeIds.includes(id)).length
        count += matched
      }
    }
    
    // 主题
    if (f.themes.length) {
      if (f.themesAll) {
        const allMatched = f.themes.every(id => sentence.themeIds.includes(id))
        if (allMatched) count += f.themes.length
      } else {
        const matched = f.themes.filter(id => sentence.themeIds.includes(id)).length
        count += matched
      }
    }
    
    // 修辞手法
    if (f.devices.length) {
      if (f.devicesAll) {
        const allMatched = f.devices.every(id => sentence.deviceIds.includes(id))
        if (allMatched) count += f.devices.length
      } else {
        const matched = f.devices.filter(id => sentence.deviceIds.includes(id)).length
        count += matched
      }
    }
    
    return count
  }

  /**
   * 按命中标签数量降序排序结果
   */
  const results = computed(() => {
    const sorted = [...filteredResults.value].map(s => ({
      sentence: s,
      matchCount: countMatchedTags(s)
    }))
    
    // 按命中数量降序排序
    sorted.sort((a, b) => b.matchCount - a.matchCount)
    
    return sorted.map(item => item.sentence)
  })

  return {
    results
  }
}

