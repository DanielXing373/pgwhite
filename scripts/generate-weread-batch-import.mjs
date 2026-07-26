#!/usr/bin/env node
/**
 * 按用户选定书单生成 pgwhite_weread_import.sql（仅划线，无想法）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'pgwhite_weread_import.sql')
const GATEWAY = 'https://i.weread.qq.com/api/agent/gateway'
const SKILL_VERSION = '1.0.3'

/** 用户选择 #1,3,4,5,7,8,12,13,15,16,23,30,32,39,40 */
const BATCH = [
  {
    pick: 1,
    bookId: '24953413',
    authorZh: '伊塔洛·卡尔维诺',
    authorEn: 'Italo Calvino',
    emoji: '🇮🇹',
    titleZh: '如果在冬夜，一个旅人',
    titleEn: "If on a Winter's Night a Traveler",
    reuseAuthorId: null
  },
  {
    pick: 3,
    bookId: '25561821',
    authorZh: '乔叟',
    authorEn: 'Geoffrey Chaucer',
    emoji: '🇬🇧',
    titleZh: '坎特伯雷故事（译文名著典藏）',
    titleEn: 'The Canterbury Tales',
    reuseAuthorId: null
  },
  {
    pick: 4,
    bookId: '3300154232',
    authorZh: '陀思妥耶夫斯基',
    authorEn: 'Fyodor Dostoevsky',
    emoji: '🇷🇺',
    titleZh: '地下室手记（经典译本无删减）',
    titleEn: 'Notes from Underground',
    reuseAuthorId: null
  },
  {
    pick: 5,
    bookId: '32880022',
    authorZh: '亨利克·显克维奇',
    authorEn: 'Henryk Sienkiewicz',
    emoji: '🇵🇱',
    titleZh: '你往何处去',
    titleEn: 'Quo Vadis',
    reuseAuthorId: null,
    authorKey: 'sienkiewicz'
  },
  {
    pick: 7,
    bookId: '926346',
    authorZh: '丹·西蒙斯',
    authorEn: 'Dan Simmons',
    emoji: '🇺🇸',
    titleZh: '海伯利安四部曲',
    titleEn: 'Hyperion Cantos',
    reuseAuthorId: null
  },
  {
    pick: 8,
    bookId: '3300044710',
    authorZh: '亨利·戴维·梭罗',
    authorEn: 'Henry David Thoreau',
    emoji: '🇺🇸',
    titleZh: '瓦尔登湖',
    titleEn: 'Walden',
    reuseAuthorId: null
  },
  {
    pick: 12,
    bookId: '32219280',
    authorZh: '石黑一雄',
    authorEn: 'Kazuo Ishiguro',
    emoji: '🇬🇧',
    titleZh: '长日将尽（译文经典）',
    titleEn: 'The Remains of the Day',
    reuseAuthorId: 1
  },
  {
    pick: 13,
    bookId: '3300047438',
    authorZh: '阿尔贝·加缪',
    authorEn: 'Albert Camus',
    emoji: '🇫🇷',
    titleZh: '局外人（译文经典）',
    titleEn: 'The Stranger',
    reuseAuthorId: null
  },
  {
    pick: 15,
    bookId: '26991921',
    authorZh: '特德·姜',
    authorEn: 'Ted Chiang',
    emoji: '🇺🇸',
    titleZh: '你一生的故事（译林幻系列）',
    titleEn: 'Stories of Your Life and Others',
    reuseAuthorId: null
  },
  {
    pick: 16,
    bookId: '23523072',
    authorZh: '钱穆',
    authorEn: 'Qian Mu',
    emoji: '🇨🇳',
    titleZh: '中国历代政治得失',
    titleEn: 'Chinese Political History Through the Ages',
    reuseAuthorId: null
  },
  {
    pick: 23,
    bookId: '3300115431',
    authorZh: '刘亮程',
    authorEn: 'Liu Liangcheng',
    emoji: '🇨🇳',
    titleZh: '本巴（第十一届茅盾文学奖获奖作品）',
    titleEn: 'Benba',
    reuseAuthorId: null
  },
  {
    pick: 30,
    bookId: '3300058976',
    authorZh: '约恩·卡尔曼·斯特凡松',
    authorEn: 'Jón Kalman Stefánsson',
    emoji: '🇮🇸',
    titleZh: '冰岛往事.1，狂暴海',
    titleEn: 'About the Night and About the Children of the Night',
    reuseAuthorId: null
  },
  {
    pick: 32,
    bookId: '3300021172',
    authorZh: '亨利克·显克维奇',
    authorEn: 'Henryk Sienkiewicz',
    emoji: '🇵🇱',
    titleZh: '显克维奇中短篇小说选（人文社外国文学名著经典·网格本）',
    titleEn: 'Selected Short Stories',
    reuseAuthorId: null,
    authorKey: 'sienkiewicz'
  },
  {
    pick: 39,
    bookId: '814146',
    authorZh: '弗雷德里克·巴克曼',
    authorEn: 'Fredrik Backman',
    emoji: '🇸🇪',
    titleZh: '一个叫欧维的男人决定去死（同名电影原著）',
    titleEn: 'A Man Called Ove',
    reuseAuthorId: null
  },
  {
    pick: 40,
    bookId: '3300052230',
    authorZh: '赫尔曼·黑塞',
    authorEn: 'Hermann Hesse',
    emoji: '🇩🇪',
    titleZh: '荒原狼（果麦经典）',
    titleEn: 'Steppenwolf',
    reuseAuthorId: 2
  }
]

