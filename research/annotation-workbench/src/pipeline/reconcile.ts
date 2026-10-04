import { cosineSimilarity } from '../adapters/embedding.ts'
import type {
  ConceptOutcome,
  EmbeddingAdapter,
  FreeConceptRecord,
  ReconcileCandidate,
  TaxonomyTag
} from '../types.ts'

export type ReconcileOptions = {
  embedding: EmbeddingAdapter
  /** Already filtered: Theme 时间 and Scene/Time excluded. */
  reconcileTargets: TaxonomyTag[]
  runId: string
  /** Experiment-only. null = never auto-assign; all become personal + candidates recorded. */
  threshold?: number | null
  topK?: number
}

/**
 * Embedding reconciles free concepts against Theme / Device taxonomy.
 *
 * Do NOT force near-neighbors (e.g. 比喻 → 隐喻). If no tag is genuinely
 * appropriate under the experiment threshold, keep New Personal Concept.
 *
 * Similarity = retrieval signal, not correctness probability.
 */
export async function reconcileConcepts(
  concepts: FreeConceptRecord[],
  opts: ReconcileOptions
): Promise<ConceptOutcome[]> {
  const topK = opts.topK ?? 5
  const threshold = opts.threshold ?? null
  const themes = opts.reconcileTargets.filter((t) => t.dimension === 'theme')
  const devices = opts.reconcileTargets.filter((t) => t.dimension === 'device')

  const activeConcepts = concepts.filter(
    (c) => c.dimension === 'theme' || c.dimension === 'device'
  )
  if (!activeConcepts.length) return []

  const labelTexts = [...themes, ...devices].map((t) => t.zh)
  const conceptTexts = activeConcepts.map((c) => c.concept_text)
  const [taxVecs, conceptVecs] = await Promise.all([
    opts.embedding.embed(labelTexts),
    opts.embedding.embed(conceptTexts)
  ])
  const tagByIndex = [...themes, ...devices]

  const outcomes: ConceptOutcome[] = []
  for (let i = 0; i < activeConcepts.length; i++) {
    const concept = activeConcepts[i]!
    const pool = concept.dimension === 'theme' ? themes : devices
    const scored: ReconcileCandidate[] = []
    for (const tag of pool) {
      const ti = tagByIndex.findIndex((t) => t.id === tag.id)
      if (ti < 0) continue
      scored.push({
        tag_id: tag.id,
        tag_zh: tag.zh,
        dimension: tag.dimension,
        similarity: cosineSimilarity(conceptVecs[i]!, taxVecs[ti]!)
      })
    }
    scored.sort((a, b) => b.similarity - a.similarity)
    const top = scored.slice(0, topK)
    const best = top[0]

    const caution =
      concept.concept_text.includes('比喻') &&
      best &&
      (best.tag_zh === '隐喻' || best.tag_zh === '意象' || best.tag_zh === '内涵')
        ? 'candidates_only_until_human_judges_appropriateness; do_not_assume_biyu_equals_yinyu'
        : undefined

    // Threshold is experiment-only. First live design may use null (= never auto-assign).
    const accept = threshold != null && best != null && best.similarity >= threshold

    if (accept && best) {
      outcomes.push({
        concept_text: concept.concept_text,
        dimension: concept.dimension,
        generation_source: concept.generation_source,
        run_id: opts.runId,
        reconciliation_candidates: top,
        reconciliation_outcome: 'existing_assignment',
        selected_canonical_tag: {
          tag_id: best.tag_id,
          tag_zh: best.tag_zh,
          similarity: best.similarity
        },
        retained_personal_concept: null,
        caution
      })
    } else {
      outcomes.push({
        concept_text: concept.concept_text,
        dimension: concept.dimension,
        generation_source: concept.generation_source,
        run_id: opts.runId,
        reconciliation_candidates: top,
        reconciliation_outcome: 'new_personal_concept',
        selected_canonical_tag: null,
        retained_personal_concept: {
          label: concept.concept_text,
          dimension: concept.dimension
        },
        caution
      })
    }
  }
  return outcomes
}
