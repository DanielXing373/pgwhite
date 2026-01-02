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

