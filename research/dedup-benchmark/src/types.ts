// =====================================================
// PGWhite 1.3 Dedup Benchmark — shared types (R&D only)
// =====================================================

export type GroundTruth = 'DUPLICATE' | 'NOT_DUPLICATE' | 'AMBIGUOUS'

export type MutationType =
  | 'D1_exact'
  | 'D2_whitespace'
  | 'D3_unicode_width'
  | 'D4_outer_quotes'
  | 'D5_punctuation'
  | 'D6_prefix_expand'
  | 'D7_suffix_expand'
  | 'D8_prefix_trunc'
  | 'D9_suffix_trunc'
  | 'D10_sentence_select'
  | 'D11_char_substitution'
  | 'D12_small_indel'
  | 'D13_multi_edition'
  | 'N1_unrelated'
  | 'N2_lexical_overlap_diff_meaning'
  | 'N3_subject_object_swap'
  | 'N4_negation'
  | 'N5_entity_swap'
  | 'N6_shared_fragment'
  | 'N7_short_collision'
  | 'N8_containment_trap'
  | 'N9_same_text_diff_chapter'
  | 'N10_same_text_diff_book'
  | 'A1_extra_sentence'
  | 'A2_multi_edition_hard'
  | 'A3_short_in_long'
  | 'A4_punctuation_tone'
  | 'A5_partial_overlap'
  | 'M_manual'

export type SeedQuote = {
  quote_id: number
  book_id: number
  author_id: number
  book_title_zh: string
  author_name_zh: string
  content_zh: string
  char_len: number
  /** Real WeRead chapterUid when joinable; else synthetic stable label */
  chapter: string
  traits: {
    short: boolean
    medium: boolean
    long: boolean
    dialogue: boolean
    multi_sentence: boolean
    has_cn_quotes: boolean
    punctuation_rich: boolean
  }
}

export type BenchmarkCase = {
  case_id: string
  seed_quote_id: number
  book_id: number
  author_id: number
  chapter: string
  candidate_book_id: number
  candidate_chapter: string
  mutation_type: MutationType
  mutation_params: Record<string, string | number | boolean>
  ground_truth: GroundTruth
  canonical_text: string
  candidate_text: string
  notes: string
}

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

export type ExperimentalLabel =
  | 'likely_duplicate'
  | 'possible_duplicate'
  | 'likely_new'
  | 'structurally_blocked'

export type ScoredCase = BenchmarkCase &
  ScoreFeatures & {
    experimental_prediction: ExperimentalLabel
    experimental_rule: string
  }
