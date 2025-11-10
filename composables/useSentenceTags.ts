// =====================================================
// File: composables/useSentenceTags.ts
// 标题：句子标签处理
// 说明：处理句子标签的显示、匹配状态和格式化
// =====================================================
import { useDataset, type Sentence } from './useDataset'
import type { Filters } from './useFilterEngine'
import { prependEmoji } from './useUIHelpers'

export type SentenceTag = {
  id: string
  label: string
  isBook?: boolean
  isMatched?: boolean
  dimension: string
}

export function useSentenceTags(filters: ComputedRef<Filters>) {
  const {
    authorById, bookById, genreById, timeById, themeById, deviceById
  } = useDataset()
  const { locale } = useI18n()

  /**
   * 格式化书名：中文加书名号，英文返回原文本（在 CSS 中处理斜体）
   */
  function formatBookTitle(title: string, isEN: boolean): string {
    if (isEN) {
      return title // 英文：返回原文本，通过 CSS class 设置斜体
    } else {
      return `《${title}》` // 中文：加书名号
    }
  }

  /**
   * 检查标签是否被选中（匹配搜索条件）
   */
  function isTagMatched(dimension: string, tagId: string): boolean {
    const f = filters.value
    switch (dimension) {
      case 'authors':
        return f.authors.includes(tagId)
      case 'books':
        return f.books.includes(tagId)
      case 'genres':
        return f.genres.includes(tagId)
      case 'times':
        if (!f.times.length) return false
        return f.times.includes(tagId)
      case 'themes':
        if (!f.themes.length) return false
        return f.themes.includes(tagId)
      case 'devices':
        if (!f.devices.length) return false
        return f.devices.includes(tagId)
      default:
        return false
    }
  }

  /**
   * 获取句子的所有标签（按顺序：作者、书籍、题材、场景时间、主题、修辞手法）
   */
  function getSentenceTags(sentence: Sentence): SentenceTag[] {
    const tags: SentenceTag[] = []
    const isEN = locale.value === 'en'

    // 1. 作者
    const author = authorById.get(sentence.authorId)
    if (author) {
      const baseLabel = isEN ? (author.name_en || author.name_zh || sentence.authorId) : (author.name_zh || author.name_en || sentence.authorId)
      tags.push({
        id: sentence.authorId,
        label: prependEmoji(author.emoji, baseLabel),
        isMatched: isTagMatched('authors', sentence.authorId),
        dimension: 'authors'
      })
    }

    // 2. 书籍（格式化书名）
    const book = bookById.get(sentence.bookId)
    if (book) {
      const rawTitle = isEN ? (book.title_en || book.title_zh || sentence.bookId) : (book.title_zh || book.title_en || sentence.bookId)
      const formattedTitle = formatBookTitle(rawTitle, isEN)
      tags.push({
        id: sentence.bookId,
        label: prependEmoji(book.emoji, formattedTitle),
        isBook: true, // 标记这是书名，用于应用斜体样式
        isMatched: isTagMatched('books', sentence.bookId),
        dimension: 'books'
      })
    }

    // 3. 题材
    sentence.genreIds.forEach(id => {
      const genre = genreById.get(id)
      if (genre) {
        const baseLabel = isEN ? (genre.name_en || genre.name_zh || id) : (genre.name_zh || genre.name_en || id)
        tags.push({
          id,
          label: prependEmoji(genre.emoji, baseLabel),
          isMatched: isTagMatched('genres', id),
          dimension: 'genres'
        })
      }
    })

    // 4. 场景时间
    sentence.timeIds.forEach(id => {
      const time = timeById.get(id)
      if (time) {
        const baseLabel = isEN ? (time.name_en || time.name_zh || id) : (time.name_zh || time.name_en || id)
        tags.push({
          id,
          label: prependEmoji(time.emoji, baseLabel),
          isMatched: isTagMatched('times', id),
          dimension: 'times'
        })
      }
    })

    // 5. 主题
    sentence.themeIds.forEach(id => {
      const theme = themeById.get(id)
      if (theme) {
        const baseLabel = isEN ? (theme.name_en || theme.name_zh || id) : (theme.name_zh || theme.name_en || id)
        tags.push({
          id,
          label: prependEmoji(theme.emoji, baseLabel),
          isMatched: isTagMatched('themes', id),
          dimension: 'themes'
        })
      }
    })

    // 6. 修辞手法
    sentence.deviceIds.forEach(id => {
      const device = deviceById.get(id)
      if (device) {
        const baseLabel = isEN ? (device.name_en || device.name_zh || id) : (device.name_zh || device.name_en || id)
        tags.push({
          id,
          label: prependEmoji(device.emoji, baseLabel),
          isMatched: isTagMatched('devices', id),
          dimension: 'devices'
        })
      }
    })

    return tags
  }

  return {
    getSentenceTags
  }
}

