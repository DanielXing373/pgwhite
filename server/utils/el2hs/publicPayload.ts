import { COPY } from './copy'
import { NONE_LABEL_ZH, type Choice, type ExperimentalGroup, type SourceId } from './constants'
import type {
  AssignmentItem,
  InternalQuote,
  PublicQuestion,
  PublicSession,
  SessionRecord
} from './types'

const SOURCE_KEYS: Array<keyof AssignmentItem> = [
  'option_a_source',
  'option_b_source',
  'option_c_source',
  'option_d_source'
]

function themesFor(quote: InternalQuote, sourceId: SourceId) {
  return quote.sources[sourceId].themes.map(t => ({ label_zh: t.label_zh }))
}

/** Catalog author strings are inconsistent (only some carry a "[国籍]" prefix); display all without it. */
export function displayAuthorName(name: string | null): string | null {
  if (!name) return name
  return name.replace(/^\s*[\[［【(（][^\]］】)）]{1,8}[\]］】)）]\s*/, '')
}

export function publicQuestion(quote: InternalQuote, item: AssignmentItem): PublicQuestion {
  return {
    position: item.position,
    section: item.section,
    quote_id: item.quote_id,
    text_zh: quote.text_zh,
    author_name_zh: displayAuthorName(quote.attribution.author_name_zh),
    book_title_zh: quote.attribution.book_title_zh,
    options: [
      { key: 'A', themes: themesFor(quote, item.option_a_source) },
      { key: 'B', themes: themesFor(quote, item.option_b_source) },
      { key: 'C', themes: themesFor(quote, item.option_c_source) },
      { key: 'D', themes: themesFor(quote, item.option_d_source) }
    ],
    none_label_zh: NONE_LABEL_ZH
  }
}

export function sectionInstructions(group: ExperimentalGroup) {
  return {
    1: COPY.first_section,
    2: group === 'disclosure' ? COPY.second_section_disclosure : COPY.second_section_control
  }
}

export function sectionNotices(group: ExperimentalGroup) {
  return {
    1: null,
    2: group === 'disclosure' ? COPY.disclosure_notice : null
  }
}

export function toPublicSession(
  session: SessionRecord,
  quotesById: Map<string, InternalQuote>,
  answers: Partial<Record<number, Choice>>
): PublicSession {
  const questions = session.assignment.items.map(item => {
    const quote = quotesById.get(item.quote_id)
    if (!quote) throw new Error(`missing quote ${item.quote_id}`)
    return publicQuestion(quote, item)
  })
  return {
    study_mode: session.study_mode,
    experimental_group: session.experimental_group,
    completion_status: session.completion_status,
    dataset_version: session.dataset_version,
    protocol_version: session.protocol_version,
    section_instructions: sectionInstructions(session.experimental_group),
    section_notices: sectionNotices(session.experimental_group),
    answers,
    questions
  }
}

export function assertNoSourceLeak(value: unknown, label: string): void {
  const json = JSON.stringify(value)
  const banned = [
    'human-gold',
    'embedding-top2',
    'gpt-6-luna',
    'deepseek-flash',
    'source_id',
    'model_id',
    'run_id',
    'option_a_source',
    'assignment_json'
  ]
  for (const token of banned) {
    if (json.includes(token)) {
      throw new Error(`STOP: leaked ${token} in ${label}`)
    }
  }
}

export function assertNoPrivateKeys(obj: object): void {
  for (const key of SOURCE_KEYS) {
    if (key in obj) throw new Error(`STOP: leaked ${String(key)}`)
  }
}
