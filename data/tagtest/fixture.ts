/**
 * `/tagtest` 的浅例句与假自动 tag。
 * 词表中英来自 data/times|themes|devices.json；人物默认空。
 */
import type { DimKey } from '~/composables/dimensions'
import { EMPTY_FACETS } from '~/composables/dimensions'
import timesRaw from '~/data/times.json'
import themesRaw from '~/data/themes.json'
import devicesRaw from '~/data/devices.json'
import { quoteTextHash } from '~/utils/tagHash'

export type TagtestStatus = 'raw' | 'preprocessed' | 'reviewed'
export type TagtestFlagReason = 'typo' | 'tag' | 'other'

export type TagtestSentence = {
  id: string
  text_zh: string
  text_en: string
  authorId: string
  bookId: string
  autoTags: Partial<Record<DimKey, string[]>>
}

type Named = { id: string; name_zh?: string; name_en?: string; emoji?: string }

function facetFromNamed(rows: Named[], lang: 'zh' | 'en') {
  return rows.map(r => ({
    id: r.id,
    label: String((lang === 'en' ? r.name_en : r.name_zh) || r.name_zh || r.name_en || r.id),
    emoji: r.emoji
  }))
}

export const TEST_AUTHOR = { id: 'a_test', label_zh: '测试作者', label_en: 'Test Author' }
export const TEST_BOOK = { id: 'b_test', label_zh: '《测试书》', label_en: 'Test Book' }

/** 词表：场景/主题/修辞沿用站点 JSON；人物默认空（测试书没有人物）。 */
export function tagtestCatalog(lang: 'zh' | 'en' = 'zh') {
  return {
    authors: [{ id: TEST_AUTHOR.id, label: lang === 'en' ? TEST_AUTHOR.label_en : TEST_AUTHOR.label_zh }],
    books: [{ id: TEST_BOOK.id, label: lang === 'en' ? TEST_BOOK.label_en : TEST_BOOK.label_zh }],
    characters: [...EMPTY_FACETS.characters],
    times: facetFromNamed(timesRaw as Named[], lang),
    themes: facetFromNamed(themesRaw as Named[], lang),
    devices: facetFromNamed(devicesRaw as Named[], lang)
  }
}

/**
 * 十句故意写得很浅，方便对照自动 tag 对错。
 * tt_03 / tt_04 去标点后 hash 相同。tt_02 主题故意打成「时间」。
 */
export const TAGTEST_SENTENCES: TagtestSentence[] = [
  {
    id: 'tt_01',
    text_zh: '太阳像一颗苹果。',
    text_en: 'The sun is like an apple.',
    authorId: TEST_AUTHOR.id,
    bookId: TEST_BOOK.id,
    autoTags: { devices: ['d_metaphor'] }
  },
  {
    id: 'tt_02',
    text_zh: '他哭了很久。',
    text_en: 'He cried for a long time.',
    authorId: TEST_AUTHOR.id,
    bookId: TEST_BOOK.id,
    autoTags: { themes: ['th_time'] }
  },
  {
    id: 'tt_03',
    text_zh: '风是一把刀。',
    text_en: 'The wind is a knife.',
    authorId: TEST_AUTHOR.id,
    bookId: TEST_BOOK.id,
    autoTags: { devices: ['d_metaphor'] }
  },
  {
    id: 'tt_04',
    text_zh: '风是一把刀！',
    text_en: 'The wind is a knife!',
    authorId: TEST_AUTHOR.id,
    bookId: TEST_BOOK.id,
    autoTags: { devices: ['d_metaphor'] }
  },
  {
    id: 'tt_05',
    text_zh: '今天天气很好。',
    text_en: 'The weather is nice today.',
    authorId: TEST_AUTHOR.id,
    bookId: TEST_BOOK.id,
    autoTags: {}
  },
  {
    id: 'tt_06',
    text_zh: '小明站在门口。',
    text_en: 'Xiaoming stood at the door.',
    authorId: TEST_AUTHOR.id,
    bookId: TEST_BOOK.id,
    autoTags: { times: ['t_noon'] }
  },
  {
    id: 'tt_07',
    text_zh: '夜色把小镇吞掉了。',
    text_en: 'Night swallowed the town.',
    authorId: TEST_AUTHOR.id,
    bookId: TEST_BOOK.id,
    autoTags: { times: ['t_night'], devices: ['d_personification'] }
  },
  {
    id: 'tt_08',
    text_zh: '太杨像一颗苹菓。',
    text_en: 'The sonn is like an aple.',
    authorId: TEST_AUTHOR.id,
    bookId: TEST_BOOK.id,
    autoTags: { devices: ['d_metaphor'] }
  },
  {
    id: 'tt_09',
    text_zh: '河水在笑。',
    text_en: 'The river is laughing.',
    authorId: TEST_AUTHOR.id,
    bookId: TEST_BOOK.id,
    autoTags: { devices: ['d_imagery'] }
  },
  {
    id: 'tt_10',
    text_zh: '雨点敲打窗户。',
    text_en: 'Raindrops tap the window.',
    authorId: TEST_AUTHOR.id,
    bookId: TEST_BOOK.id,
    autoTags: { devices: ['d_personification'] }
  }
]

export function tagtestDuplicateGroups(texts?: Record<string, string>): { hash: string; ids: string[] }[] {
  const map = new Map<string, string[]>()
  for (const s of TAGTEST_SENTENCES) {
    const text = texts?.[s.id] ?? s.text_zh
    const h = quoteTextHash(text)
    const list = map.get(h) ?? []
    list.push(s.id)
    map.set(h, list)
  }
  return [...map.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([hash, ids]) => ({ hash, ids }))
}
