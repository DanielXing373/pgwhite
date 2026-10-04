#!/usr/bin/env node
/**
 * Mock dry-run for Annotation Workbench review.
 * Uses fixture quotes + handcrafted LLM JSON + mock embeddings.
 * NO live LLM / embedding API calls. NO database writes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMockEmbeddingAdapter, cosineSimilarity } from '../src/adapters/embedding.ts'
import { computeAggregates } from '../src/eval/aggregates.ts'
import { buildPromptMessages } from '../src/adapters/llm.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const FIXTURE = path.join(ROOT, 'fixtures/benchmark.v1.json')
const TAXONOMY = path.join(ROOT, 'fixtures/taxonomy.v1.json')
const OUT_DIR = path.join(ROOT, 'runs/mock-dry-run-v1')

const RUN_ID = 'mock-dry-run-v1'

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function mockLlmForQuote(q) {
  const ann = q.personalAnnotation?.content

  if (q.group === 'annotation_relevant' && ann && ann.length <= 8 && !/[。！？]/.test(ann)) {
    // Character-like / short tag signal
    return {
      schema_version: 'llm-free-concepts.v1',
      themes: [
        { label: '身份辨认', brief_rationale: '批注像在指认人物，阅读焦点落在人物身份上。' },
        { label: '观察目光', brief_rationale: '引文侧重外貌或现场观察。' },
        { label: '陌生感', brief_rationale: '人物以被注视的方式出现，带有疏离感。' }
      ],
      devices: [
        { label: '外貌刻画', brief_rationale: '引文若含外貌细节，则突出视觉描写。' }
      ],
      annotation_interpretation: {
        schema_version: 'annotation-interpretation.v1',
        pattern: 'tag_signal',
        summary: '短批注更像人物/对象指称，而非完整感想。',
        tag_like_signals: [],
        character_like_signals: [{ text: ann, note: 'research_only_character_like' }],
        used_as_evidence_for_concepts: true
      }
    }
  }

  if (q.group === 'annotation_relevant' && ann && ann.length > 40) {
    return {
      schema_version: 'llm-free-concepts.v1',
      themes: [
        { label: '意义探求', brief_rationale: '批注围绕小说意义与结局选择展开。' },
        { label: '爱情与死亡', brief_rationale: '批注讨论传统结局中的爱情/死亡二元。' },
        { label: '虚无与重建', brief_rationale: '引文/批注触及虚无后被具体意象重新包裹。' },
        { label: '阅读旅程', brief_rationale: '批注把阅读本身当成旅程。' }
      ],
      devices: [
        { label: '元小说', brief_rationale: '批注讨论叙事结构与结尾策略。' },
        { label: '反讽', brief_rationale: '批注提到敷衍结尾与炫技式冒犯读者。' }
      ],
      annotation_interpretation: {
        schema_version: 'annotation-interpretation.v1',
        pattern: 'reflective_note',
        summary: '长批注是反思性阅读笔记，不是标签清单。',
        tag_like_signals: [],
        character_like_signals: [],
        used_as_evidence_for_concepts: true
      }
    }
  }

  if (q.group === 'annotation_relevant' && ann) {
    return {
      schema_version: 'llm-free-concepts.v1',
      themes: [
        { label: '作者形象', brief_rationale: '批注联想到现实作者与作品想象的落差。' },
        { label: '阅读期待', brief_rationale: '引文讨论是否应认识作者本人。' },
        { label: '反差', brief_rationale: '批注强调想象与真人的错位。' }
      ],
      devices: [
        { label: '引用', brief_rationale: '引文本身可能是对话/转述。' }
      ],
      annotation_interpretation: {
        schema_version: 'annotation-interpretation.v1',
        pattern: 'mixed',
        summary: '批注既有联想信号，也有个人感想。',
        tag_like_signals: [],
        character_like_signals: [],
        used_as_evidence_for_concepts: true
      }
    }
  }

  // Shared literary mock including 比喻 to demonstrate non-forced reconcile.
  return {
    schema_version: 'llm-free-concepts.v1',
    themes: [
      { label: '忧伤', brief_rationale: '语气带着失落或隐痛。' },
      { label: '记忆', brief_rationale: '叙述回望既往经验。' },
      { label: '孤独', brief_rationale: '主体处在疏离情境中。' },
      { label: '时间流逝', brief_rationale: '文本暗示时辰或岁月推移（不做成 Scene/Time 标签）。' }
    ],
    devices: [
      { label: '比喻', brief_rationale: '出现以一物喻另一物的表达，不自动等同于词表中的隐喻。' },
      { label: '意象', brief_rationale: '具体物象承载情绪。' }
    ],
    annotation_interpretation: null,
    notes: 'mock output for dry-run only'
  }
}

async function reconcile(concepts, targets, embedding, runId) {
  const themes = targets.filter((t) => t.dimension === 'theme')
  const devices = targets.filter((t) => t.dimension === 'device')
  const poolLabels = [...themes, ...devices]
  const taxVecs = await embedding.embed(poolLabels.map((t) => t.zh))
  const conceptVecs = await embedding.embed(concepts.map((c) => c.concept_text))
  const outcomes = []

  for (let i = 0; i < concepts.length; i++) {
    const c = concepts[i]
    const pool = c.dimension === 'theme' ? themes : devices
    const scored = pool
      .map((tag) => {
        const ti = poolLabels.findIndex((t) => t.id === tag.id)
        return {
          tag_id: tag.id,
          tag_zh: tag.zh,
          dimension: tag.dimension,
          similarity: cosineSimilarity(conceptVecs[i], taxVecs[ti])
        }
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)

    const best = scored[0]
    const caution =
      c.concept_text.includes('比喻') &&
      best &&
      ['隐喻', '意象', '内涵'].includes(best.tag_zh)
        ? 'candidates_only_until_human_judges_appropriateness; do_not_assume_biyu_equals_yinyu'
        : undefined

    // Dry-run default: threshold null → all New Personal Concept + candidates.
    outcomes.push({
      concept_text: c.concept_text,
      dimension: c.dimension,
      generation_source: c.generation_source,
      run_id: runId,
      reconciliation_candidates: scored,
      reconciliation_outcome: 'new_personal_concept',
      selected_canonical_tag: null,
      retained_personal_concept: { label: c.concept_text, dimension: c.dimension },
      caution
    })
  }
  return outcomes
}

async function main() {
  console.log('Mock dry-run — NO live model calls — NO DB writes')
  const fixture = loadJson(FIXTURE)
  const taxonomy = loadJson(TAXONOMY)
  const targets = taxonomy.reconcileTargets

  // Sample: 2 legacy, 3 annotation, 2 cold-start — enough to review schemas/UI.
  const byGroup = {
    legacy_human_tagged: fixture.quotes.filter((q) => q.group === 'legacy_human_tagged'),
    annotation_relevant: fixture.quotes.filter((q) => q.group === 'annotation_relevant'),
    cold_start: fixture.quotes.filter((q) => q.group === 'cold_start')
  }
  const anns = byGroup.annotation_relevant
  const pickAnn = (pred) => anns.find(pred)
  const annSample = [
    pickAnn((q) => (q.personalAnnotation?.content || '').length <= 8),
    pickAnn((q) => (q.personalAnnotation?.content || '').length > 40),
    pickAnn(
      (q) => {
        const n = (q.personalAnnotation?.content || '').length
        return n > 8 && n <= 40
      }
    )
  ].filter(Boolean)
  // Fallback if predicates miss
  while (annSample.length < 3) {
    const next = anns.find((q) => !annSample.includes(q))
    if (!next) break
    annSample.push(next)
  }

  const sample = [
    ...byGroup.legacy_human_tagged.slice(0, 2),
    ...annSample.slice(0, 3),
    ...byGroup.cold_start.slice(0, 2)
  ]

  const embedding = createMockEmbeddingAdapter()
  const results = []
  const promptPreviews = []

  for (const q of sample) {
    const raw = mockLlmForQuote(q)
    const msgs = buildPromptMessages(q)
    promptPreviews.push({
      quote_id: q.quoteId,
      group: q.group,
      prompt_version: msgs.promptVersion,
      system_excerpt: msgs.system.slice(0, 180) + '…',
      user: msgs.user
    })

    const free_concepts = [
      ...raw.themes.map((c) => ({
        concept_text: c.label,
        dimension: 'theme',
        generation_source: 'llm_free',
        run_id: RUN_ID,
        brief_rationale: c.brief_rationale
      })),
      ...raw.devices.map((c) => ({
        concept_text: c.label,
        dimension: 'device',
        generation_source: 'llm_free',
        run_id: RUN_ID,
        brief_rationale: c.brief_rationale
      }))
    ]

    const proposed_outcomes = await reconcile(free_concepts, targets, embedding, RUN_ID)

    const exact_label_hits = []
    for (const legacy of q.legacyTags || []) {
      if (free_concepts.some((c) => c.concept_text === legacy.zh)) {
        exact_label_hits.push(legacy.zh)
      }
    }

    results.push({
      quote_id: q.quoteId,
      group: q.group,
      annotation_interpretation: raw.annotation_interpretation,
      free_concepts,
      proposed_outcomes,
      weak_human_reference_overlap: {
        legacy_tag_ids: q.legacyTagIds || [],
        exact_label_hits,
        note: 'weak_overlap_not_accuracy'
      },
      raw_llm: raw
    })
  }

  const human_evals = [
    {
      quote_id: sample[0].quoteId,
      overall: 'okay',
      flags: ['good_new_concept'],
      notes: 'Mock eval only — Reject is per-run, not blacklist.',
      evaluated_at: new Date().toISOString(),
      applies_only_to_run_id: RUN_ID
    }
  ]

  const run = {
    schema_version: 'experiment-run.v1',
    run_id: RUN_ID,
    fixture_version: fixture.fixtureVersion,
    fixture_content_hash: fixture.contentHash,
    taxonomy_version: taxonomy.taxonomyVersion,
    prompt_version: 'zh-literary-rich-v1',
    created_at: new Date().toISOString(),
    research_only: true,
    llm: { adapter_id: 'mock-llm', model: 'handcrafted-fixture-responses', version: 'dry-run' },
    embedding: {
      adapter_id: 'mock',
      version: 'hash-ngram-v0',
      notes: 'Deterministic mock vectors for plumbing review only.'
    },
    pipeline: {
      free_concepts_first: true,
      active_dimensions: ['theme', 'device'],
      reconcile_exclusions: ['theme:时间', 'dimension:scene_time'],
      reconcile_threshold: null,
      reject_is_blacklist: false
    },
    results,
    human_evals,
    aggregates: computeAggregates(results, human_evals)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, 'run.json'), JSON.stringify(run, null, 2))
  fs.writeFileSync(
    path.join(OUT_DIR, 'prompt-previews.json'),
    JSON.stringify(promptPreviews, null, 2)
  )

  // Ensure 时间 not in candidates
  const leaked = results.some((r) =>
    r.proposed_outcomes.some((o) =>
      o.reconciliation_candidates.some((c) => c.tag_zh === '时间')
    )
  )
  if (leaked) throw new Error('Theme 时间 leaked into reconcile candidates')

  console.log('Wrote', path.join(OUT_DIR, 'run.json'))
  console.log('Wrote', path.join(OUT_DIR, 'prompt-previews.json'))
  console.log(
    JSON.stringify(
      {
        sample_n: results.length,
        aggregates: run.aggregates,
        taxonomy_reconcile_targets: targets.length,
        exclusions: taxonomy.exclusions
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
