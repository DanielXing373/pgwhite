// =====================================================
// File: composables/useDataset.ts
// 标题：数据集加载与索引（统一出口）
// 用途：一次性加载 data/*.json，并提供按 ID 查名称的 Map
// 备注：以后切数据库/API，只需改这里
// =====================================================
import sentencesRaw from '~/data/sentences.json'
import authorsRaw from '~/data/authors.json'
import booksRaw from '~/data/books.json'
import charactersRaw from '~/data/characters.json'
import timesRaw from '~/data/times.json'
import themesRaw from '~/data/themes.json'
import devicesRaw from '~/data/devices.json'

/** 后端 /api/quotes 返回的展示块（与 DB 翻译一致，不依赖 data/*.json） */
export type QuoteDisplay = {
  author?: { id: string; name: string; emoji?: string | null }
  book?: { id: string; title: string; emoji?: string | null }
  characters?: { id: string; name: string; emoji?: string | null }[]
  sceneTimes?: { id: string; name: string; emoji?: string | null }[]
  themes?: { id: string; name: string; emoji?: string | null }[]
  devices?: { id: string; name: string; emoji?: string | null }[]
}

export type Sentence = {
  id: string
  text: string
  language: 'zh' | 'en'
  authorId: string
  bookId: string
  chapter?: string
  characterIds: string[]
  timeIds: string[]
  themeIds: string[]
  deviceIds: string[]
  /** 存在时优先用于卡片标签展示（服务端已按请求语言填好文案） */
  display?: QuoteDisplay
}

export type Named = { id: string; name_zh?: string; name_en?: string; title_zh?: string; title_en?: string; authorId?: string; emoji?: string }

export function useDataset() {
  // —— 原始数组 —— //
  const sentences = sentencesRaw as Sentence[]
  const authors = authorsRaw as Named[]
  const books = booksRaw as Named[]
  const characters = charactersRaw as Named[]
  const times = timesRaw as Named[]
  const themes = themesRaw as Named[]
  const devices = devicesRaw as Named[]

  // —— Map 加速查找 —— //
  const authorById = new Map(authors.map(a => [a.id, a]))
  const bookById = new Map(books.map(b => [b.id, b]))
  const characterById = new Map(characters.map(c => [c.id, c]))
  const timeById = new Map(times.map(t => [t.id, t]))
  const themeById = new Map(themes.map(t => [t.id, t]))
  const deviceById = new Map(devices.map(d => [d.id, d]))

  return {
    sentences,
    authors, books, characters, times, themes, devices,
    authorById, bookById, characterById, timeById, themeById, deviceById
  }
}