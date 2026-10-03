// =====================================================
// Matching normalization — does NOT alter stored Quote text
// =====================================================

export function unicodeNfc(s: string): string {
  return s.normalize('NFC')
}

export function toHalfWidthAscii(s: string): string {
  return [...s]
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (code === 0x3000) return ' '
      if (code >= 0xff01 && code <= 0xff5e) {
        return String.fromCharCode(code - 0xfee0)
      }
      return ch
    })
    .join('')
}

export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Strip outer quotation marks only (Chinese + ASCII).
 * Does not strip Chinese sentence punctuation.
 */
export function stripOuterQuotes(s: string): string {
  let t = s.trim()
  for (let i = 0; i < 3; i++) {
    const before = t
    t = t.replace(/^[“”"「」『』‘’']+/, '').replace(/[“”"「」『』‘’']+$/, '')
    t = t.trim()
    if (t === before) break
  }
  return t
}

/** Safe normalize used for MATCHED exact equality. */
export function matchingNormalize(s: string): string {
  return stripOuterQuotes(
    normalizeWhitespace(toHalfWidthAscii(unicodeNfc(s)))
  )
}

/** Alias used by research benchmark harness. */
export const researchNormalize = matchingNormalize
