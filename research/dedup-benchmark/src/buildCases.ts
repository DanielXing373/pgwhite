// =====================================================
// Deterministic benchmark case builder (fixture → cases)
// Target ~150–200 pairs; precision-oriented hard negatives.
// =====================================================

import type {
  BenchmarkCase,
  GroundTruth,
  MutationType,
  SeedQuote
} from './types.ts'
import {
  mutCharSubstitution,
  mutEntitySwap,
  mutExact,
  mutLexicalOverlapMeaning,
  mutMultiEdition,
  mutNegation,
  mutOuterQuotes,
  mutPrefixExpand,
  mutPrefixTrunc,
  mutPunctuation,
  mutSentenceSelect,
  mutSmallIndel,
  mutSubjectSwap,
  mutSuffixExpand,
  mutSuffixTrunc,
  mutUnicodeWidth,
  mutWhitespace,
  splitSentences,
  type MutResult
} from './mutate.ts'

function pushCase(
  out: BenchmarkCase[],
  seed: SeedQuote,
  mutation_type: MutationType,
  ground_truth: GroundTruth,
  candidate_text: string,
  params: Record<string, string | number | boolean>,
  notes: string,
  overrides?: Partial<
    Pick<BenchmarkCase, 'candidate_book_id' | 'candidate_chapter'>
  >
): void {
  out.push({
    case_id: `TMP_${out.length}`,
    seed_quote_id: seed.quote_id,
    book_id: seed.book_id,
    author_id: seed.author_id,
    chapter: seed.chapter,
    candidate_book_id: overrides?.candidate_book_id ?? seed.book_id,
    candidate_chapter: overrides?.candidate_chapter ?? seed.chapter,
    mutation_type,
    mutation_params: params,
    ground_truth,
    canonical_text: seed.content_zh,
    candidate_text,
    notes
  })
}

function tryPush(
  out: BenchmarkCase[],
  seed: SeedQuote,
  mutation_type: MutationType,
  ground_truth: GroundTruth,
  result: MutResult,
  notes: string,
  overrides?: Partial<
    Pick<BenchmarkCase, 'candidate_book_id' | 'candidate_chapter'>
  >
): boolean {
  if (!result.ok) return false
  pushCase(
    out,
    seed,
    mutation_type,
    ground_truth,
    result.text,
    result.params,
    notes,
    overrides
  )
  return true
}

function everyNth<T>(arr: T[], n: number, offset = 0): T[] {
  return arr.filter((_, i) => i % n === offset)
}

