export const DATASET_VERSION = 'el2-hs-questions.v1'
export const PROTOCOL_VERSION = 'el2-human-preference.protocol.v1'
export const RANDOMIZATION_VERSION = 'el2-assignment.v1'
export const COPY_VERSION = 'el2-hs-copy.v3'
export const INTERNAL_MASTER_SHA256 =
  '1e3b6d1f61974de3f8d24600fe7b51f5e3f53dd9c734d89c2ba725713fc2a4d8'
export const INTERNAL_MASTER_REL =
  'research/retrieval/formal-study/el2/human-study/datasets/el2-hs-questions.internal.v1.json'
export const MANIFEST_REL =
  'research/retrieval/formal-study/el2/human-study/DATASET-MANIFEST.json'

export const SOURCE_IDS = [
  'human-gold',
  'embedding-top2',
  'gpt-6-luna',
  'deepseek-flash'
] as const

export type SourceId = (typeof SOURCE_IDS)[number]
export type Choice = 'A' | 'B' | 'C' | 'D' | 'E'
export type ExperimentalGroup = 'control' | 'disclosure'
export type StudyMode = 'study' | 'test'
export type CompletionStatus = 'in_progress' | 'completed' | 'abandoned'

export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const
export const NONE_LABEL_ZH = '都不满意'
export const INFLIGHT_TTL_MS = 24 * 60 * 60 * 1000
export const SESSION_COOKIE = 'el2_hs_sid'
export const QUESTIONS_PER_PARTICIPANT = 10
export const QUESTIONS_PER_SECTION = 5
