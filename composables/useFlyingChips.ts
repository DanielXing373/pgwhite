// =====================================================
// File: composables/useFlyingChips.ts
// 标题：飞行标签管理
// 说明：管理"飞行标签"动画的状态和操作
// =====================================================

export type FlyingChip = {
  id: string // 唯一标识：`${dimension}-${tagId}`
  tagLabel: string
  dimension: string
  start: { x: number; y: number }
  end: { x: number; y: number }
}

const flyingChips = ref<FlyingChip[]>([])

/**
 * 触发飞行动画
 * @param tagId 标签ID
 * @param dimension 维度（authors, books, etc.）
 * @param tagLabel 标签文本
 * @param startRect 起始位置（DOM元素的getBoundingClientRect）
 * @param endRect 目标位置（DOM元素的getBoundingClientRect）
 */
export function triggerFly(
  tagId: string,
  dimension: string,
  tagLabel: string,
  startRect: DOMRect,
  endRect: DOMRect
) {
  const id = `${dimension}-${tagId}`
  
  // 计算起始和结束位置（相对于视口）
  const start = {
    x: startRect.left + startRect.width / 2,
    y: startRect.top + startRect.height / 2
  }
  
  const end = {
    x: endRect.left + endRect.width / 2,
    y: endRect.top + endRect.height / 2
  }
  
  // 如果目标位置在屏幕外，调整到最近的屏幕边缘
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  if (end.x < 0 || end.x > viewportWidth || end.y < 0 || end.y > viewportHeight) {
    // 计算到最近屏幕边缘的向量
    const centerX = viewportWidth / 2
    const centerY = viewportHeight / 2
    
    // 如果目标在屏幕外，使用屏幕中心作为临时目标
    end.x = Math.max(0, Math.min(viewportWidth, end.x))
    end.y = Math.max(0, Math.min(viewportHeight, end.y))
  }
  
  const newChip = {
    id,
    tagLabel,
    dimension,
    start,
    end
  }
  
  // 检查是否已存在
  const existingIndex = flyingChips.value.findIndex(c => c.id === id)
  if (existingIndex !== -1) {
    console.warn('⚠️ Chip already exists, replacing:', id)
    flyingChips.value[existingIndex] = newChip
  } else {
    flyingChips.value.push(newChip)
  }
  
  console.log('✈️ useFlyingChips: Added chip to array', {
    chip: newChip,
    totalChips: flyingChips.value.length,
    array: [...flyingChips.value] // 创建副本以便调试
  })
  
  // 验证数组确实被更新了
  nextTick(() => {
    console.log('✅ After nextTick, array length:', flyingChips.value.length)
  })
}

/**
 * 移除飞行中的标签（用于取消或清理）
 * @param tagId 标签ID
 * @param dimension 维度
 */
export function removeGhost(tagId: string, dimension: string) {
  const id = `${dimension}-${tagId}`
  const index = flyingChips.value.findIndex(chip => chip.id === id)
  if (index !== -1) {
    flyingChips.value.splice(index, 1)
  }
}

/**
 * 根据完整ID移除飞行中的标签
 * @param fullId 完整ID（格式：dimension-tagId）
 */
export function removeGhostById(fullId: string) {
  const index = flyingChips.value.findIndex(chip => chip.id === fullId)
  if (index !== -1) {
    flyingChips.value.splice(index, 1)
  }
}

/**
 * 移除所有飞行中的标签
 */
export function clearAllGhosts() {
  flyingChips.value = []
}

/**
 * 获取当前所有飞行中的标签
 */
export function useFlyingChips() {
  return {
    flyingChips, // 直接返回响应式引用，不使用 readonly
    triggerFly,
    removeGhost,
    removeGhostById,
    clearAllGhosts
  }
}