export function buildBenchmarkCases(seeds: SeedQuote[]): BenchmarkCase[] {
  const out: BenchmarkCase[] = []
  const byBook = new Map<number, SeedQuote[]>()
  for (const s of seeds) {
    const arr = byBook.get(s.book_id) || []
    arr.push(s)
    byBook.set(s.book_id, arr)
  }
  const bookIds = [...byBook.keys()].sort((a, b) => a - b)

  // ---- D1 exact: all seeds (~30) ----
  for (const seed of seeds) {
    tryPush(out, seed, 'D1_exact', 'DUPLICATE', mutExact(seed.content_zh), 'exact copy baseline')
  }

  // ---- D2 whitespace: 1 kind per seed ----
  for (const seed of seeds) {
    const kind = (seed.quote_id % 3) as 0 | 1 | 2
    tryPush(
      out,
      seed,
      'D2_whitespace',
      'DUPLICATE',
      mutWhitespace(seed.content_zh, kind),
      `whitespace kind=${kind}`
    )
  }

  // ---- D3/D4: half the seeds ----
  for (const seed of everyNth(seeds, 2, 0)) {
    tryPush(
      out,
      seed,
      'D3_unicode_width',
      'DUPLICATE',
      mutUnicodeWidth(seed.content_zh),
      'unicode/width formatting noise'
    )
    tryPush(
      out,
      seed,
      'D4_outer_quotes',
      'DUPLICATE',
      mutOuterQuotes(seed.content_zh, 'add'),
      'add outer Chinese quotes'
    )
  }
  for (const seed of everyNth(seeds, 3, 1)) {
    tryPush(
      out,
      seed,
      'D4_outer_quotes',
      'DUPLICATE',
      mutOuterQuotes(seed.content_zh, 'remove'),
      'remove outer quotes if present'
    )
  }

  // ---- D5 punctuation → AMBIGUOUS (subset) ----
  for (const seed of everyNth(seeds, 3, 0)) {
    tryPush(
      out,
      seed,
      'D5_punctuation',
      'AMBIGUOUS',
      mutPunctuation(seed.content_zh, 'period_to_excl'),
      '。→！ tone risk'
    )
  }

  // ---- D6–D9 boundary: every other seed, limited sizes ----
  for (const seed of everyNth(seeds, 2, 0)) {
    tryPush(
      out,
      seed,
      'D6_prefix_expand',
      'DUPLICATE',
      mutPrefixExpand(seed.content_zh, 1),
      'prefix boundary expansion'
    )
    tryPush(
      out,
      seed,
      'D7_suffix_expand',
      'DUPLICATE',
      mutSuffixExpand(seed.content_zh, 1),
      'suffix boundary expansion'
    )
    if (seed.char_len >= 24) {
      tryPush(
        out,
        seed,
        'D8_prefix_trunc',
        'DUPLICATE',
        mutPrefixTrunc(seed.content_zh, 3),
        'trim 3 leading chars'
      )
      tryPush(
        out,
        seed,
        'D9_suffix_trunc',
        'DUPLICATE',
        mutSuffixTrunc(seed.content_zh, 3),
        'trim 3 trailing chars'
      )
    }
  }

  // ---- D10 sentence select ----
  for (const seed of seeds.filter((s) => s.traits.multi_sentence)) {
    const sel = mutSentenceSelect(seed.content_zh, 0)
    if (!sel.ok) continue
    const gt: GroundTruth = sel.text.length >= 12 ? 'DUPLICATE' : 'AMBIGUOUS'
    tryPush(
      out,
      seed,
      'D10_sentence_select',
      gt,
      sel,
      gt === 'DUPLICATE'
        ? 'last sentence selection'
        : 'very short retained fragment'
    )
  }

  // ---- D11/D12 edition-like ----
  for (const seed of seeds) {
    tryPush(
      out,
      seed,
      'D11_char_substitution',
      'DUPLICATE',
      mutCharSubstitution(seed.content_zh),
      'small lexical substitution'
    )
  }
  for (const seed of everyNth(seeds, 2, 1)) {
    tryPush(
      out,
      seed,
      'D12_small_indel',
      'DUPLICATE',
      mutSmallIndel(seed.content_zh, (seed.quote_id % 3) as 0 | 1 | 2),
      'small insertion/deletion'
    )
  }

  // ---- D13 multi-edition (limited) ----
  for (const seed of seeds.filter((s) => s.char_len >= 30).slice(0, 8)) {
    const m = mutMultiEdition(seed.content_zh)
    if (!m.ok) continue
    const severity = String(m.params.applied || '').split('+').filter(Boolean).length
    tryPush(
      out,
      seed,
      'D13_multi_edition',
      severity >= 3 ? 'AMBIGUOUS' : 'DUPLICATE',
      m,
      'combined small edition-like edits'
    )
  }

  // ---- N1 unrelated same book ----
  for (const seed of seeds) {
    const peers = (byBook.get(seed.book_id) || []).filter(
      (p) => p.quote_id !== seed.quote_id
    )
    if (!peers.length) continue
    const peer = peers.find((p) => p.quote_id > seed.quote_id) || peers[0]!
    pushCase(
      out,
      seed,
      'N1_unrelated',
      'NOT_DUPLICATE',
      peer.content_zh,
      { peer_quote_id: peer.quote_id },
      'different quote same book',
      { candidate_chapter: peer.chapter }
    )
  }

  // ---- N2–N5 hard negatives (where mutation applies) ----
  for (const seed of seeds) {
    tryPush(
      out,
      seed,
      'N2_lexical_overlap_diff_meaning',
      'NOT_DUPLICATE',
      mutLexicalOverlapMeaning(seed.content_zh),
      'high lexical overlap, altered meaning'
    )
    tryPush(
      out,
      seed,
      'N3_subject_object_swap',
      'NOT_DUPLICATE',
      mutSubjectSwap(seed.content_zh),
      'subject substitution trap'
    )
    tryPush(
      out,
      seed,
      'N4_negation',
      'NOT_DUPLICATE',
      mutNegation(seed.content_zh),
      'negation trap'
    )
    tryPush(
      out,
      seed,
      'N5_entity_swap',
      'NOT_DUPLICATE',
      mutEntitySwap(seed.content_zh),
      'entity/number substitution'
    )
  }

  // ---- N6 shared fragment (limited) ----
  for (const seed of seeds.filter((s) => s.traits.multi_sentence).slice(0, 8)) {
    const sents = splitSentences(seed.content_zh)
    if (sents.length < 2) continue
    const frag = sents[0]!
    if (frag.length < 4) continue
    const peers = (byBook.get(seed.book_id) || []).filter(
      (p) => p.quote_id !== seed.quote_id && !p.content_zh.includes(frag)
    )
    if (!peers.length) continue
    pushCase(
      out,
      seed,
      'N6_shared_fragment',
      'NOT_DUPLICATE',
      `${frag}${peers[0]!.content_zh}`,
      { fragment: frag.slice(0, 20), peer_quote_id: peers[0]!.quote_id },
      'shared fragment trap'
    )
  }

  // ---- N7 short collisions ----
  const shorts = seeds.filter((s) => s.char_len <= 20)
  for (let i = 0; i < shorts.length; i++) {
    for (let j = i + 1; j < Math.min(shorts.length, i + 2); j++) {
      const a = shorts[i]!
      const b = shorts[j]!
      if (a.book_id !== b.book_id) continue
      pushCase(
        out,
        a,
        'N7_short_collision',
        'NOT_DUPLICATE',
        b.content_zh,
        { other_quote_id: b.quote_id },
        'two short quotes same book'
      )
    }
  }
  for (const seed of everyNth(
    seeds.filter((s) => s.char_len >= 16),
    3,
    0
  ).slice(0, 6)) {
    const head = seed.content_zh.slice(0, 6)
    let alt = head
    if (alt.includes('他')) alt = alt.replace(/他/g, '她')
    else if (alt.includes('她')) alt = alt.replace(/她/g, '他')
    else continue
    if (alt === head) continue
    pushCase(
      out,
      seed,
      'N7_short_collision',
      'NOT_DUPLICATE',
      `${alt}。`,
      { synthetic: true },
      'synthetic short collision'
    )
  }

  // ---- N8 containment trap → AMBIGUOUS (limited) ----
  for (const seed of seeds.filter((s) => s.char_len <= 40).slice(0, 8)) {
    const peers = (byBook.get(seed.book_id) || []).filter(
      (p) => p.quote_id !== seed.quote_id && p.char_len >= 40
    )
    if (!peers.length) continue
    const peer = peers[0]!
    pushCase(
      out,
      seed,
      'N8_containment_trap',
      'AMBIGUOUS',
      `${peer.content_zh.slice(0, 16)}${seed.content_zh}${peer.content_zh.slice(16, 32)}`,
      { peer_quote_id: peer.quote_id },
      'seed nested in larger passage'
    )
  }

  // ---- N9 / N10 structural (8 each) ----
  for (const seed of seeds.slice(0, 8)) {
    pushCase(
      out,
      seed,
      'N9_same_text_diff_chapter',
      'NOT_DUPLICATE',
      seed.content_zh,
      { rule: 'chapter_gate' },
      'identical text, different chapter',
      { candidate_chapter: `${seed.chapter}__OTHER` }
    )
    const otherBook = bookIds.find((id) => id !== seed.book_id)
    if (otherBook == null) continue
    pushCase(
      out,
      seed,
      'N10_same_text_diff_book',
      'NOT_DUPLICATE',
      seed.content_zh,
      { rule: 'book_gate', other_book_id: otherBook },
      'identical text, different book',
      { candidate_book_id: otherBook, candidate_chapter: 'n/a' }
    )
  }

  // ---- Ambiguous families ----
  for (const seed of seeds.filter((s) => s.traits.multi_sentence).slice(0, 6)) {
    const sents = splitSentences(seed.content_zh)
    if (sents.length < 2) continue
    pushCase(
      out,
      seed,
      'A1_extra_sentence',
      'AMBIGUOUS',
      `${seed.content_zh}${sents[0]}`,
      {},
      'extra/repeated sentence overlap'
    )
  }

  for (const seed of seeds.filter((s) => s.char_len >= 35).slice(0, 5)) {
    const m = mutMultiEdition(seed.content_zh)
    if (!m.ok) continue
    tryPush(
      out,
      seed,
      'A2_multi_edition_hard',
      'AMBIGUOUS',
      mutPrefixExpand(m.text, 2),
      'edition-like edits + boundary'
    )
  }

  for (const seed of seeds.filter((s) => s.char_len <= 18).slice(0, 5)) {
    const longPeer = seeds.find(
      (p) => p.book_id === seed.book_id && p.char_len >= 60
    )
    if (!longPeer) continue
    pushCase(
      out,
      seed,
      'A3_short_in_long',
      'AMBIGUOUS',
      longPeer.content_zh,
      { long_quote_id: longPeer.quote_id },
      'short vs long same book'
    )
  }

  for (const seed of everyNth(seeds, 4, 2).slice(0, 6)) {
    tryPush(
      out,
      seed,
      'A4_punctuation_tone',
      'AMBIGUOUS',
      mutPunctuation(seed.content_zh, 'period_to_q'),
      '。→？ meaning/tone risk'
    )
  }

  for (const seed of seeds.filter((s) => s.char_len >= 40).slice(0, 8)) {
    const start = 5
    const end = seed.char_len - 5
    if (end <= start + 8) continue
    pushCase(
      out,
      seed,
      'A5_partial_overlap',
      'AMBIGUOUS',
      seed.content_zh.slice(start, end),
      { start, end },
      'middle fragment partial overlap'
    )
  }

  return out.map((c, i) => ({
    ...c,
    case_id: `C${String(i + 1).padStart(4, '0')}_${c.mutation_type}`
  }))
}
