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

/** 卡片精简展示：仅作者 + 书名（用于尚未标注人物/标签维度的新导入 quote） */
const CARD_TAG_DIMENSIONS = new Set(['authors', 'books'])

function cardTagsOnly(tags: SentenceTag[]): SentenceTag[] {
  return tags.filter(t => CARD_TAG_DIMENSIONS.has(t.dimension))
}

/** 是否已有人物或任一类 tag；有则卡片展示全部 tag，无则只展示作者、书名 */
function hasSecondaryTags(sentence: Sentence): boolean {
  return (
    sentence.characterIds.length > 0 ||
    sentence.timeIds.length > 0 ||
    sentence.themeIds.length > 0 ||
    sentence.deviceIds.length > 0
  )
}

export function useSentenceTags(filters: ComputedRef<Filters>) {
  const {
    authorById, bookById, characterById, timeById, themeById, deviceById
  } = useDataset()
  const { locale } = useI18n()

  /**
   * 格式化书名：中文直接返回原文；英文在 CSS 中加斜体
   */
  function formatBookTitle(title: string, _isEN: boolean): string {
    return title
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
      case 'characters':
        return f.characters.includes(tagId)
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
   * 获取句子的所有标签（按顺序：作者、书籍、人物、场景时间、主题、修辞手法）
   */
  function getSentenceTags(sentence: Sentence): SentenceTag[] {
    const tags: SentenceTag[] = []
    const isEN = locale.value === 'en'

    // —— 服务端已带 display（数据库翻译）时，不再用本地 JSON —— //
    const d = sentence.display
    if (d) {
      if (d.author) {
        tags.push({
          id: d.author.id,
          label: prependEmoji(d.author.emoji ?? undefined, d.author.name),
          isMatched: isTagMatched('authors', d.author.id),
          dimension: 'authors'
        })
      }
      if (d.book) {
        const rawTitle = d.book.title
        const formattedTitle = formatBookTitle(rawTitle, isEN)
        tags.push({
          id: d.book.id,
          label: prependEmoji(d.book.emoji ?? undefined, formattedTitle),
          isBook: true,
          isMatched: isTagMatched('books', d.book.id),
          dimension: 'books'
        })
      }
      for (const c of d.characters ?? []) {
        tags.push({
          id: c.id,
          label: prependEmoji(c.emoji ?? undefined, c.name),
          isMatched: isTagMatched('characters', c.id),
          dimension: 'characters'
        })
      }
      for (const t of d.sceneTimes ?? []) {
        tags.push({
          id: t.id,
          label: prependEmoji(t.emoji ?? undefined, t.name),
          isMatched: isTagMatched('times', t.id),
          dimension: 'times'
        })
      }
      for (const t of d.themes ?? []) {
        tags.push({
          id: t.id,
          label: prependEmoji(t.emoji ?? undefined, t.name),
          isMatched: isTagMatched('themes', t.id),
          dimension: 'themes'
        })
      }
      for (const t of d.devices ?? []) {
        tags.push({
          id: t.id,
          label: prependEmoji(t.emoji ?? undefined, t.name),
          isMatched: isTagMatched('devices', t.id),
          dimension: 'devices'
        })
      }
      return hasSecondaryTags(sentence) ? tags : cardTagsOnly(tags)
    }

    // 1. 作者（本地 prototype 数据）
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

    // 3. 人物
    sentence.characterIds.forEach(id => {
      const character = characterById.get(id)
      if (character) {
        const baseLabel = isEN ? (character.name_en || character.name_zh || id) : (character.name_zh || character.name_en || id)
        tags.push({
          id,
          label: prependEmoji(character.emoji, baseLabel),
          isMatched: isTagMatched('characters', id),
          dimension: 'characters'
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

    return hasSecondaryTags(sentence) ? tags : cardTagsOnly(tags)
  }

  return {
    getSentenceTags
  }
}

