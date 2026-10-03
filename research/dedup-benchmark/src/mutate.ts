// =====================================================
// Deterministic mutation helpers for benchmark cases
// =====================================================

import type { MutationType } from './types.ts'

export type MutResult = {
  text: string
  params: Record<string, string | number | boolean>
  ok: boolean
  reason?: string
}

const CN_OPEN = '“'
const CN_CLOSE = '”'

export function mutExact(text: string): MutResult {
  return { text, params: {}, ok: true }
}

export function mutWhitespace(text: string, kind: 0 | 1 | 2 | 3): MutResult {
  let out = text
  if (kind === 0) out = `  ${text}  `
  else if (kind === 1) out = text.replace(/\s+/g, '  ').replace(/，/g, '， ')
  else if (kind === 2) out = text.replace(/。/g, '。\n')
  else out = `${text}\n`
  return { text: out, params: { kind }, ok: out !== text || kind === 0 }
}

/** Map a few ASCII punctuation chars to full-width equivalents. */
export function mutUnicodeWidth(text: string): MutResult {
  const map: Record<string, string> = {
    ',': '，',
    '.': '．',
    '!': '！',
    '?': '？',
    ':': '：',
    ';': '；',
    '(': '（',
    ')': '）'
  }
  let changed = false
  const out = [...text]
    .map((ch) => {
      if (map[ch]) {
        changed = true
        return map[ch]!
      }
      // half-width digit → full-width
      const code = ch.charCodeAt(0)
      if (code >= 0x30 && code <= 0x39) {
        changed = true
        return String.fromCharCode(code + 0xfee0)
      }
      return ch
    })
    .join('')
  if (!changed) {
    // Force a benign full-width space insertion after first comma/顿号 if present
    const i = text.search(/[，、]/)
    if (i >= 0) {
      const forced = text.slice(0, i + 1) + '\u3000' + text.slice(i + 1)
      return { text: forced, params: { mode: 'ideographic_space' }, ok: true }
    }
    return { text, params: {}, ok: false, reason: 'no width transform site' }
  }
  return { text: out, params: { mode: 'ascii_to_fullwidth' }, ok: true }
}

