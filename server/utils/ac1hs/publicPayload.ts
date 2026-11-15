import { COPY } from './copy'
import {
  DIMENSIONS,
  DIMENSION_LABEL_ZH,
  NONE_LABEL_ZH,
  SOURCE_IDS,
  type ExperimentalGroup
} from './constants'
import type {
  AssignmentItem,
  InternalQuote,
  PublicAnswer,
  PublicQuestion,
  PublicSession,
  SessionRecord
} from './types'

/** Catalog author strings are inconsistent (only some carry a "[国籍]" prefix); display all without it. */
export function displayAuthorName(name: string | null): string | null {
  if (!name) return name
  return name.replace(/^\s*[\[［【(（][^\]］】)）]{1,8}[\]］】)）]\s*/, '')
}

/**
 * Imported titles carry edition blurbs, e.g. 「局外人（译文经典）」 or 「…（同名电影原著）」.
 * Trailing bracketed notes are dropped for display; the frozen dataset keeps the original string.
 */
export function displayBookTitle(title: string | null): string | null {
  if (!title) return title
  let out = title
  for (;;) {
    const next = out.replace(/\s*[（(][^（()）]*[）)]\s*$/, '')
    if (next === out || !next) break
    out = next
  }
  return out
}

/** Tag names only, grouped by dimension in the frozen display order. Empty dimensions are omitted. */
export function publicQuestion(quote: InternalQuote, item: AssignmentItem): PublicQuestion {
  return {
    position: item.position,
    section: item.section,
    quote_id: item.quote_id,
    text_zh: quote.text_zh,
    author_name_zh: displayAuthorName(quote.attribution.author_name_zh),
    book_title_zh: displayBookTitle(quote.attribution.book_title_zh),
    groups: DIMENSIONS.map(dimension => ({
      dimension,
      label_zh: DIMENSION_LABEL_ZH[dimension],
      tags: quote.tags
        .filter(tag => tag.dimension === dimension)
        .map(tag => ({ tag_id: tag.tag_id, label_zh: tag.label_zh }))
    })).filter(group => group.tags.length > 0),
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
  answers: Partial<Record<number, PublicAnswer>>
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

/** Nothing that tells a participant which arm produced a tag may reach the browser. */
export function assertNoSourceLeak(value: unknown, label: string): void {
  const json = JSON.stringify(value)
  const banned = [...SOURCE_IDS, '"sources"', 'source_id', 'model_id', 'run_id', 'assignment_json', 'built_from']
  for (const token of banned) {
    if (json.includes(token)) {
      throw new Error(`STOP: leaked ${token} in ${label}`)
    }
  }
}
