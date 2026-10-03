// =====================================================
// CSV + Markdown report generation
// =====================================================

import type { GroundTruth, ScoredCase } from './types.ts'

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const CSV_COLS = [
  'case_id',
  'seed_quote_id',
  'book_id',
  'chapter',
  'candidate_book_id',
  'candidate_chapter',
  'mutation_type',
  'ground_truth',
  'canonical_text',
  'candidate_text',
  'raw_exact',
  'normalized_exact',
  'full_similarity',
  'partial_similarity',
  'length_ratio',
  'containment',
  'jaro_winkler',
  'char_bigram_dice',
  'experimental_prediction',
  'experimental_rule',
  'notes'
] as const

export function toCsv(rows: ScoredCase[]): string {
  const lines = [CSV_COLS.join(',')]
  for (const r of rows) {
    lines.push(
      CSV_COLS.map((k) => csvEscape((r as Record<string, unknown>)[k])).join(
        ','
      )
    )
  }
  return lines.join('\n') + '\n'
}

function median(nums: number[]): number {
  if (!nums.length) return NaN
  const a = [...nums].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2
}

function pct(nums: number[], p: number): number {
  if (!nums.length) return NaN
  const a = [...nums].sort((x, y) => x - y)
  const idx = Math.min(a.length - 1, Math.max(0, Math.floor((p / 100) * a.length)))
  return a[idx]!
}

function dist(rows: ScoredCase[], key: 'full_similarity' | 'partial_similarity') {
  const by: Record<GroundTruth, number[]> = {
    DUPLICATE: [],
    NOT_DUPLICATE: [],
    AMBIGUOUS: []
  }
  for (const r of rows) by[r.ground_truth].push(r[key])
  const lines: string[] = []
  for (const gt of ['DUPLICATE', 'NOT_DUPLICATE', 'AMBIGUOUS'] as GroundTruth[]) {
    const arr = by[gt]
    if (!arr.length) {
      lines.push(`- **${gt}**: n=0`)
      continue
    }
    lines.push(
      `- **${gt}** (n=${arr.length}): min=${Math.min(...arr).toFixed(3)} median=${median(arr).toFixed(3)} p90=${pct(arr, 90).toFixed(3)} max=${Math.max(...arr).toFixed(3)}`
    )
  }
  return lines.join('\n')
}

function countBy<T extends string>(rows: ScoredCase[], key: (r: ScoredCase) => T): Record<string, number> {
  const m: Record<string, number> = {}
  for (const r of rows) {
    const k = key(r)
    m[k] = (m[k] || 0) + 1
  }
  return m
}

function topRows(
  rows: ScoredCase[],
  pred: (r: ScoredCase) => boolean,
  score: (r: ScoredCase) => number,
  n: number,
  desc = true
): ScoredCase[] {
  return rows
    .filter(pred)
    .sort((a, b) => (desc ? score(b) - score(a) : score(a) - score(b)))
    .slice(0, n)
}

function fmtPair(r: ScoredCase): string {
  const trunc = (s: string) =>
    s.length > 60 ? s.slice(0, 60) + '…' : s
  return [
    `- \`${r.case_id}\` · ${r.mutation_type} · full=${r.full_similarity.toFixed(3)} partial=${r.partial_similarity.toFixed(3)} lr=${r.length_ratio.toFixed(3)} contain=${r.containment} · pred=${r.experimental_prediction}`,
    `  - canonical: ${trunc(r.canonical_text)}`,
    `  - candidate: ${trunc(r.candidate_text)}`
  ].join('\n')
}

