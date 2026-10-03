import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { chapterAllowsMatch, decideCanonicalMatch } from '../../server/utils/canonicalMatching/decide'
import { matchingNormalize } from '../../server/utils/canonicalMatching/normalize'
import type { QuoteCandidate } from '../../server/utils/canonicalMatching/types'
import { MATCHER_VERSION } from '../../server/utils/canonicalMatching/types'
import { buildBenchmarkCases } from '../../research/dedup-benchmark/src/buildCases.ts'
import { scoreCase } from '../../research/dedup-benchmark/src/score.ts'
import type { SeedQuote } from '../../research/dedup-benchmark/src/types.ts'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function community(id: number, bookId: number, content: string, chapter: string | null = null): QuoteCandidate {
  return {
    quoteId: id,
    bookId,
    content,
    sourceChapterUid: chapter,
    corpusLayer: 'community'
  }
}

describe('canonical matching normalize', () => {
  it('treats outer quotes and whitespace as equal', () => {
    assert.equal(
      matchingNormalize('  “世界并不温柔，但我们仍然活着。”  '),
      matchingNormalize('世界并不温柔，但我们仍然活着。')
    )
  })
})

describe('canonical matching structural gates', () => {
  it('blocks different books even with identical text', () => {
    const decision = decideCanonicalMatch({
      sourceText: '相同文本。',
      sourceBookId: 5,
      sourceChapterUid: null,
      communityCandidates: [community(1, 20, '相同文本。')]
    })
    assert.equal(decision.status, 'no_match')
    assert.equal(decision.publicationEligibility, 'publication_eligible')
    assert.equal(decision.relations.length, 0)
  })

  it('blocks different chapters when both sides have chapter ids', () => {
    const decision = decideCanonicalMatch({
      sourceText: '相同文本。',
      sourceBookId: 5,
      sourceChapterUid: '12',
      communityCandidates: [community(1, 5, '相同文本。', '99')]
    })
    assert.equal(chapterAllowsMatch('12', '99'), false)
    assert.equal(decision.status, 'no_match')
  })

  it('allows match when community chapter is unknown', () => {
    assert.equal(chapterAllowsMatch('12', null), true)
  })
})

describe('canonical matching MATCHED / POSSIBLE / NO_MATCH', () => {
  it('MATCHED on normalized exact — personal_only, no merge semantics', () => {
    const communityText = '世界并不温柔，但我们仍然活着。'
    const personalText = '他说：“世界并不温柔，但我们仍然活着。”'
    // Not exact after normalize (prefix remains) — should not auto MATCHED
    const notExact = decideCanonicalMatch({
      sourceText: personalText,
      sourceBookId: 1,
      sourceChapterUid: null,
      communityCandidates: [community(10, 1, communityText)]
    })
    assert.notEqual(notExact.status, 'matched')

    const exact = decideCanonicalMatch({
      sourceText: `“${communityText}”`,
      sourceBookId: 1,
      sourceChapterUid: '1',
      communityCandidates: [community(10, 1, communityText, '1')]
    })
    assert.equal(exact.status, 'matched')
    assert.equal(exact.publicationEligibility, 'personal_only')
    assert.equal(exact.relations[0]?.targetQuoteId, 10)
    assert.equal(exact.relations[0]?.relationStatus, 'matched')
    // Community target id preserved as relation only — source text unchanged by design
    assert.ok(exact.matcherVersion.startsWith('canonical_match_'))
  })

  it('containment becomes POSSIBLE_MATCH not MATCHED', () => {
    const decision = decideCanonicalMatch({
      sourceText: '雨已经停了。',
      sourceBookId: 1,
      sourceChapterUid: null,
      communityCandidates: [community(11, 1, '她望着窗外。雨已经停了。')]
    })
    assert.equal(decision.status, 'possible_match')
    assert.equal(decision.publicationEligibility, 'publication_unresolved')
  })

  it('negation near-duplicate is not MATCHED', () => {
    const decision = decideCanonicalMatch({
      sourceText: '他相信这一切。',
      sourceBookId: 1,
      sourceChapterUid: null,
      communityCandidates: [community(12, 1, '他不相信这一切。')]
    })
    assert.notEqual(decision.status, 'matched')
  })

  it('NO_MATCH remains publication_eligible (not published)', () => {
    const decision = decideCanonicalMatch({
      sourceText: '完全无关的句子。',
      sourceBookId: 1,
      sourceChapterUid: null,
      communityCandidates: [community(13, 1, '另一句完全不同的话。')]
    })
    assert.equal(decision.status, 'no_match')
    assert.equal(decision.publicationEligibility, 'publication_eligible')
    assert.equal(decision.relations.length, 0)
  })
})

describe('canonical matching publication eligibility invariants', () => {
  it('MATCHED is personal_only and never implies community mutation', () => {
    const d = decideCanonicalMatch({
      sourceText: '同一句话。',
      sourceBookId: 2,
      sourceChapterUid: null,
      communityCandidates: [community(20, 2, '同一句话。')]
    })
    assert.equal(d.status, 'matched')
    assert.equal(d.publicationEligibility, 'personal_only')
    // Eligibility is not user consent / publish action
    assert.notEqual(d.publicationEligibility, 'publication_eligible')
  })

  it('POSSIBLE_MATCH is publication_unresolved', () => {
    const d = decideCanonicalMatch({
      sourceText: '雨已经停了。',
      sourceBookId: 2,
      sourceChapterUid: null,
      communityCandidates: [community(21, 2, '她望着窗外。雨已经停了。世界安静下来。')]
    })
    assert.equal(d.status, 'possible_match')
    assert.equal(d.publicationEligibility, 'publication_unresolved')
  })
})

describe('dedup benchmark regression with production matcher normalize', () => {
  it('keeps structural N9/N10 blocked under experimental classifier', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    const seedsPath = path.join(
      root,
      'research/dedup-benchmark/fixtures/seeds.v1.json'
    )
    if (!fs.existsSync(seedsPath)) return
    const fixture = JSON.parse(fs.readFileSync(seedsPath, 'utf8'))
    const cases = buildBenchmarkCases(fixture.seeds as SeedQuote[])
    const n9 = cases.filter((c) => c.mutation_type === 'N9_same_text_diff_chapter')
    const n10 = cases.filter((c) => c.mutation_type === 'N10_same_text_diff_book')
    assert.ok(n9.length >= 1)
    assert.ok(n10.length >= 1)
    for (const c of [...n9, ...n10]) {
      const scored = scoreCase(c)
      assert.equal(scored.experimental_prediction, 'structurally_blocked')
    }
  })

  it('production MATCHED rule stays stricter than benchmark DUPLICATE labels', () => {
    // Negation-style pairs must not become MATCHED even if similarity is high.
    const d = decideCanonicalMatch({
      sourceText: '“是六天九小时二十七分。”飞船修正道。',
      sourceBookId: 9,
      sourceChapterUid: null,
      communityCandidates: [
        community(90, 9, '“不是六天九小时二十七分。”飞船修正道。')
      ]
    })
    assert.notEqual(d.status, 'matched')
    assert.equal(MATCHER_VERSION.length > 0, true)
  })
})
