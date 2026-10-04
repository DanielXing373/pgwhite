import type { AnnotationInterpretationV1, LlmFreeConceptsV1 } from '../types.ts'

export type ValidationResult =
  | { ok: true; value: LlmFreeConceptsV1 }
  | { ok: false; errors: string[] }

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function validateConcept(c: unknown, path: string, errors: string[]): void {
  if (!isObject(c)) {
    errors.push(`${path}: must be object`)
    return
  }
  if (typeof c.label !== 'string' || !c.label.trim() || c.label.length > 40) {
    errors.push(`${path}.label: required string 1..40`)
  }
  if (
    typeof c.brief_rationale !== 'string' ||
    !c.brief_rationale.trim() ||
    c.brief_rationale.length > 200
  ) {
    errors.push(`${path}.brief_rationale: required string 1..200`)
  }
  const keys = Object.keys(c)
  for (const k of keys) {
    if (k !== 'label' && k !== 'brief_rationale') {
      errors.push(`${path}: unexpected property ${k}`)
    }
  }
}

function validateAnnotation(a: unknown, errors: string[]): void {
  if (a == null) return
  if (!isObject(a)) {
    errors.push('annotation_interpretation: must be object or null')
    return
  }
  if (a.schema_version !== 'annotation-interpretation.v1') {
    errors.push('annotation_interpretation.schema_version: must be annotation-interpretation.v1')
  }
  if (!['tag_signal', 'reflective_note', 'mixed', 'unclear'].includes(String(a.pattern))) {
    errors.push('annotation_interpretation.pattern: invalid')
  }
  if (typeof a.summary !== 'string' || !a.summary.trim()) {
    errors.push('annotation_interpretation.summary: required non-empty string')
  }
  if ('original_annotation_unchanged' in a) {
    errors.push(
      'annotation_interpretation.original_annotation_unchanged: must not be produced by LLM'
    )
  }
  if (a.tag_like_signals != null) {
    if (!Array.isArray(a.tag_like_signals)) {
      errors.push('annotation_interpretation.tag_like_signals: must be array')
    } else {
      a.tag_like_signals.forEach((s, i) => {
        if (!isObject(s) || typeof s.text !== 'string') {
          errors.push(`annotation_interpretation.tag_like_signals[${i}]: invalid`)
        } else if (!['theme', 'device', 'unknown'].includes(String(s.guessed_dimension))) {
          errors.push(`annotation_interpretation.tag_like_signals[${i}].guessed_dimension: invalid`)
        }
      })
    }
  }
  if (a.character_like_signals != null) {
    if (!Array.isArray(a.character_like_signals)) {
      errors.push('annotation_interpretation.character_like_signals: must be array')
    } else {
      a.character_like_signals.forEach((s, i) => {
        if (!isObject(s) || typeof s.text !== 'string') {
          errors.push(`annotation_interpretation.character_like_signals[${i}]: invalid`)
        }
      })
    }
  }
  if (a.used_as_evidence_for_concepts != null && typeof a.used_as_evidence_for_concepts !== 'boolean') {
    errors.push('annotation_interpretation.used_as_evidence_for_concepts: must be boolean')
  }
}

/**
 * Strict validation for llm-free-concepts.v1.
 * Malformed responses must not silently become valid results.
 */
export function validateLlmFreeConcepts(raw: unknown): ValidationResult {
  const errors: string[] = []
  if (!isObject(raw)) {
    return { ok: false, errors: ['root: must be object'] }
  }
  if (raw.schema_version !== 'llm-free-concepts.v1') {
    errors.push('schema_version: must be llm-free-concepts.v1')
  }
  if (!Array.isArray(raw.themes)) errors.push('themes: must be array')
  else raw.themes.forEach((c, i) => validateConcept(c, `themes[${i}]`, errors))
  if (!Array.isArray(raw.devices)) errors.push('devices: must be array')
  else raw.devices.forEach((c, i) => validateConcept(c, `devices[${i}]`, errors))
  if (!('annotation_interpretation' in raw)) {
    errors.push('annotation_interpretation: required (object or null)')
  } else {
    validateAnnotation(raw.annotation_interpretation, errors)
  }
  if (raw.notes != null && typeof raw.notes !== 'string') {
    errors.push('notes: must be string when present')
  }
  for (const k of Object.keys(raw)) {
    if (!['schema_version', 'themes', 'devices', 'annotation_interpretation', 'notes'].includes(k)) {
      errors.push(`root: unexpected property ${k}`)
    }
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, value: raw as LlmFreeConceptsV1 }
}

export function assertAnnotationPresence(
  value: LlmFreeConceptsV1,
  hasPersonalAnnotation: boolean
): string[] {
  const errors: string[] = []
  if (hasPersonalAnnotation && value.annotation_interpretation == null) {
    errors.push('annotation_interpretation: required when Personal Annotation is present')
  }
  if (!hasPersonalAnnotation && value.annotation_interpretation != null) {
    errors.push('annotation_interpretation: must be null when no Personal Annotation')
  }
  return errors
}

export type { AnnotationInterpretationV1 }
