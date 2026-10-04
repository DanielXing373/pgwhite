import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FixtureQuote } from '../types.ts'

export const SUPPORTED_PROMPT_VERSIONS = [
  'zh-literary-rich-v1',
  'zh-literary-rich-v1.1',
  'zh-literary-atomic-v1.2'
] as const

export type PromptVersion = (typeof SUPPORTED_PROMPT_VERSIONS)[number]

const DEFAULT_PROMPT_VERSION: PromptVersion = 'zh-literary-rich-v1'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROMPTS_DIR = path.resolve(__dirname, '../../prompts')

export function getPromptVersion(version?: string): PromptVersion {
  const v = (version || DEFAULT_PROMPT_VERSION) as PromptVersion
  if (!SUPPORTED_PROMPT_VERSIONS.includes(v)) {
    throw new Error(`Unsupported prompt version: ${version}`)
  }
  return v
}

export function loadPromptDocument(version?: string): string {
  const v = getPromptVersion(version)
  const p = path.join(PROMPTS_DIR, `${v}.md`)
  if (!fs.existsSync(p)) throw new Error(`Prompt file missing: ${p}`)
  return fs.readFileSync(p, 'utf8')
}

/** Extract system message block from the markdown prompt doc. */
export function getSystemMessage(version?: string): string {
  const v = getPromptVersion(version)
  const doc = loadPromptDocument(v)
  const m = doc.match(/## System message\n\n([\s\S]*?)\n\n---/)
  if (!m) throw new Error(`${v}: system message block not found`)
  return m[1]!.trim()
}

export function buildUserMessage(q: FixtureQuote, version?: string): string {
  const v = getPromptVersion(version)
  const ann = q.personalAnnotation?.content?.trim()
  const reuseLine =
    v === 'zh-literary-rich-v1.1'
      ? '- 概念优先可跨引文复用；避免把本条引文的具体情节改写成专用标签'
      : v === 'zh-literary-atomic-v1.2'
        ? '- label 必须是可跨引文复用的原子检索单元，不是本条引文摘要'
        : null
  const atomicExtra =
    v === 'zh-literary-atomic-v1.2'
      ? [
          '- 复合解读请拆成独立有意义的成分；不要输出“童年回忆 / 音乐唤醒记忆”这类复合标签',
          '- 稳定语义单元（如身份认同、情感寄托）不必机械拆分'
        ]
      : []
  return [
    v === 'zh-literary-atomic-v1.2'
      ? '请为下面这条中文文学引文提出可复用的原子检索标签（Theme / Device）。'
      : '请为下面这条中文文学引文提出自由文学概念，用于个人检索研究。',
    '',
    '【来源】',
    `书名：${q.bookTitleZh || '未知'}`,
    `作者：${q.authorNameZh || '未知'}`,
    `章节：${q.chapterTitle || '未知'}`,
    '',
    '【引文】',
    q.textZh,
    '',
    '【个人批注】',
    ann && ann.length ? ann : '（无）',
    '',
    '要求：',
    '- 分别给出 theme 与 device 概念列表',
    '- 每个概念包含 label（简短中文）与 brief_rationale（一句中文理由）',
    ...(reuseLine ? [reuseLine] : []),
    ...atomicExtra,
    '- 若存在个人批注，填写 annotation_interpretation；若无批注，annotation_interpretation 设为 null',
    '- annotation_interpretation 只需解释批注如何作为证据，不要回传批注原文',
    '- 严格输出 JSON，键名使用 schema 中的英文字段名'
  ].join('\n')
}

/**
 * Critical invariant: free-concept prompts must never include taxonomy labels.
 */
export function assertPromptHasNoTaxonomyLeak(userMessage: string): void {
  if (
    /canonical taxonomy|标签词表|请从下列标签|source_code|tag_id\s*=/i.test(userMessage)
  ) {
    throw new Error('Prompt taxonomy leak detected')
  }
}