export function mutOuterQuotes(text: string, mode: 'add' | 'remove'): MutResult {
  const t = text.trim()
  if (mode === 'add') {
    if (/^[“"「]/.test(t) && /[”"」]$/.test(t)) {
      return { text, params: { mode }, ok: false, reason: 'already quoted' }
    }
    return {
      text: `${CN_OPEN}${t}${CN_CLOSE}`,
      params: { mode },
      ok: true
    }
  }
  const stripped = t
    .replace(/^[“”"「」『』]+/, '')
    .replace(/[“”"「」『』]+$/, '')
    .trim()
  if (stripped === t) {
    return { text, params: { mode }, ok: false, reason: 'no outer quotes' }
  }
  return { text: stripped, params: { mode }, ok: true }
}

export function mutPunctuation(
  text: string,
  kind: 'period_to_excl' | 'period_to_q' | 'excl_to_period'
): MutResult {
  if (kind === 'period_to_excl' && text.includes('。')) {
    return {
      text: text.replace('。', '！'),
      params: { kind },
      ok: true
    }
  }
  if (kind === 'period_to_q' && text.includes('。')) {
    return {
      text: text.replace('。', '？'),
      params: { kind },
      ok: true
    }
  }
  if (kind === 'excl_to_period' && text.includes('！')) {
    return {
      text: text.replace('！', '。'),
      params: { kind },
      ok: true
    }
  }
  return { text, params: { kind }, ok: false, reason: 'no target punct' }
}

export function mutPrefixExpand(text: string, size: 1 | 2 | 3): MutResult {
  const prefixes = [
    '他说：',
    '她想：',
    '于是他低声说：'
  ] as const
  const p = prefixes[size - 1]!
  return {
    text: `${p}${CN_OPEN}${text}${CN_CLOSE}`,
    params: { size, prefix: p },
    ok: true
  }
}

export function mutSuffixExpand(text: string, size: 1 | 2 | 3): MutResult {
  const suffixes = [
    '——他这样想着。',
    '这就是他当时唯一的感受。',
    '这句话后来常常在他耳边回响。'
  ] as const
  const s = suffixes[size - 1]!
  return { text: `${text}${s}`, params: { size, suffix: s }, ok: true }
}

export function mutPrefixTrunc(text: string, nChars: number): MutResult {
  if (text.length <= nChars + 4) {
    return { text, params: { nChars }, ok: false, reason: 'too short' }
  }
  return { text: text.slice(nChars), params: { nChars }, ok: true }
}

export function mutSuffixTrunc(text: string, nChars: number): MutResult {
  if (text.length <= nChars + 4) {
    return { text, params: { nChars }, ok: false, reason: 'too short' }
  }
  return { text: text.slice(0, text.length - nChars), params: { nChars }, ok: true }
}

/** Split on Chinese/ASCII sentence terminators keeping delimiters with previous clause. */
export function splitSentences(text: string): string[] {
  const parts = text.match(/[^。！？!?]+[。！？!?]?/g)
  if (!parts) return [text]
  return parts.map((p) => p.trim()).filter(Boolean)
}

export function mutSentenceSelect(text: string, indexFromEnd = 0): MutResult {
  const sents = splitSentences(text)
  if (sents.length < 2) {
    return { text, params: { indexFromEnd }, ok: false, reason: 'not multi-sentence' }
  }
  const idx = Math.max(0, sents.length - 1 - indexFromEnd)
  return {
    text: sents[idx]!,
    params: { indexFromEnd, sentence_count: sents.length },
    ok: true
  }
}

const SUBSTITUTIONS: Array<[RegExp, string, string]> = [
  [/慢慢地/, '缓缓地', '慢慢地→缓缓地'],
  [/忽然/, '突然', '忽然→突然'],
  [/然而/, '可是', '然而→可是'],
  [/看着/, '望着', '看着→望着'],
  [/说道/, '说', '说道→说'],
  [/已经/, '早已', '已经→早已'],
  [/非常/, '十分', '非常→十分'],
  [/因为/, '由于', '因为→由于']
]

export function mutCharSubstitution(text: string): MutResult {
  for (const [re, repl, label] of SUBSTITUTIONS) {
    if (re.test(text)) {
      return {
        text: text.replace(re, repl),
        params: { substitution: label },
        ok: true
      }
    }
  }
  return { text, params: {}, ok: false, reason: 'no substitution site' }
}

const INDELS: Array<{ find: RegExp; insert?: string; remove?: boolean; label: string }> = [
  { find: /地/, insert: undefined, remove: false, label: 'insert_也_after_first_punct' },
  { find: /了/, remove: true, label: 'delete_first_了' },
  { find: /着/, remove: true, label: 'delete_first_着' }
]

export function mutSmallIndel(text: string, mode: 0 | 1 | 2): MutResult {
  if (mode === 0) {
    const i = text.search(/[，。]/)
    if (i >= 0) {
      const out = text.slice(0, i) + '也' + text.slice(i)
      return { text: out, params: { mode, label: 'insert_也' }, ok: true }
    }
  }
  if (mode === 1 && text.includes('了')) {
    return {
      text: text.replace('了', ''),
      params: { mode, label: 'delete_了' },
      ok: true
    }
  }
  if (mode === 2 && text.includes('着')) {
    return {
      text: text.replace('着', ''),
      params: { mode, label: 'delete_着' },
      ok: true
    }
  }
  // fallback: insert comma pause
  if (text.length > 8) {
    const mid = Math.floor(text.length / 2)
    const out = text.slice(0, mid) + '，' + text.slice(mid)
    return { text: out, params: { mode, label: 'insert_comma_mid' }, ok: true }
  }
  return { text, params: { mode }, ok: false, reason: 'no indel site' }
}

export function mutMultiEdition(text: string): MutResult {
  let t = text
  const applied: string[] = []
  const sub = mutCharSubstitution(t)
  if (sub.ok) {
    t = sub.text
    applied.push(String(sub.params.substitution || 'sub'))
  }
  const indel = mutSmallIndel(t, 0)
  if (indel.ok) {
    t = indel.text
    applied.push(String(indel.params.label || 'indel'))
  }
  const punct = mutPunctuation(t, 'period_to_excl')
  if (punct.ok) {
    t = punct.text
    applied.push('punct')
  }
  if (t === text) {
    return { text, params: {}, ok: false, reason: 'no combined edits' }
  }
  return { text: t, params: { applied: applied.join('+') }, ok: true }
}

/** Negation trap: insert 不 after a pronoun/verb cue when possible. */
export function mutNegation(text: string): MutResult {
  const patterns: Array<[RegExp, string]> = [
    [/他相信/, '他不相信'],
    [/她相信/, '她不相信'],
    [/他知道/, '他不知道'],
    [/她知道/, '她不知道'],
    [/他想/, '他不想'],
    [/她想/, '她不想'],
    [/是/, '不是'],
    [/会/, '不会'],
    [/能/, '不能']
  ]
  for (const [re, repl] of patterns) {
    if (re.test(text)) {
      return {
        text: text.replace(re, repl),
        params: { pattern: re.source },
        ok: true
      }
    }
  }
  return { text, params: {}, ok: false, reason: 'no negation site' }
}

export function mutSubjectSwap(text: string): MutResult {
  if (text.includes('他') && !text.includes('她')) {
    return {
      text: text.replace(/他/g, '她'),
      params: { swap: '他→她' },
      ok: true
    }
  }
  if (text.includes('她') && !text.includes('他')) {
    return {
      text: text.replace(/她/g, '他'),
      params: { swap: '她→他' },
      ok: true
    }
  }
  if (text.includes('我') && text.includes('他')) {
    return {
      text: text.replace(/我/g, '他').replace(/他/g, '我'),
      params: { swap: '我↔他_naive' },
      ok: false,
      reason: 'ambiguous swap skipped'
    }
  }
  return { text, params: {}, ok: false, reason: 'no subject swap site' }
}

export function mutEntitySwap(text: string): MutResult {
  const pairs: Array<[RegExp, string, string]> = [
    [/雨/, '雪', '雨→雪'],
    [/雪/, '雨', '雪→雨'],
    [/春天/, '秋天', '春天→秋天'],
    [/夜晚/, '清晨', '夜晚→清晨'],
    [/左边/, '右边', '左边→右边'],
    [/一/, '两', '一→两'],
    [/二/, '三', '二→三']
  ]
  for (const [re, repl, label] of pairs) {
    if (re.test(text)) {
      return {
        text: text.replace(re, repl),
        params: { entity: label },
        ok: true
      }
    }
  }
  return { text, params: {}, ok: false, reason: 'no entity site' }
}

export function mutLexicalOverlapMeaning(
  text: string
): MutResult {
  // Prefer entity or subject swap as "high overlap different meaning"
  const e = mutEntitySwap(text)
  if (e.ok) return { ...e, params: { ...e.params, family: 'entity' } }
  const s = mutSubjectSwap(text)
  if (s.ok) return { ...s, params: { ...s.params, family: 'subject' } }
  return { text, params: {}, ok: false, reason: 'no lexical-overlap site' }
}

export function wrapMutation(
  type: MutationType,
  text: string,
  fn: () => MutResult
): MutResult {
  const r = fn()
  return { ...r, params: { ...r.params, mutation_type: type } }
}
