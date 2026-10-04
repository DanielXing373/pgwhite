import type { EvalIssueFlag, OverallJudgement } from '../types.ts'

export const OVERALL_JUDGEMENTS: OverallJudgement[] = ['useful', 'okay', 'bad']

export const ISSUE_FLAGS: { id: EvalIssueFlag; labelZh: string }[] = [
  { id: 'missing_useful_tag', labelZh: '缺少有用标签' },
  { id: 'too_many_tags', labelZh: '标签过多' },
  { id: 'bad_interpretation', labelZh: '解读不当' },
  { id: 'wrong_rhetorical_device', labelZh: '修辞误判' },
  { id: 'bad_taxonomy_match', labelZh: 'taxonomy 匹配不当' },
  { id: 'good_new_concept', labelZh: '好的新 Personal 概念' }
]

/**
 * Reject is per-eval / per-run feedback — not a permanent blacklist.
 * A rejected concept may appear again in a later run_id.
 */
export type RejectNote = {
  quoteId: number
  conceptLabel: string
  runId: string
  /** Explicitly non-durable across product blacklist semantics. */
  ephemeral: true
}
