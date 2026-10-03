import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertReadOnlySql,
  RESEARCH_ONLY_BANNER
} from '../../research/dedup-benchmark/src/safety.ts'
import {
  researchNormalize,
  stripOuterQuotes,
  normalizeWhitespace
} from '../../research/dedup-benchmark/src/normalize.ts'
import {
  fullSimilarity,
  partialSimilarity,
  scorePair
} from '../../research/dedup-benchmark/src/similarity.ts'
import { mutExact, mutWhitespace, mutOuterQuotes } from '../../research/dedup-benchmark/src/mutate.ts'
import { buildBenchmarkCases } from '../../research/dedup-benchmark/src/buildCases.ts'
import {
  applyStructuralGate,
  experimentalClassify,
  scoreCase
} from '../../research/dedup-benchmark/src/score.ts'
import type { BenchmarkCase, SeedQuote } from '../../research/dedup-benchmark/src/types.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const seedsPath = path.join(
  root,
  'research/dedup-benchmark/fixtures/seeds.v1.json'
)

describe('dedup benchmark safety', () => {
  it('exposes research-only banner', () => {
    assert.match(RESEARCH_ONLY_BANNER, /ZERO DATABASE MUTATION/)
  })

  it('allows SELECT and blocks mutating SQL', () => {
    assert.doesNotThrow(() => assertReadOnlySql('SELECT id FROM quotes'))
    assert.throws(() => assertReadOnlySql('INSERT INTO quotes (book_id) VALUES (1)'))
    assert.throws(() => assertReadOnlySql('UPDATE quotes SET book_id=1'))
    assert.throws(() => assertReadOnlySql('DELETE FROM quotes WHERE id=1'))
  })
})

describe('dedup benchmark normalization', () => {
  it('normalizes whitespace and outer quotes', () => {
    assert.equal(normalizeWhitespace('  a\n\nb  '), 'a b')
    assert.equal(stripOuterQuotes('“你好。”'), '你好。')
    assert.equal(researchNormalize('  “你好。”  '), '你好。')
  })
})

describe('dedup benchmark similarity', () => {
  it('scores exact and partial containment', () => {
    assert.equal(fullSimilarity('abc', 'abc'), 1)
    assert.ok(partialSimilarity('世界并不温柔', '他说：世界并不温柔，但我们仍然活着。') >= 0.99)
    const f = scorePair('他说：“你好。”', '你好。')
    assert.equal(f.normalized_exact, false)
    assert.ok(f.partial_similarity > 0.5)
  })
})

describe('dedup benchmark mutations', () => {
  it('is deterministic for exact/whitespace/quotes', () => {
    const t = '世界并不温柔。'
    assert.equal(mutExact(t).text, t)
    assert.equal(mutWhitespace(t, 0).text, `  ${t}  `)
    assert.equal(mutOuterQuotes(t, 'add').text, '“世界并不温柔。”')
  })
})

describe('dedup benchmark structural gates', () => {
  const base: BenchmarkCase = {
    case_id: 'T',
    seed_quote_id: 1,
    book_id: 5,
    author_id: 5,
    chapter: 'weread:1',
    candidate_book_id: 5,
    candidate_chapter: 'weread:1',
    mutation_type: 'D1_exact',
    mutation_params: {},
    ground_truth: 'DUPLICATE',
    canonical_text: '相同文本。',
    candidate_text: '相同文本。',
    notes: ''
  }

  it('blocks different chapter even at text equality', () => {
    const c = {
      ...base,
      candidate_chapter: 'weread:2',
      ground_truth: 'NOT_DUPLICATE' as const,
      mutation_type: 'N9_same_text_diff_chapter' as const
    }
    assert.equal(applyStructuralGate(c), false)
    const scored = scoreCase(c)
    assert.equal(scored.raw_exact, true)
    assert.equal(scored.experimental_prediction, 'structurally_blocked')
  })

  it('blocks different book even at text equality', () => {
    const c = {
      ...base,
      candidate_book_id: 20,
      ground_truth: 'NOT_DUPLICATE' as const,
      mutation_type: 'N10_same_text_diff_book' as const
    }
    assert.equal(applyStructuralGate(c), false)
    const { label } = experimentalClassify(c, scorePair(c.canonical_text, c.candidate_text))
    assert.equal(label, 'structurally_blocked')
  })
})

describe('dedup benchmark fixtures', () => {
  it('loads seeds fixture when present and rebuilds cases deterministically', () => {
    if (!fs.existsSync(seedsPath)) {
      // Seed export is optional in CI without DB; skip gracefully
      assert.ok(true)
      return
    }
    const fixture = JSON.parse(fs.readFileSync(seedsPath, 'utf8'))
    assert.ok(fixture.seeds.length >= 20)
    assert.ok(fixture.seeds.length <= 30)
    const a = buildBenchmarkCases(fixture.seeds as SeedQuote[])
    const b = buildBenchmarkCases(fixture.seeds as SeedQuote[])
    assert.equal(a.length, b.length)
    assert.deepEqual(
      a.map((x) => x.case_id),
      b.map((x) => x.case_id)
    )
    assert.deepEqual(
      a.map((x) => x.candidate_text),
      b.map((x) => x.candidate_text)
    )
  })
})
