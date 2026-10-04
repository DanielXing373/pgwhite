import type {
  FixtureQuote,
  FreeConceptRecord,
  LlmAdapter,
  LlmFreeConceptsV1,
  QuoteRunResult
} from '../types.ts'
import { getPromptVersion } from './promptBuilder.ts'

export async function runFreeConceptStage(opts: {
  quotes: FixtureQuote[]
  llm: LlmAdapter
  runId: string
  promptVersion?: string
}): Promise<
  Pick<
    QuoteRunResult,
    'quote_id' | 'group' | 'annotation_interpretation' | 'free_concepts' | 'raw_llm'
  >[]
> {
  const promptVersion = opts.promptVersion || getPromptVersion()
  const out = []
  for (const q of opts.quotes) {
    const raw: LlmFreeConceptsV1 = await opts.llm.proposeConcepts({
      quoteText: q.textZh,
      bookTitleZh: q.bookTitleZh,
      authorNameZh: q.authorNameZh,
      chapterTitle: q.chapterTitle,
      personalAnnotation: q.personalAnnotation?.content ?? null,
      promptVersion
    })

    if (raw.schema_version !== 'llm-free-concepts.v1') {
      throw new Error(`Unexpected LLM schema_version: ${raw.schema_version}`)
    }

    const free_concepts: FreeConceptRecord[] = [
      ...raw.themes.map((c) => ({
        concept_text: c.label,
        dimension: 'theme' as const,
        generation_source: 'llm_free' as const,
        run_id: opts.runId,
        brief_rationale: c.brief_rationale
      })),
      ...raw.devices.map((c) => ({
        concept_text: c.label,
        dimension: 'device' as const,
        generation_source: 'llm_free' as const,
        run_id: opts.runId,
        brief_rationale: c.brief_rationale
      }))
    ]

    out.push({
      quote_id: q.quoteId,
      group: q.group,
      annotation_interpretation: raw.annotation_interpretation,
      free_concepts,
      raw_llm: raw
    })
  }
  return out
}
