export const DATASET_VERSION = 'ac1-hs-questions.v1'
export const PROTOCOL_VERSION = 'ac1-human-tag-review.protocol.v1'
export const RANDOMIZATION_VERSION = 'ac1-assignment.v1'
export const COPY_VERSION = 'ac1-hs-copy.v1'
/** SHA-256 of JSON.stringify(quotes) in dataset.generated.ts; also seeded into ac1_hs_protocol by migration 0008. */
export const INTERNAL_MASTER_CONTENT_SHA256 =
  '300a53ab8e3202c17bfe909d032bfd1f575751907047a3fb92431f8debc87f36'

/** Private ids of the three annotation arms. Never sent to a browser. */
export const SOURCE_IDS = ['deepseek-flash', 'gpt-6-luna-low', 'gpt-6-luna-medium'] as const

export type SourceId = (typeof SOURCE_IDS)[number]
export const DIMENSIONS = ['theme', 'rhetoric', 'technique'] as const
export type Dimension = (typeof DIMENSIONS)[number]
export const DIMENSION_LABEL_ZH: Record<Dimension, string> = {
  theme: '主题',
  rhetoric: '修辞',
  technique: '描写手法'
}
export type ExperimentalGroup = 'control' | 'disclosure'
export type StudyMode = 'study' | 'test'
export type CompletionStatus = 'in_progress' | 'completed' | 'abandoned'

export const NONE_LABEL_ZH = '都不合适'
export const INFLIGHT_TTL_MS = 24 * 60 * 60 * 1000
export const SESSION_COOKIE = 'ac1_hs_sid'
export const POOL_SIZE = 20
export const QUESTIONS_PER_PARTICIPANT = 10
export const QUESTIONS_PER_SECTION = 5
