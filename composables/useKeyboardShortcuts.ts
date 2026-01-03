// =====================================================
// File: composables/useKeyboardShortcuts.ts
// 标题：键盘快捷键管理
// 说明：处理全局键盘快捷键（撤销/恢复/翻页）
// =====================================================
import { onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'

export function useKeyboardShortcuts(
  onUndo: () => void,
  onRedo: () => void,
  paginationOptions?: {
    currentPage: Ref<number>
    totalPages: ComputedRef<number>
    onPageChange: (page: number) => void
  }
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
      
      // 撤销/恢复快捷键
      if (isModifierKey && event.key === 'z' && !event.shiftKey) {
        // Command/Ctrl + Z: 撤销
        event.preventDefault()
        onUndo()
        return
      } else if (isModifierKey && event.key === 'z' && event.shiftKey) {
        // Command/Ctrl + Shift + Z: 恢复
        event.preventDefault()
        onRedo()
        return
      }
      
      // 翻页快捷键（左右箭头键）
      if (paginationOptions) {
        const { currentPage, totalPages, onPageChange } = paginationOptions
        
        // 检查是否有结果可以翻页
        if (totalPages.value <= 0) {
          return // 没有结果，不处理翻页
        }
        
        // 检查是否只有一页
        if (totalPages.value === 1) {
          return // 只有一页，不需要翻页
        }
        
        if (event.key === 'ArrowLeft') {
          // 左箭头：上一页
          event.preventDefault()
          if (currentPage.value > 1) {
            onPageChange(currentPage.value - 1)
          }
          return
        } else if (event.key === 'ArrowRight') {
          // 右箭头：下一页
          event.preventDefault()
          if (currentPage.value < totalPages.value) {
            onPageChange(currentPage.value + 1)
          }
          return
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    
    // 清理事件监听器
    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeyDown)
    })
  })
}