export function toMarkdownReport(rows: ScoredCase[], meta: {
  seedCount: number
  generatedAt: string
  experimentalRule: string
}): string {
  const gt = countBy(rows, (r) => r.ground_truth)
  const mut = countBy(rows, (r) => r.mutation_type)
  const seeds = countBy(rows, (r) => String(r.seed_quote_id))

  const fpRisk = topRows(
    rows,
    (r) =>
      r.ground_truth === 'NOT_DUPLICATE' &&
      r.experimental_prediction !== 'structurally_blocked',
    (r) => Math.max(r.full_similarity, r.partial_similarity),
    15
  )

  const fnRisk = topRows(
    rows,
    (r) => r.ground_truth === 'DUPLICATE',
    (r) => r.full_similarity,
    15,
    false
  )

  const amb = topRows(
    rows,
    (r) => r.ground_truth === 'AMBIGUOUS',
    (r) => Math.abs(r.full_similarity - 0.85),
    12,
    false
  )

  const n9 = rows.filter((r) => r.mutation_type === 'N9_same_text_diff_chapter')
  const n10 = rows.filter((r) => r.mutation_type === 'N10_same_text_diff_book')
  const n9Blocked = n9.filter((r) => r.experimental_prediction === 'structurally_blocked').length
  const n10Blocked = n10.filter((r) => r.experimental_prediction === 'structurally_blocked').length

  const mutLines = Object.entries(mut)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  return `# PGWhite 1.3 Dedup Benchmark Report

**Status:** Research / dry-run only — **ZERO database mutation**  
**Generated:** ${meta.generatedAt}  
**Experimental rule:** \`${meta.experimentalRule}\` (NOT production truth)

## Dataset summary

| Metric | Value |
|--------|------:|
| Seeds | ${meta.seedCount} |
| Pairs | ${rows.length} |
| DUPLICATE | ${gt.DUPLICATE || 0} |
| NOT_DUPLICATE | ${gt.NOT_DUPLICATE || 0} |
| AMBIGUOUS | ${gt.AMBIGUOUS || 0} |
| Distinct seed quote IDs used | ${Object.keys(seeds).length} |

### Ground-truth mix

- DUPLICATE: ${(((gt.DUPLICATE || 0) / rows.length) * 100).toFixed(1)}%
- NOT_DUPLICATE: ${(((gt.NOT_DUPLICATE || 0) / rows.length) * 100).toFixed(1)}%
- AMBIGUOUS: ${(((gt.AMBIGUOUS || 0) / rows.length) * 100).toFixed(1)}%

### Mutation-type distribution

${mutLines}

## Metric distribution (on research-normalized text)

### full_similarity

${dist(rows, 'full_similarity')}

### partial_similarity

${dist(rows, 'partial_similarity')}

## False-positive analysis (most dangerous NOT_DUPLICATE)

Ranked by max(full, partial). Structural blocks excluded.

${fpRisk.map(fmtPair).join('\n') || '_none_'}

## False-negative analysis (DUPLICATE with low full_similarity)

${fnRisk.map(fmtPair).join('\n') || '_none_'}

## Ambiguous cases (sample)

${amb.map(fmtPair).join('\n') || '_none_'}

## Structural-rule validation

| Rule | Cases | Structurally blocked | Pass? |
|------|------:|---------------------:|:-----:|
| N9 same text / different chapter | ${n9.length} | ${n9Blocked} | ${n9.length && n9Blocked === n9.length ? 'YES' : 'NO'} |
| N10 same text / different book | ${n10.length} | ${n10Blocked} | ${n10.length && n10Blocked === n10.length ? 'YES' : 'NO'} |

Note: textual scorers may still show full_similarity=1.0 on these rows; the experimental classifier must reject via Book/Chapter gates.

## Mutation-family notes

- **Boundary (D6–D9):** typically high partial_similarity; full_similarity drops with expansion size.
- **Edition-like (D11–D13):** watch overlap with N2/N4/N5 hard negatives.
- **Short (N7):** similarity scores are unreliable — inspect length_ratio.
- **Negation (N4):** high character overlap with opposite meaning — critical FP risk.
- **Containment (N8/A3):** partial_similarity can hit 1.0 without identity.

## How to read this

1. Open \`benchmark-results.csv\` for every pair + features.
2. Use this Markdown for clustered inspection.
3. Do **not** treat experimental bands as a shipping threshold.
4. Real-user WeRead cross-edition data will be required before production calibration.

## Limitations

- Controlled mutations of Daniel’s curated Chinese corpus — not a universal user sample.
- Neighboring literary context for expansions is synthetic discourse wrapping (no full ebook text).
- Chapter labels are real WeRead chapterUid when joinable, else synthetic stable labels for gating tests.
`
}
