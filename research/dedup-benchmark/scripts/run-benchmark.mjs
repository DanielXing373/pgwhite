#!/usr/bin/env node
/**
 * Score all benchmark cases and write CSV + Markdown (no DB access).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RESEARCH_ONLY_BANNER } from '../src/safety.ts'
import { scoreAll, EXPERIMENTAL_RULE_ID } from '../src/score.ts'
import { toCsv, toMarkdownReport } from '../src/report.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CASES = path.resolve(__dirname, '../fixtures/cases.v1.json')
const OUT_DIR = path.resolve(__dirname, '../output')

console.log(RESEARCH_ONLY_BANNER)

const fixture = JSON.parse(fs.readFileSync(CASES, 'utf8'))
const scored = scoreAll(fixture.cases)
const generatedAt = new Date().toISOString()

fs.mkdirSync(OUT_DIR, { recursive: true })
const csvPath = path.join(OUT_DIR, 'benchmark-results.csv')
const mdPath = path.join(OUT_DIR, 'benchmark-report.md')
const jsonPath = path.join(OUT_DIR, 'benchmark-results.json')

fs.writeFileSync(csvPath, toCsv(scored), 'utf8')
fs.writeFileSync(
  mdPath,
  toMarkdownReport(scored, {
    seedCount: fixture.seed_count,
    generatedAt,
    experimentalRule: EXPERIMENTAL_RULE_ID
  }),
  'utf8'
)
fs.writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generated_at: generatedAt,
      experimental_rule: EXPERIMENTAL_RULE_ID,
      db_mutation: 'NONE',
      case_count: scored.length,
      rows: scored
    },
    null,
    2
  ) + '\n',
  'utf8'
)

const gt = { DUPLICATE: 0, NOT_DUPLICATE: 0, AMBIGUOUS: 0 }
for (const r of scored) gt[r.ground_truth]++
console.log(`Scored ${scored.length} cases`)
console.log(gt)
console.log(`CSV → ${csvPath}`)
console.log(`MD  → ${mdPath}`)
