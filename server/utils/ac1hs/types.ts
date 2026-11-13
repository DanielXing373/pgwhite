import type {
  CompletionStatus,
  Dimension,
  ExperimentalGroup,
  SourceId,
  StudyMode
} from './constants'

/** One pooled tag of a quotation. `sources` is private: which arms produced it. */
export type InternalTag = {
  tag_id: string
  dimension: Dimension
  label_zh: string
  sources: SourceId[]
}

export type InternalQuote = {
  quote_id: string
  text_zh: string
  attribution: {
    author_name_zh: string | null
    book_title_zh: string | null
  }
  /** Display order: grouped by dimension, shuffled once at build time. */
  tags: InternalTag[]
}

export type InternalMaster = {
  schema_version: string
  dataset_version: string
  protocol_version: string
  freeze_status: string
  research_only: boolean
  note: string
  built_from: Record<string, unknown>
  source_ids: string[]
  content_sha256: string
  quotes: InternalQuote[]
}

export type AssignmentItem = {
  position: number
  section: 1 | 2
  quote_id: string
}

export type AssignmentJson = {
  algorithm_version: string
  group: ExperimentalGroup
  items: AssignmentItem[]
}

export type SessionRecord = {
  id: number
  session_public_id: string
  session_token_hash: string
  study_mode: StudyMode
  experimental_group: ExperimentalGroup
  protocol_version: string
  dataset_version: string
  randomization_version: string
  copy_version: string
  assignment: AssignmentJson
  consented: boolean
  consented_at: string | null
  completion_status: CompletionStatus
  created_at: string
  last_seen_at: string
  submitted_at: string | null
}

/**
 * One answered excerpt. Exactly one of the two holds:
 * `selected_tag_ids` is non-empty (the ticked tags; every other tag of the excerpt is "不合适"),
 * or `none_selected` is true (the participant chose 「都不合适」).
 */
export type ResponseRecord = {
  position: number
  quote_id: string
  selected_tag_ids: string[]
  none_selected: boolean
  answered_at: string
}

export type ExposureCounters = {
  group: Record<ExperimentalGroup, { completed: number; inflight: number }>
  quote: Record<
    string,
    {
      total: number
      byGroup: Record<ExperimentalGroup, number>
      bySection: Record<1 | 2, number>
    }
  >
}

/** Participants see tag names only; definitions and origins stay server-side. */
export type PublicTag = {
  tag_id: string
  label_zh: string
}

export type PublicTagGroup = {
  dimension: Dimension
  label_zh: string
  tags: PublicTag[]
}

export type PublicQuestion = {
  position: number
  section: 1 | 2
  quote_id: string
  text_zh: string
  author_name_zh: string | null
  book_title_zh: string | null
  groups: PublicTagGroup[]
  none_label_zh: string
}

export type PublicAnswer = {
  selected: string[]
  none: boolean
}

export type PublicSession = {
  study_mode: StudyMode
  experimental_group: ExperimentalGroup
  completion_status: CompletionStatus
  dataset_version: string
  protocol_version: string
  section_instructions: { 1: string; 2: string }
  section_notices: { 1: string | null; 2: string | null }
  answers: Partial<Record<number, PublicAnswer>>
  questions: PublicQuestion[]
}
