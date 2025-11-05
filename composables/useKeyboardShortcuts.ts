// =====================================================
// File: composables/useKeyboardShortcuts.ts
// 标题：键盘快捷键管理
// 说明：处理全局键盘快捷键（撤销/恢复）
// =====================================================

export function useKeyboardShortcuts(
  onUndo: () => void,
  onRedo: () => void
) {
  onMounted(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 检查是否在输入框中（忽略输入框中的快捷键）
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      
      // Mac: Command, Windows/Linux: Control
      const isModifierKey = event.metaKey || event.ctrlKey
      
      if (isModifierKey && event.key === 'z' && !event.shiftKey) {
        // Command/Ctrl + Z: 撤销
        event.preventDefault()
        onUndo()
      } else if (isModifierKey && event.key === 'z' && event.shiftKey) {
        // Command/Ctrl + Shift + Z: 恢复
        event.preventDefault()
        onRedo()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    
    // 清理事件监听器
    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeyDown)
    })
  })
}

