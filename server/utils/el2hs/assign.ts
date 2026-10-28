import {
  OPTION_KEYS,
  QUESTIONS_PER_PARTICIPANT,
  QUESTIONS_PER_SECTION,
  RANDOMIZATION_VERSION,
  SOURCE_IDS,
  type ExperimentalGroup,
  type SourceId
} from './constants'
import { csprngInt, shuffleInPlace } from './rng'
import type { AssignmentItem, AssignmentJson, ExposureCounters } from './types'

export function emptyCounters(quoteIds: string[]): ExposureCounters {
  const quote: ExposureCounters['quote'] = {}
  for (const id of quoteIds) {
    quote[id] = {
      total: 0,
      byGroup: { control: 0, disclosure: 0 },
      bySection: { 1: 0, 2: 0 }
    }
  }
  return {
    group: {
      control: { completed: 0, inflight: 0 },
      disclosure: { completed: 0, inflight: 0 }
    },
    quote
  }
}

export function pickGroup(
  counters: ExposureCounters,
  randInt: (maxExclusive: number) => number = csprngInt
): ExperimentalGroup {
  const c =
    counters.group.control.completed + counters.group.control.inflight
  const d =
    counters.group.disclosure.completed + counters.group.disclosure.inflight
  if (c < d) return 'control'
  if (d < c) return 'disclosure'
  return randInt(2) === 0 ? 'control' : 'disclosure'
}

function requireQuote(counters: ExposureCounters, quoteId: string) {
  const q = counters.quote[quoteId]
  if (!q) throw new Error(`unknown quote ${quoteId}`)
  return q
}

function scoreQuote(
  quoteId: string,
  group: ExperimentalGroup,
  counters: ExposureCounters
): number {
  const q = requireQuote(counters, quoteId)
  const groupMean =
    Object.values(counters.quote).reduce((a, row) => a + row.byGroup[group], 0) /
    Math.max(Object.keys(counters.quote).length, 1)
  return q.total + Math.abs(q.byGroup[group] - groupMean)
}

export function pickTenQuotes(
  quoteIds: string[],
  group: ExperimentalGroup,
  counters: ExposureCounters,
  randInt: (maxExclusive: number) => number = csprngInt
): string[] {
  const remaining = [...quoteIds]
  const selected: string[] = []
  while (selected.length < QUESTIONS_PER_PARTICIPANT) {
    let best = Infinity
    const candidates: string[] = []
    for (const id of remaining) {
      const s = scoreQuote(id, group, counters)
      if (s < best) {
        best = s
        candidates.length = 0
        candidates.push(id)
      } else if (s === best) {
        candidates.push(id)
      }
    }
    const pick = candidates[randInt(candidates.length)]
    if (!pick) throw new Error('quote selection failed')
    selected.push(pick)
    remaining.splice(remaining.indexOf(pick), 1)
  }
  return selected
}

export function splitSections(
  selected: string[],
  counters: ExposureCounters,
  randInt: (maxExclusive: number) => number = csprngInt
): { section1: string[]; section2: string[] } {
  const pool = [...selected]
  const section1: string[] = []
  while (section1.length < QUESTIONS_PER_SECTION) {
    let best = Infinity
    const candidates: string[] = []
    for (const id of pool) {
      const q = requireQuote(counters, id)
      const gap = q.bySection[1] - q.bySection[2]
      if (gap < best) {
        best = gap
        candidates.length = 0
        candidates.push(id)
      } else if (gap === best) {
        candidates.push(id)
      }
    }
    const pick = candidates[randInt(candidates.length)]
    if (!pick) throw new Error('section selection failed')
    section1.push(pick)
    pool.splice(pool.indexOf(pick), 1)
  }
  shuffleInPlace(section1, randInt)
  const section2 = shuffleInPlace(pool, randInt)
  return { section1, section2 }
}

export function shuffleSources(
  randInt: (maxExclusive: number) => number = csprngInt
): SourceId[] {
  return shuffleInPlace([...SOURCE_IDS], randInt)
}

export function buildAssignment(
  quoteIds: string[],
  counters: ExposureCounters,
  randInt: (maxExclusive: number) => number = csprngInt
): AssignmentJson {
  const group = pickGroup(counters, randInt)
  const selected = pickTenQuotes(quoteIds, group, counters, randInt)
  const { section1, section2 } = splitSections(selected, counters, randInt)
  const items: AssignmentItem[] = []
  let position = 1
  for (const quote_id of section1) {
    const perm = shuffleSources(randInt)
    const a = perm[0]
    const b = perm[1]
    const c = perm[2]
    const d = perm[3]
    if (!a || !b || !c || !d) throw new Error('source permutation incomplete')
    items.push({
      position,
      section: 1,
      quote_id,
      option_a_source: a,
      option_b_source: b,
      option_c_source: c,
      option_d_source: d
    })
    position += 1
  }
  for (const quote_id of section2) {
    const perm = shuffleSources(randInt)
    const a = perm[0]
    const b = perm[1]
    const c = perm[2]
    const d = perm[3]
    if (!a || !b || !c || !d) throw new Error('source permutation incomplete')
    items.push({
      position,
      section: 2,
      quote_id,
      option_a_source: a,
      option_b_source: b,
      option_c_source: c,
      option_d_source: d
    })
    position += 1
  }
  return { algorithm_version: RANDOMIZATION_VERSION, group, items }
}

export function applyAssignmentToCounters(
  counters: ExposureCounters,
  assignment: AssignmentJson,
  kind: 'inflight' | 'completed'
): void {
  counters.group[assignment.group][kind] += 1
  for (const item of assignment.items) {
    const q = requireQuote(counters, item.quote_id)
    q.total += 1
    q.byGroup[assignment.group] += 1
    q.bySection[item.section] += 1
  }
}

export function sourceForChoice(
  item: AssignmentItem,
  choice: 'A' | 'B' | 'C' | 'D' | 'E'
): SourceId | 'none' {
  if (choice === 'E') return 'none'
  const map = {
    A: item.option_a_source,
    B: item.option_b_source,
    C: item.option_c_source,
    D: item.option_d_source
  }
  return map[choice]
}

export function assertPermutation(item: AssignmentItem): void {
  const set = new Set([
    item.option_a_source,
    item.option_b_source,
    item.option_c_source,
    item.option_d_source
  ])
  if (set.size !== 4) throw new Error('A–D must be a permutation of the four sources')
  for (const id of SOURCE_IDS) {
    if (!set.has(id)) throw new Error(`missing source ${id}`)
  }
  for (const key of OPTION_KEYS) {
    if (!item[`option_${key.toLowerCase()}_source` as 'option_a_source']) {
      throw new Error(`missing ${key}`)
    }
  }
}
