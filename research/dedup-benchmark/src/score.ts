// =====================================================
// Scoring + experimental (non-production) classification
// =====================================================

import { scorePair } from './similarity.ts'
import type {
  BenchmarkCase,
  ExperimentalLabel,
  ScoredCase
} from './types.ts'

/**
 * EXPERIMENTAL rule for research comparison only.
 * NOT a production threshold. Clearly labeled in outputs.
 *
 * Structural gates always win (precision-first).
 * Text scores are used only after Book+Chapter agree.
 */
export const EXPERIMENTAL_RULE_ID = 'exp_v0_research_only_2026-10-02'

export function applyStructuralGate(c: BenchmarkCase): boolean {
  if (c.candidate_book_id !== c.book_id) return false
  if (c.candidate_chapter !== c.chapter) return false
  return true
}

export function experimentalClassify(
  c: BenchmarkCase,
  features: ReturnType<typeof scorePair>
): { label: ExperimentalLabel; rule: string } {
  if (!applyStructuralGate(c)) {
    return {
      label: 'structurally_blocked',
      rule: `${EXPERIMENTAL_RULE_ID}: book/chapter gate`
    }
  }
  if (features.raw_exact || features.normalized_exact) {
    return {
      label: 'likely_duplicate',
      rule: `${EXPERIMENTAL_RULE_ID}: exact/normalized_exact`
    }
  }
  // Research-only bands — for distribution inspection, not product truth
  if (
    features.full_similarity >= 0.92 ||
    (features.partial_similarity >= 0.95 && features.length_ratio >= 0.55)
  ) {
    return {
      label: 'likely_duplicate',
      rule: `${EXPERIMENTAL_RULE_ID}: high full/partial band`
    }
  }
  if (
    features.full_similarity >= 0.8 ||
    (features.partial_similarity >= 0.9 && features.containment)
  ) {
    return {
      label: 'possible_duplicate',
      rule: `${EXPERIMENTAL_RULE_ID}: mid band / containment`
    }
  }
  return {
    label: 'likely_new',
    rule: `${EXPERIMENTAL_RULE_ID}: below mid band`
  }
}

export function scoreCase(c: BenchmarkCase): ScoredCase {
  const features = scorePair(c.canonical_text, c.candidate_text)
  const { label, rule } = experimentalClassify(c, features)
  return {
    ...c,
    ...features,
    experimental_prediction: label,
    experimental_rule: rule
  }
}

export function scoreAll(cases: BenchmarkCase[]): ScoredCase[] {
  return cases.map(scoreCase)
}
