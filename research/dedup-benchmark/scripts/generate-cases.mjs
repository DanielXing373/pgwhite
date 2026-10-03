#!/usr/bin/env node
/**
 * Build deterministic benchmark cases from seeds.v1.json (no DB access).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RESEARCH_ONLY_BANNER } from '../src/safety.ts'
import { buildBenchmarkCases } from '../src/buildCases.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEEDS = path.resolve(__dirname, '../fixtures/seeds.v1.json')
const OUT = path.resolve(__dirname, '../fixtures/cases.v1.json')

console.log(RESEARCH_ONLY_BANNER)

const fixture = JSON.parse(fs.readFileSync(SEEDS, 'utf8'))
const cases = buildBenchmarkCases(fixture.seeds)

const gt = { DUPLICATE: 0, NOT_DUPLICATE: 0, AMBIGUOUS: 0 }
for (const c of cases) gt[c.ground_truth]++

const out = {
  version: 1,
  generated_from_seeds: 'seeds.v1.json',
  seed_count: fixture.seeds.length,
  case_count: cases.length,
  ground_truth_counts: gt,
  safety: { db_mutation: 'NONE', db_access: 'NONE' },
  cases
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log(`Wrote ${cases.length} cases → ${OUT}`)
console.log(gt)
