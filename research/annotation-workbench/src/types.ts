/** Immutable benchmark fixture version. */
export type FixtureVersion = string

export type BenchmarkGroup =
  | 'legacy_human_tagged'
  | 'annotation_relevant'
  | 'cold_start'

export type AnnotationPattern =
  | 'tag_signal'
  | 'reflective_note'
  | 'mixed'
  | 'unclear'

export type TagDimension = 'theme' | 'device'

export type TaxonomyTag = {
  id: number
  dimension: TagDimension
  zh: string
  en: string
  assignmentCount: number
  sourceCode?: number
}

export type PersonalAnnotationEvidence = {
  content: string
  originalContent: string
  source: string
  importItemId?: number
  externalId?: string
  libraryEntryId?: number
  association?: 'matched_highlight' | 'orphan_review_quote'
}

export type FixtureQuote = {
  quoteId: number
  group: BenchmarkGroup
  bookId: number
  bookTitleZh: string
  authorNameZh?: string | null
  chapterTitle?: string | null
  /** Literary text used for free concept generation. */
  textZh: string
  productionQuoteTextZh?: string
  literarySource?: string
  lengthBucket: 'short' | 'medium' | 'long'
  charLen?: number
  dialogueIsh?: boolean
  /** Weak reference only — never ground truth. */
  legacyTagIds?: number[]
  legacyTags?: { id: number; dimension: string; zh: string }[]
  personalAnnotation?: PersonalAnnotationEvidence | null
  notes?: string
}

export type FixtureFile = {
  fixtureVersion: FixtureVersion
  taxonomyVersion: string
  createdAt: string
  researchOnly?: boolean
  notes: string[]
  selectionMethod?: unknown
  summary?: unknown
  contentHash: string
  quotes: FixtureQuote[]
}

export type TaxonomySnapshot = {
  taxonomyVersion: string
  fixtureVersion: string
  activeDimensions: TagDimension[]
  excludedDimensionsFromReconcile: string[]
  exclusions: { id: number; zh: string; en: string; reason: string }[]
  notes: string[]
  tags: TaxonomyTag[]
  reconcileTargets: TaxonomyTag[]
}

export type FreeConcept = {
  label: string
  brief_rationale: string
}

/** Exact LLM JSON for zh-literary-rich-v1 / llm-free-concepts.v1 */
export type LlmFreeConceptsV1 = {
  schema_version: 'llm-free-concepts.v1'
  themes: FreeConcept[]
  devices: FreeConcept[]
  annotation_interpretation: AnnotationInterpretationV1 | null
  notes?: string
}

export type AnnotationInterpretationV1 = {
  schema_version: 'annotation-interpretation.v1'
  pattern: AnnotationPattern
  summary: string
  tag_like_signals?: {
    text: string
    guessed_dimension: 'theme' | 'device' | 'unknown'
  }[]
  character_like_signals?: { text: string; note?: string }[]
  used_as_evidence_for_concepts?: boolean
}

export type ReconcileCandidate = {
  tag_id: number
  tag_zh: string
  dimension: TagDimension
  similarity: number
}

export type ReconciliationOutcome =
  | 'existing_assignment'
  | 'new_personal_concept'
  | 'skipped_not_active_dimension'

export type ConceptOutcome = {
  concept_text: string
  dimension: TagDimension | 'other'
  generation_source: 'llm_free' | 'annotation_signal'
  run_id: string
  reconciliation_candidates: ReconcileCandidate[]
  reconciliation_outcome: ReconciliationOutcome
  selected_canonical_tag: {
    tag_id: number
    tag_zh: string
    similarity: number
  } | null
  retained_personal_concept: {
    label: string
    dimension: TagDimension | 'other'
  } | null
  caution?: string
}

export type FreeConceptRecord = {
  concept_text: string
  dimension: TagDimension | 'other'
  generation_source: 'llm_free' | 'annotation_signal'
  run_id: string
  brief_rationale?: string
}

export type QuoteRunResult = {
  quote_id: number
  group: BenchmarkGroup
  annotation_interpretation: AnnotationInterpretationV1 | null
  free_concepts: FreeConceptRecord[]
  proposed_outcomes: ConceptOutcome[]
  weak_human_reference_overlap?: {
    legacy_tag_ids: number[]
    exact_label_hits: string[]
    note: string
  }
  raw_llm?: LlmFreeConceptsV1
}

export type OverallJudgement = 'useful' | 'okay' | 'bad'

export type EvalIssueFlag =
  | 'missing_useful_tag'
  | 'too_many_tags'
  | 'bad_interpretation'
  | 'wrong_rhetorical_device'
  | 'bad_taxonomy_match'
  | 'good_new_concept'

export type HumanEval = {
  quote_id: number
  overall: OverallJudgement
  flags: EvalIssueFlag[]
  notes?: string
  evaluated_at: string
  /** Reject/Bad/Edit apply only to this run — not a permanent blacklist. */
  applies_only_to_run_id: string
}

export type RunAggregates = {
  quotes_n: number
  mean_free_themes_per_quote: number
  mean_free_devices_per_quote: number
  existing_assignment_rate: number
  new_personal_concept_rate: number
  bad_reconciliation_rate_from_review: number | null
  useful_new_concept_rate_from_review: number | null
  annotation_vs_no_annotation: Record<string, unknown>
  weak_human_reference_overlap: Record<string, unknown>
  recurring_personal_concepts: { label: string; count: number }[]
  recurring_concepts_no_canonical_home: { label: string; count: number }[]
  candidate_similarity_distribution: Record<string, unknown>
}

export type ExperimentRun = {
  schema_version: 'experiment-run.v1'
  run_id: string
  fixture_version: FixtureVersion
  fixture_content_hash?: string
  taxonomy_version: string
  prompt_version: string
  created_at: string
  research_only: true
  llm: { adapter_id: string; model: string; version?: string }
  embedding: { adapter_id: string; version?: string; notes?: string }
  pipeline: {
    free_concepts_first: true
    active_dimensions: TagDimension[]
    reconcile_exclusions: string[]
    reconcile_threshold: number | null
    reject_is_blacklist: false
  }
  results: QuoteRunResult[]
  human_evals?: HumanEval[]
  aggregates: RunAggregates
}

export type LlmAdapter = {
  id: string
  proposeConcepts(input: {
    quoteText: string
    bookTitleZh?: string | null
    authorNameZh?: string | null
    chapterTitle?: string | null
    personalAnnotation?: string | null
    promptVersion: string
  }): Promise<LlmFreeConceptsV1>
}

export type EmbeddingAdapter = {
  id: 'bge-m3' | 'qwen3-embedding' | 'mock' | string
  embed(texts: string[]): Promise<number[][]>
}
