// =====================================================
// Lightweight string similarity (no external NLP deps)
// Inspired by RapidFuzz concepts; Node/TS native implementation.
// =====================================================

import { researchNormalize } from './normalize'
import type { ScoreFeatures } from './types'

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const rows = a.length + 1
  const cols = b.length + 1
  let prev = new Array<number>(cols)
  let curr = new Array<number>(cols)
  for (let j = 0; j < cols; j++) prev[j] = j
  for (let i = 1; i < rows; i++) {
    curr[0] = i
    const ca = a.charCodeAt(i - 1)
    for (let j = 1; j < cols; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost
      )
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]!
}

/** Full-string edit similarity in [0,1]. */
export function fullSimilarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1
  const d = levenshtein(a, b)
  return 1 - d / Math.max(a.length, b.length)
}

/**
 * Partial / best-substring similarity (RapidFuzz partial_ratio style):
 * score the shorter string against the best window of the longer string.
 * Uses a stepped scan for long strings to keep the benchmark practical.
 */
export function partialSimilarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1
  if (!a.length || !b.length) return 0
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (long.includes(short)) return 1
  const n = short.length
  let best = 0
  const step = n > 80 ? 3 : n > 40 ? 2 : 1
  // Primary: windows of length n
  for (let i = 0; i + n <= long.length; i += step) {
    const score = fullSimilarity(short, long.slice(i, i + n))
    if (score > best) best = score
    if (best === 1) return 1
  }
  // Boundary noise: ±1 length at coarser step
  for (const len of [n - 1, n + 1]) {
    if (len < 1 || len > long.length) continue
    for (let i = 0; i + len <= long.length; i += Math.max(2, step)) {
      const score = fullSimilarity(short, long.slice(i, i + len))
      if (score > best) best = score
    }
  }
  return best
}

export function lengthRatio(a: string, b: string): number {
  const x = a.length
  const y = b.length
  if (!x && !y) return 1
  if (!x || !y) return 0
  return Math.min(x, y) / Math.max(x, y)
}

export function isContained(a: string, b: string): boolean {
  if (!a.length || !b.length) return false
  return a.includes(b) || b.includes(a)
}

/** Jaro similarity */
function jaro(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0
  const matchDist = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const aMatches = new Array<boolean>(a.length).fill(false)
  const bMatches = new Array<boolean>(b.length).fill(false)
  let matches = 0
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDist)
    const end = Math.min(i + matchDist + 1, b.length)
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue
      aMatches[i] = true
      bMatches[j] = true
      matches++
      break
    }
  }
  if (!matches) return 0
  const aMS: string[] = []
  const bMS: string[] = []
  for (let i = 0; i < a.length; i++) if (aMatches[i]) aMS.push(a[i]!)
  for (let j = 0; j < b.length; j++) if (bMatches[j]) bMS.push(b[j]!)
  let transpositions = 0
  for (let i = 0; i < aMS.length; i++) if (aMS[i] !== bMS[i]) transpositions++
  const t = transpositions / 2
  return (
    (matches / a.length + matches / b.length + (matches - t) / matches) / 3
  )
}

/** Jaro-Winkler with p=0.1, useful for shared prefixes in short literary lines. */
export function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b)
  let prefix = 0
  const maxPrefix = Math.min(4, a.length, b.length)
  while (prefix < maxPrefix && a[prefix] === b[prefix]) prefix++
  return j + prefix * 0.1 * (1 - j)
}

/** Character bigram Dice coefficient — local character-order overlap. */
export function charBigramDice(a: string, b: string): number {
  if (!a.length || !b.length) return a === b ? 1 : 0
  if (a.length === 1 && b.length === 1) return a === b ? 1 : 0
  const grams = (s: string) => {
    const m = new Map<string, number>()
    if (s.length === 1) {
      m.set(s, 1)
      return m
    }
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2)
      m.set(g, (m.get(g) || 0) + 1)
    }
    return m
  }
  const A = grams(a)
  const B = grams(b)
  let inter = 0
  let sizeA = 0
  let sizeB = 0
  for (const v of A.values()) sizeA += v
  for (const v of B.values()) sizeB += v
  for (const [g, ca] of A) {
    const cb = B.get(g) || 0
    inter += Math.min(ca, cb)
  }
  if (!sizeA && !sizeB) return 1
  return (2 * inter) / (sizeA + sizeB)
}

export function scorePair(canonical: string, candidate: string): ScoreFeatures {
  const rawExact = canonical === candidate
  const na = researchNormalize(canonical)
  const nb = researchNormalize(candidate)
  return {
    raw_exact: rawExact,
    normalized_exact: na === nb,
    full_similarity: round4(fullSimilarity(na, nb)),
    partial_similarity: round4(partialSimilarity(na, nb)),
    length_ratio: round4(lengthRatio(na, nb)),
    containment: isContained(na, nb),
    jaro_winkler: round4(jaroWinkler(na, nb)),
    char_bigram_dice: round4(charBigramDice(na, nb))
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
