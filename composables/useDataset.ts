// =====================================================
// File: composables/useDataset.ts
// 标题：数据集加载与索引（统一出口）
// 用途：一次性加载 data/*.json，并提供按 ID 查名称的 Map
// 备注：以后切数据库/API，只需改这里
// =====================================================
import sentencesRaw from '~/data/sentences.json'
import authorsRaw from '~/data/authors.json'
import booksRaw from '~/data/books.json'
import genresRaw from '~/data/genres.json'
import timesRaw from '~/data/times.json'
import themesRaw from '~/data/themes.json'
import devicesRaw from '~/data/devices.json'

export type Sentence = {
  id: string
  text: string
  language: 'zh' | 'en'
  authorId: string
  bookId: string
  chapter?: string
  genreIds: string[]
  timeIds: string[]
  themeIds: string[]
  deviceIds: string[]
}

export type Named = { id: string; name_zh?: string; name_en?: string; title_zh?: string; title_en?: string; authorId?: string; emoji?: string }

export function useDataset() {
  // —— 原始数组 —— //
  const sentences = sentencesRaw as Sentence[]
  const authors = authorsRaw as Named[]
  const books = booksRaw as Named[]
  const genres = genresRaw as Named[]
  const times = timesRaw as Named[]
  const themes = themesRaw as Named[]
  const devices = devicesRaw as Named[]

  // —— Map 加速查找 —— //
  const authorById = new Map(authors.map(a => [a.id, a]))
  const bookById = new Map(books.map(b => [b.id, b]))
  const genreById = new Map(genres.map(g => [g.id, g]))
  const timeById = new Map(times.map(t => [t.id, t]))
  const themeById = new Map(themes.map(t => [t.id, t]))
  const deviceById = new Map(devices.map(d => [d.id, d]))

  return {
    sentences,
    authors, books, genres, times, themes, devices,
    authorById, bookById, genreById, timeById, themeById, deviceById
  }
}