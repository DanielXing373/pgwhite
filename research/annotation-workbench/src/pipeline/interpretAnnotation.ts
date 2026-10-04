import type { AnnotationPattern } from '../types.ts'

/**
 * Personal Annotation interpretation helpers.
 * Length may be a feature — never a hard classification rule.
 */
export type AnnotationFeatures = {
  charLength: number
  commaSeparatedParts: number
  looksLikeName: boolean
  looksLikeDeviceLexicon: boolean
}

const DEVICE_LEXICON = [
  '比喻',
  '隐喻',
  '拟人',
  '反讽',
  '通感',
  '夸张',
  '排比',
  '对比',
  '象征',
  '意象'
]

export function extractAnnotationFeatures(content: string): AnnotationFeatures {
  const trimmed = content.trim()
  const parts = trimmed
    .split(/[,，、;；]/)
    .map((p) => p.trim())
    .filter(Boolean)
  const looksLikeDeviceLexicon = parts.some((p) =>
    DEVICE_LEXICON.some((d) => p === d || p.includes(d))
  )
  // Very rough name-like heuristic for research labeling only (no Character writes).
  const looksLikeName =
    trimmed.length > 0 &&
    trimmed.length <= 8 &&
    !looksLikeDeviceLexicon &&
    !/[。！？\n]/.test(trimmed)
  return {
    charLength: trimmed.length,
    commaSeparatedParts: parts.length,
    looksLikeName,
    looksLikeDeviceLexicon
  }
}

/**
 * Optional heuristic prior for research UI — LLM interpretation remains authoritative in runs.
 */
export function heuristicAnnotationPrior(content: string): AnnotationPattern {
  const f = extractAnnotationFeatures(content)
  if (f.looksLikeDeviceLexicon && f.charLength <= 40) return 'tag_signal'
  if (f.looksLikeName) return 'tag_signal'
  if (f.looksLikeDeviceLexicon && f.charLength > 40) return 'mixed'
  if (f.charLength >= 80) return 'reflective_note'
  if (f.charLength <= 12 && !f.looksLikeDeviceLexicon) return 'unclear'
  return 'unclear'
}
