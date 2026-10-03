// =====================================================
// Canonical matcher v1 — relationship decision only
// NEVER merges, deletes, overwrites, or publishes.
// =====================================================

import { matchingNormalize } from './normalize'
import { scorePair } from './similarity'
import type {
  MatchDecision,
  QuoteCandidate,
  ScoreFeatures
} from './types'
import { MATCHER_VERSION } from './types'

export function chapterAllowsMatch(
  sourceChapterUid: string | null | undefined,
  targetChapterUid: string | null | undefined
): boolean {
  const a = sourceChapterUid != null && String(sourceChapterUid).length
    ? String(sourceChapterUid)
    : null
  const b = targetChapterUid != null && String(targetChapterUid).length
    ? String(targetChapterUid)
    : null
  // Block only when both sides have explicit source chapter ids and they differ.
  if (a && b && a !== b) return false
  return true
}

function isPossibleBand(f: ScoreFeatures, sourceText: string, targetText: string): boolean {
  const shorterLen = Math.min(
    matchingNormalize(sourceText).length,
    matchingNormalize(targetText).length
  )
  // Containment / boundary — POSSIBLE only (never auto-MATCHED).
  // length_ratio may be low when selection boundaries differ; require non-trivial shorter side.
  if (
    f.containment &&
    f.partial_similarity >= 0.92 &&
    shorterLen >= 4
  ) {
    return true
  }
  // Near-exact residual noise — still POSSIBLE, never MATCHED (negation/entity FPs).
  if (
    f.full_similarity >= 0.97 &&
    f.partial_similarity >= 0.97 &&
    f.length_ratio >= 0.95 &&
    !f.normalized_exact
  ) {
    return true
  }
  return false
}

/**
 * Decide match relations for one Personal Quote against Community candidates.
 * Assumes candidates are already filtered to the same book where required.
 */
export function decideCanonicalMatch(input: {
  sourceText: string
  sourceBookId: number
  sourceChapterUid: string | null
  communityCandidates: QuoteCandidate[]
}): MatchDecision {
  const sourceNorm = matchingNormalize(input.sourceText)
  const relations: MatchDecision['relations'] = []

  for (const c of input.communityCandidates) {
    if (c.bookId !== input.sourceBookId) continue
    if (c.corpusLayer !== 'community') continue
    if (!chapterAllowsMatch(input.sourceChapterUid, c.sourceChapterUid)) continue

    const features = scorePair(input.sourceText, c.content)
    const targetNorm = matchingNormalize(c.content)

    if (sourceNorm.length > 0 && sourceNorm === targetNorm) {
      relations.push({
        targetQuoteId: c.quoteId,
        relationStatus: 'matched',
        publicationEligibility: 'personal_only',
        features,
        matcherRule: 'normalized_exact_same_book_chapter_gate'
      })
      continue
    }

    if (isPossibleBand(features, input.sourceText, c.content)) {
      relations.push({
        targetQuoteId: c.quoteId,
        relationStatus: 'possible_match',
        publicationEligibility: 'publication_unresolved',
        features,
        matcherRule: features.containment
          ? 'possible_containment_band'
          : 'possible_near_exact_band'
      })
    }
  }

  // Prefer matched over possible; keep top possibles by score.
  const matched = relations.filter((r) => r.relationStatus === 'matched')
  if (matched.length) {
    return {
      status: 'matched',
      publicationEligibility: 'personal_only',
      relations: matched,
      matcherVersion: MATCHER_VERSION
    }
  }

  const possibles = relations
    .filter((r) => r.relationStatus === 'possible_match')
    .sort(
      (a, b) =>
        Math.max(b.features.full_similarity, b.features.partial_similarity) -
        Math.max(a.features.full_similarity, a.features.partial_similarity)
    )
    .slice(0, 3)

  if (possibles.length) {
    return {
      status: 'possible_match',
      publicationEligibility: 'publication_unresolved',
      relations: possibles,
      matcherVersion: MATCHER_VERSION
    }
  }

  return {
    status: 'no_match',
    publicationEligibility: 'publication_eligible',
    relations: [],
    matcherVersion: MATCHER_VERSION
  }
}
