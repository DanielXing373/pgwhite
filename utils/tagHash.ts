/** 去空白与常见中英标点后再比较，用于 Wizard of Oz 的「很像也算重复」。 */
export function normalizeQuoteText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。、「」『』""''！？、；：,.!?;:…—–\-]/g, '')
}

export function quoteTextHash(text: string): string {
  const n = normalizeQuoteText(text)
  let h = 5381
  for (let i = 0; i < n.length; i++) {
    h = ((h << 5) + h) + n.charCodeAt(i)
    h |= 0
  }
  return `h${(h >>> 0).toString(16)}`
}
