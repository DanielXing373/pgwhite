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
 */
export function truncate(text: string, max = 200): string {
  // 先移除 ID 前缀，再截断
  const cleanedText = removeIdPrefix(text)
  return cleanedText.length <= max ? cleanedText : cleanedText.slice(0, max) + '…'
}

