// =====================================================
// File: composables/useHistory.ts
// 标题：搜索条件历史记录管理（撤销/恢复功能）
// 说明：跟踪搜索条件的变化历史，支持撤销和恢复操作
// =====================================================

export type FilterState = {
  q: string
  authors: string[]
  books: string[]
  genres: string[]
  times: string[]
  themes: string[]
  devices: string[]
  timesAll: boolean
  themesAll: boolean
  devicesAll: boolean
}

/**
 * 创建搜索条件状态的深拷贝
 */
function cloneState(state: FilterState): FilterState {
  return {
    q: state.q,
    authors: [...state.authors],
    books: [...state.books],
    genres: [...state.genres],
    times: [...state.times],
    themes: [...state.themes],
    devices: [...state.devices],
    timesAll: state.timesAll,
    themesAll: state.themesAll,
    devicesAll: state.devicesAll
  }
}

/**
 * 判断两个状态是否相同
 */
function isStateEqual(a: FilterState, b: FilterState): boolean {
  // 辅助函数：比较两个数组是否包含相同的元素（顺序无关）
  const arraysEqual = (arr1: string[], arr2: string[]): boolean => {
    if (arr1.length !== arr2.length) return false
    const set1 = new Set(arr1)
    const set2 = new Set(arr2)
    if (set1.size !== set2.size) return false
    for (const item of set1) {
      if (!set2.has(item)) return false
    }
    return true
  }

  return (
    a.q === b.q &&
    arraysEqual(a.authors, b.authors) &&
    arraysEqual(a.books, b.books) &&
    arraysEqual(a.genres, b.genres) &&
    arraysEqual(a.times, b.times) &&
    arraysEqual(a.themes, b.themes) &&
    arraysEqual(a.devices, b.devices) &&
    a.timesAll === b.timesAll &&
    a.themesAll === b.themesAll &&
    a.devicesAll === b.devicesAll
  )
}

export function useHistory() {
  // 历史记录栈（当前状态在栈顶）
  const history = ref<FilterState[]>([])
  // 当前位置索引（-1 表示在最新状态）
  const currentIndex = ref(-1)

  /**
   * 保存当前状态到历史记录
   */
  function saveState(state: FilterState) {
    const current = currentIndex.value >= 0 
      ? history.value[currentIndex.value] 
      : null

    // 如果新状态与当前状态相同，不保存
    if (current && isStateEqual(current, state)) {
      return
    }

    // 如果当前位置不在栈顶，删除当前位置之后的所有历史
    if (currentIndex.value >= 0 && currentIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, currentIndex.value + 1)
    }

    // 添加新状态到历史记录
    history.value.push(cloneState(state))
    currentIndex.value = history.value.length - 1

    // 限制历史记录数量（最多保存 50 条）
    if (history.value.length > 50) {
      history.value.shift()
      currentIndex.value = history.value.length - 1
    }
  }

  /**
   * 撤销：回到上一个状态
   */
  function undo(): FilterState | null {
    if (currentIndex.value > 0) {
      currentIndex.value--
      return cloneState(history.value[currentIndex.value])
    }
    return null
  }

  /**
   * 恢复：前进到下一个状态
   */
  function redo(): FilterState | null {
    if (currentIndex.value < history.value.length - 1) {
      currentIndex.value++
      return cloneState(history.value[currentIndex.value])
    }
    return null
  }

  /**
   * 检查是否可以撤销
   */
  const canUndo = computed(() => currentIndex.value > 0)

  /**
   * 检查是否可以恢复
   */
  const canRedo = computed(() => currentIndex.value < history.value.length - 1)

  /**
   * 初始化历史记录（保存初始状态）
   */
  function init(state: FilterState) {
    history.value = [cloneState(state)]
    currentIndex.value = 0
  }

  return {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    init
  }
}

