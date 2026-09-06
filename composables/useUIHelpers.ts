// =====================================================
// File: composables/useUIHelpers.ts
// 标题：UI 辅助函数
// 说明：文本处理、格式化等 UI 相关的辅助函数
// =====================================================

/**
 * 移除句子文本中的 ID 前缀（如 [ZH01]、[EN01]）
 * 格式：[XX##] 后跟空格
 */
export function removeIdPrefix(text: string): string {
  // 匹配格式：[两个大写字母 + 数字 + ] + 空格
  return text.replace(/^\[[A-Z]{2}\d+\]\s*/, '')
}

/**
 * 截断文本，并在末尾添加省略号
 * 改进：在单词边界截断（如果可能），避免在单词中间截断
 */
export function truncate(text: string, max = 300): string {
  // 先移除 ID 前缀，再截断
  const cleanedText = removeIdPrefix(text)
  
  if (cleanedText.length <= max) {
    return cleanedText
  }
  
  // 尝试在单词边界截断（适用于英文）
  // 查找最后一个空格、句号、问号、感叹号等标点符号
  const truncated = cleanedText.slice(0, max)
  const lastSpace = truncated.lastIndexOf(' ')
  const lastPunctuation = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?'),
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？')
  )
  
  // 如果找到标点符号，且在最后50个字符内，则在标点符号后截断
  const cutoff = Math.max(lastPunctuation, lastSpace)
  if (cutoff > max - 50 && cutoff > max * 0.8) {
    return cleanedText.slice(0, cutoff + 1) + '…'
  }
  
  // 否则在单词边界截断（如果有空格）
  if (lastSpace > max * 0.8) {
    return cleanedText.slice(0, lastSpace) + '…'
  }
  
  // 如果找不到合适的截断点，直接截断
  return truncated + '…'
}

/**
 * 如果提供了 emoji，则在标签前添加 emoji
 */
export function prependEmoji(emoji: string | undefined, label: string): string {
  if (!emoji) return label
  return `${emoji} ${label}`
}

/**
 * 拆分 chip 展示：国旗等 emoji 需单独用 emoji 字体渲染，
 * 否则在 Merriweather / 部分中文字体下会变成 GB、DE 这类字母。
 */
export function chipDisplayParts(
  emoji: string | null | undefined,
  label: string
): { emoji?: string; text: string } {
  const e = emoji?.trim()
  if (!e) return { text: label }
  return { emoji: e, text: label }
}

/**
 * 从「emoji + 文案」整串里拆出开头的 emoji（供飞行 chip 等已拼接的 label 使用）
 */
export function splitLeadingEmoji(label: string): { emoji?: string; text: string } {
  const raw = label.trim()
  if (!raw) return { text: label }

  const chars = [...raw]
  let i = 0
  // 国旗：两个区域指示符
  const isRI = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff
  const first = chars[0]?.codePointAt(0)
  if (first != null && isRI(first) && chars.length >= 2) {
    const second = chars[1]?.codePointAt(0)
    if (second != null && isRI(second)) {
      i = 2
    }
  }
  if (i === 0) {
    // 普通 emoji（含可选 FE0F）
    const cp = first
    if (cp != null && cp > 0xff) {
      i = 1
      if (chars[1]?.codePointAt(0) === 0xfe0f) i = 2
    }
  }
  if (i === 0) return { text: raw }
  const emoji = chars.slice(0, i).join('')
  const text = chars.slice(i).join('').trim()
  return { emoji, text: text || raw }
}

