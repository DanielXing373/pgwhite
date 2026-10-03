#!/usr/bin/env node
/**
 * Dry-run quote matcher (research only).
 *
 * Compares a candidate string against seed fixture quotes in the same
 * Author/Book/Chapter scope. NEVER writes to the database.
 *
 * Usage:
 *   node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs \
 *     research/dedup-benchmark/scripts/dry-run.mjs \
 *     --book 5 --chapter weread:13 --text "……"
 *
 * Or compare against a seed quote id:
 *   ... dry-run.mjs --seed 1338 --text "……"
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RESEARCH_ONLY_BANNER } from '../src/safety.ts'
import { scorePair } from '../src/similarity.ts'
import { EXPERIMENTAL_RULE_ID, experimentalClassify } from '../src/score.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEEDS = path.resolve(__dirname, '../fixtures/seeds.v1.json')

function parseArgs(argv) {
  const out = { book: null, chapter: null, text: null, seed: null, author: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const n = argv[i + 1]
    if (a === '--book') out.book = Number(n)
    else if (a === '--chapter') out.chapter = String(n)
    else if (a === '--text') out.text = String(n)
    else if (a === '--seed') out.seed = Number(n)
    else if (a === '--author') out.author = Number(n)
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

console.log(RESEARCH_ONLY_BANNER)
console.log('Database mutation: NONE\n')

const args = parseArgs(process.argv)
if (args.help || !args.text) {
  console.log(`Usage:
  dry-run.mjs --book <id> --chapter <label> --text "<candidate>"
  dry-run.mjs --seed <quote_id> --text "<candidate>"

Optional: --author <id>

Outputs ranked candidates from seeds.v1.json with research features.
Experimental classification is NOT production behavior.`)
  process.exit(args.text ? 0 : 1)
}

const fixture = JSON.parse(fs.readFileSync(SEEDS, 'utf8'))
let pool = fixture.seeds

if (args.seed != null) {
  const s = pool.find((x) => x.quote_id === args.seed)
  if (!s) {
    console.error(`Seed quote ${args.seed} not in fixture`)
    process.exit(1)
  }
  args.book = s.book_id
  args.author = s.author_id
  args.chapter = args.chapter || s.chapter
}

if (args.book == null) {
  console.error('--book or --seed required')
  process.exit(1)
}

pool = pool.filter((s) => s.book_id === args.book)
if (args.author != null) pool = pool.filter((s) => s.author_id === args.author)

const chapter = args.chapter
const inChapter = chapter
  ? pool.filter((s) => s.chapter === chapter)
  : pool

console.log('Candidate:')
console.log(args.text)
console.log('\nStructural scope:')
console.log(`  author_id: ${args.author ?? '(any in book seeds)'}`)
console.log(`  book_id:   ${args.book}`)
console.log(`  chapter:   ${chapter ?? '(not provided — ranking all seed chapters in book)'}`)
console.log(`  seed pool: ${inChapter.length} quote(s) in scope (${pool.length} in book)`)

if (!inChapter.length) {
  console.log('\nNo seeds in scope. likely_new (empty candidate set).')
  process.exit(0)
}

const ranked = inChapter
  .map((s) => {
    const features = scorePair(s.content_zh, args.text)
    const fakeCase = {
      book_id: s.book_id,
      chapter: s.chapter,
      candidate_book_id: args.book,
      candidate_chapter: chapter || s.chapter,
      canonical_text: s.content_zh,
      candidate_text: args.text
    }
    // If chapter not provided, do not structurally block; only score.
    const classification =
      chapter != null
        ? experimentalClassify(fakeCase, features)
        : features.normalized_exact || features.full_similarity >= 0.92
          ? { label: 'likely_duplicate', rule: `${EXPERIMENTAL_RULE_ID}: score-only (no chapter gate)` }
          : features.full_similarity >= 0.8
            ? { label: 'possible_duplicate', rule: `${EXPERIMENTAL_RULE_ID}: score-only` }
            : { label: 'likely_new', rule: `${EXPERIMENTAL_RULE_ID}: score-only` }
    return { seed: s, features, classification }
  })
  .sort(
    (a, b) =>
      Math.max(b.features.full_similarity, b.features.partial_similarity) -
      Math.max(a.features.full_similarity, a.features.partial_similarity)
  )

const best = ranked[0]
console.log('\nBest candidate:')
console.log(`  Quote #${best.seed.quote_id}`)
console.log(`  ${best.seed.content_zh}`)
console.log('\nFeatures:')
for (const [k, v] of Object.entries(best.features)) {
  console.log(`  ${k}: ${v}`)
}
console.log('\nExperimental classification:')
console.log(`  ${best.classification.label}`)
console.log(`  rule: ${best.classification.rule}`)
console.log('\nTop 5 in scope:')
for (const row of ranked.slice(0, 5)) {
  console.log(
    `  #${row.seed.quote_id} full=${row.features.full_similarity.toFixed(3)} partial=${row.features.partial_similarity.toFixed(3)} → ${row.classification.label}`
  )
}
console.log('\nDatabase mutation: NONE')
