import type {
  ExperimentRun,
  HumanEval,
  QuoteRunResult,
  RunAggregates
} from '../types.ts'

function mean(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function topCounts(labels: string[], limit = 20): { label: string; count: number }[] {
  const m = new Map<string, number>()
  for (const l of labels) m.set(l, (m.get(l) || 0) + 1)
  return [...m.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh'))
    .slice(0, limit)
}

/**
 * Aggregate research statistics.
 * Do NOT collapse into a single accuracy number.
 */
export function computeAggregates(
  results: QuoteRunResult[],
  humanEvals: HumanEval[] = []
): RunAggregates {
  const themeCounts = results.map(
    (r) => r.free_concepts.filter((c) => c.dimension === 'theme').length
  )
  const deviceCounts = results.map(
    (r) => r.free_concepts.filter((c) => c.dimension === 'device').length
  )

  const outcomes = results.flatMap((r) => r.proposed_outcomes)
  const assignable = outcomes.filter(
    (o) =>
      o.reconciliation_outcome === 'existing_assignment' ||
      o.reconciliation_outcome === 'new_personal_concept'
  )
  const existing = assignable.filter(
    (o) => o.reconciliation_outcome === 'existing_assignment'
  ).length
  const personal = assignable.filter(
    (o) => o.reconciliation_outcome === 'new_personal_concept'
  ).length

  const withAnn = results.filter((r) => r.annotation_interpretation != null)
  const withoutAnn = results.filter((r) => r.annotation_interpretation == null)

  const evalByQuote = new Map(humanEvals.map((e) => [e.quote_id, e]))
  const reviewed = results.filter((r) => evalByQuote.has(r.quote_id))
  const badRecon = reviewed.filter((r) =>
    evalByQuote.get(r.quote_id)?.flags.includes('bad_taxonomy_match')
  ).length
  const goodNew = reviewed.filter((r) =>
    evalByQuote.get(r.quote_id)?.flags.includes('good_new_concept')
  ).length

  const personalLabels = outcomes
    .filter((o) => o.reconciliation_outcome === 'new_personal_concept')
    .map((o) => o.concept_text)

  const sims = outcomes.flatMap((o) =>
    o.reconciliation_candidates.map((c) => c.similarity)
  )

  const weakHits = results.flatMap((r) => r.weak_human_reference_overlap?.exact_label_hits || [])

  return {
    quotes_n: results.length,
    mean_free_themes_per_quote: round4(mean(themeCounts)),
    mean_free_devices_per_quote: round4(mean(deviceCounts)),
    existing_assignment_rate: assignable.length
      ? round4(existing / assignable.length)
      : 0,
    new_personal_concept_rate: assignable.length
      ? round4(personal / assignable.length)
      : 0,
    bad_reconciliation_rate_from_review: reviewed.length
      ? round4(badRecon / reviewed.length)
      : null,
    useful_new_concept_rate_from_review: reviewed.length
      ? round4(goodNew / reviewed.length)
      : null,
    annotation_vs_no_annotation: {
      with_annotation_n: withAnn.length,
      without_annotation_n: withoutAnn.length,
      mean_themes_with_annotation: round4(
        mean(
          withAnn.map(
            (r) => r.free_concepts.filter((c) => c.dimension === 'theme').length
          )
        )
      ),
      mean_themes_without_annotation: round4(
        mean(
          withoutAnn.map(
            (r) => r.free_concepts.filter((c) => c.dimension === 'theme').length
          )
        )
      ),
      mean_devices_with_annotation: round4(
        mean(
          withAnn.map(
            (r) => r.free_concepts.filter((c) => c.dimension === 'device').length
          )
        )
      ),
      mean_devices_without_annotation: round4(
        mean(
          withoutAnn.map(
            (r) => r.free_concepts.filter((c) => c.dimension === 'device').length
          )
        )
      )
    },
    weak_human_reference_overlap: {
      label: 'weak_overlap_not_accuracy',
      quotes_with_any_exact_label_hit: results.filter(
        (r) => (r.weak_human_reference_overlap?.exact_label_hits.length || 0) > 0
      ).length,
      recurring_exact_label_hits: topCounts(weakHits)
    },
    recurring_personal_concepts: topCounts(personalLabels),
    recurring_concepts_no_canonical_home: topCounts(personalLabels),
    candidate_similarity_distribution: {
      n: sims.length,
      min: sims.length ? round4(Math.min(...sims)) : null,
      max: sims.length ? round4(Math.max(...sims)) : null,
      mean: sims.length ? round4(mean(sims)) : null,
      note: 'Similarity is a retrieval signal, not interpretation probability or accuracy.'
    }
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export function attachAggregates(run: ExperimentRun): ExperimentRun {
  return {
    ...run,
    aggregates: computeAggregates(run.results, run.human_evals || [])
  }
}
