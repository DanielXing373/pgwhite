// =====================================================
// Canonical matching types (1.3)
// Dedup = relationship + publication eligibility — NOT merge.
// =====================================================

export type MatchRelationStatus = 'matched' | 'possible_match'

export type PublicationEligibility =
  | 'personal_only'
  | 'publication_unresolved'
  | 'publication_eligible'

export type MatchDecisionStatus = 'matched' | 'possible_match' | 'no_match'

export type ScoreFeatures = {
  raw_exact: boolean
  normalized_exact: boolean
  full_similarity: number
  partial_similarity: number
  length_ratio: number
  containment: boolean
  jaro_winkler: number
  char_bigram_dice: number
}

export type QuoteCandidate = {
  quoteId: number
  bookId: number
  content: string
  sourceChapterUid: string | null
  corpusLayer: 'personal' | 'community'
}

export type MatchDecision = {
  status: MatchDecisionStatus
  publicationEligibility: PublicationEligibility
  /** Best / related community targets (empty when no_match). */
  relations: Array<{
    targetQuoteId: number
    relationStatus: MatchRelationStatus
    publicationEligibility: PublicationEligibility
    features: ScoreFeatures
    matcherRule: string
  }>
  matcherVersion: string
}

export const MATCHER_VERSION = 'canonical_match_v1_2026-10-03'
