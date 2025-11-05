// =====================================================
// File: composables/useHistoryManagement.ts
// 标题：历史记录管理（撤销/恢复功能）
// 说明：管理搜索条件的历史记录，支持撤销和恢复操作
// =====================================================
import { useHistory, type FilterState } from './useHistory'

export function useHistoryManagement(
  getCurrentState: () => FilterState,
  applyState: (state: FilterState) => void
) {
  const history = useHistory()
  // 标记是否正在执行撤销/恢复操作（避免触发历史记录保存）
  const isApplyingHistory = ref(false)

  // 初始化历史记录（保存初始状态）
  onMounted(() => {
    history.init(getCurrentState())
  })

  // 监听搜索条件变化，保存到历史记录（延迟保存，避免频繁记录）
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  
  function setupHistoryWatcher(
    watchTargets: any[],
    getCurrentStateFn: () => FilterState,
    saveStateFn: (state: FilterState) => void
  ) {
    watch(watchTargets, () => {
      // 如果正在应用历史记录，不保存
      if (isApplyingHistory.value) {
        return
      }
      
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveStateFn(getCurrentStateFn())
      }, 300)
    }, { deep: true })
  }

  /**
   * 撤销操作
   */
  function handleUndo() {
    const state = history.undo()
    if (state) {
      isApplyingHistory.value = true
      applyState(state)
      // 使用 nextTick 确保状态更新完成后再重置标记
      nextTick(() => {
        isApplyingHistory.value = false
      })
    }
  }

  /**
   * 恢复操作
   */
  function handleRedo() {
    const state = history.redo()
    if (state) {
      isApplyingHistory.value = true
      applyState(state)
      // 使用 nextTick 确保状态更新完成后再重置标记
      nextTick(() => {
        isApplyingHistory.value = false
      })
    }
  }

  return {
    history,
    isApplyingHistory,
    setupHistoryWatcher,
    handleUndo,
    handleRedo
  }
}

