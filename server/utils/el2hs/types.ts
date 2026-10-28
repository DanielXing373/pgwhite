import type {
  Choice,
  CompletionStatus,
  ExperimentalGroup,
  SourceId,
  StudyMode
} from './constants'

/** Participants see Theme names only; definitions stay server-side. */
export type ThemeView = {
  label_zh: string
}

export type InternalSource = {
  source_id: SourceId
  selected_theme_ids: string[]
  themes: Array<{ theme_id: string; label_zh: string; definition_zh: string }>
  theme_count: number
}

export type InternalQuote = {
  quote_id: string
  text_zh: string
  attribution: {
    author_name_zh: string | null
    book_title_zh: string | null
    complete: boolean
  }
  sources: Record<SourceId, InternalSource>
}

export type InternalMaster = {
  dataset_version: string
  protocol_version: string
  freeze_status: string
  quotes: InternalQuote[]
}

export type AssignmentItem = {
  position: number
  section: 1 | 2
  quote_id: string
  option_a_source: SourceId
  option_b_source: SourceId
  option_c_source: SourceId
  option_d_source: SourceId
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

export type ResponseRecord = {
  position: number
  quote_id: string
  choice: Choice
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

export type PublicOption = {
  key: 'A' | 'B' | 'C' | 'D'
  themes: ThemeView[]
}

export type PublicQuestion = {
  position: number
  section: 1 | 2
  quote_id: string
  text_zh: string
  author_name_zh: string | null
  book_title_zh: string | null
  options: PublicOption[]
  none_label_zh: string
}

export type PublicSession = {
  study_mode: StudyMode
  experimental_group: ExperimentalGroup
  completion_status: CompletionStatus
  dataset_version: string
  protocol_version: string
  section_instructions: { 1: string; 2: string }
  section_notices: { 1: string | null; 2: string | null }
  answers: Partial<Record<number, Choice>>
  questions: PublicQuestion[]
}