const START_AUTHOR_ID = 5
const START_BOOK_ID = 5
const START_QUOTE_ID = 119

function loadWereadKey() {
  if (process.env.WEREAD_API_KEY?.trim()) return process.env.WEREAD_API_KEY.trim()
  const env = readFileSync(resolve(ROOT, '.env'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^WEREAD_API_KEY=(.+)$/)
    if (m) return m[1].trim()
  }
  throw new Error('缺少 WEREAD_API_KEY')
}

function sqlEscape(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchHighlights(key, bookId) {
  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_name: '/book/bookmarklist',
      bookId,
      skill_version: SKILL_VERSION
    })
  })
  const data = await res.json()
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`bookmarklist ${bookId}: ${data.errmsg}`)
  }
  return (data.updated || [])
    .map(u => (u.markText || '').trim())
    .filter(Boolean)
}

async function main() {
  const key = loadWereadKey()
  const lines = []

  lines.push('-- =====================================================')
  lines.push('-- pgwhite_weread_import.sql')
  lines.push('-- 批次: 2026-07-26 微信读书划线导入')
  lines.push('--')
  lines.push('-- 【本次选择】用户编号: 1,3,4,5,7,8,12,13,15,16,23,30,32,39,40')
  lines.push('-- 【内容范围】仅划线 markText；不包含想法/点评 review、不包含书签 bookmark')
  lines.push('-- 【quote 形态】每条仅 quote_translations.zh；暂不写 en 译文')
  lines.push('-- 【tag 策略】仅通过 book_id 关联作者+书名；不写入 quote_characters / quote_tags')
  lines.push('-- 【前端约定】无二级 tag 的 quote 卡片只显示作者+书名（见 useSentenceTags hasSecondaryTags）')
  lines.push('-- 【作者复用】石黑一雄→authors.id=1；黑塞→authors.id=2；其余作者从 id=5 起新建')
  lines.push('-- 【执行前】确认 MAX(quotes.id) < 119 或调整下方 START_QUOTE_ID')
  lines.push('-- =====================================================')
  lines.push('')
  lines.push('USE pgwhite;')
  lines.push('')

  let nextAuthorId = START_AUTHOR_ID
  let nextBookId = START_BOOK_ID
  let quoteId = START_QUOTE_ID
  let totalQuotes = 0
  const authorKeyToId = new Map()

  const pickList = BATCH.map(b => `#${b.pick}`).join(', ')
  lines.push(`-- --- 本文件共 ${BATCH.length} 本书 · 选择 ${pickList} ---`)
  lines.push('')

  for (const item of BATCH) {
    const texts = await fetchHighlights(key, item.bookId)
    let authorId = item.reuseAuthorId

    if (authorId == null) {
      const keyName = item.authorKey || item.authorZh
      if (authorKeyToId.has(keyName)) {
        authorId = authorKeyToId.get(keyName)
      } else {
        authorId = nextAuthorId++
        authorKeyToId.set(keyName, authorId)
        lines.push(`-- 新建作者 pick #${item.pick} · ${item.authorZh}`)
        lines.push(`INSERT INTO authors (id, emoji) VALUES (${authorId}, '${item.emoji}');`)
        lines.push(
          `INSERT INTO author_translations (author_id, language_code, name) VALUES (${authorId}, 'zh', '${sqlEscape(item.authorZh)}'), (${authorId}, 'en', '${sqlEscape(item.authorEn)}');`
        )
      }
    } else {
      lines.push(`-- 复用已有作者 id=${authorId} · ${item.authorZh}`)
    }

    const bookId = nextBookId++
    lines.push(`-- pick #${item.pick} · weread bookId=${item.bookId} · ${item.titleZh} · ${texts.length} 条划线`)
    lines.push(`INSERT INTO books (id, author_id, emoji) VALUES (${bookId}, ${authorId}, '📚');`)
    lines.push(
      `INSERT INTO book_translations (book_id, language_code, title) VALUES (${bookId}, 'zh', '${sqlEscape(item.titleZh)}'), (${bookId}, 'en', '${sqlEscape(item.titleEn)}');`
    )
    lines.push('')

    for (const text of texts) {
      lines.push(`INSERT INTO quotes (id, book_id) VALUES (${quoteId}, ${bookId});`)
      lines.push(
        `INSERT INTO quote_translations (quote_id, language_code, content) VALUES (${quoteId}, 'zh', '${sqlEscape(text)}');`
      )
      quoteId++
      totalQuotes++
    }
    lines.push('')
  }

  lines.push(`-- 合计: ${BATCH.length} 本书, ${totalQuotes} 条 quote (id ${START_QUOTE_ID}–${quoteId - 1})`)
  lines.push('SELECT COUNT(*) AS quotes_total FROM quotes;')

  writeFileSync(OUT, lines.join('\n') + '\n', 'utf8')
  console.log(`Wrote ${OUT}: ${totalQuotes} quotes from ${BATCH.length} books`)
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
