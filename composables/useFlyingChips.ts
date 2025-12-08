// =====================================================
// File: composables/useFlyingChips.ts
// 标题：飞行标签管理
// 说明：管理"飞行标签"动画的状态和操作
// =====================================================

export type FlyingChip = {
  id: string // 唯一标识：每个飞行实例都有唯一的ID
  tagId: string // 原始标签ID（用于查找和移除）
  tagLabel: string
  dimension: string
  start: { x: number; y: number }
  end: { x: number; y: number }
}

/**
 * 获取当前所有飞行中的标签
 * 使用 Nuxt 的 useState 确保状态在 SSR 和客户端之间持久化
 * 即使组件重新挂载，状态也会保持
 */
export function useFlyingChips() {
  // useState 必须在 setup 函数内部调用
  // 使用固定的 key 确保所有调用都返回同一个状态实例
  const flyingChips = useState<FlyingChip[]>('flying-chips', () => [])
  
  // 调试：追踪状态变化
  watch(() => flyingChips.value, (newChips, oldChips) => {
    if (newChips.length !== (oldChips?.length || 0)) {
      console.log('🔔 useFlyingChips: Array length changed', {
        from: oldChips?.length || 0,
        to: newChips.length,
        newChips: newChips.map(c => ({ id: c.id, tagId: c.tagId })),
        oldChips: oldChips?.map(c => ({ id: c.id, tagId: c.tagId })) || [],
        stackTrace: new Error().stack
      })
    }
  }, { deep: true })
  
  /**
   * 触发飞行动画
   * @param tagId 标签ID
   * @param dimension 维度（authors, books, etc.）
   * @param tagLabel 标签文本
   * @param startRect 起始位置（DOM元素的getBoundingClientRect）
   * @param endRect 目标位置（DOM元素的getBoundingClientRect）
   */
  function triggerFly(
    tagId: string,
    dimension: string,
    tagLabel: string,
    startRect: DOMRect,
    endRect: DOMRect
  ) {
    // 为每个飞行实例生成唯一ID（使用时间戳和随机数）
    // 这样可以支持同一个tag的多个并发飞行实例
    const uniqueId = `${dimension}-${tagId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // 计算起始和结束位置（相对于视口）
    // 在触发飞行前就计算好坐标，避免后续DOM变化影响
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
    
    const newChip: FlyingChip = {
      id: uniqueId, // 唯一实例ID
      tagId, // 原始标签ID（用于查找）
      tagLabel,
      dimension,
      start,
      end
    }
    
    // 直接push，不检查重复（因为每个实例都有唯一ID）
    flyingChips.value.push(newChip)
    
    console.log('✈️ useFlyingChips: Added chip to array', {
      chip: newChip,
      totalChips: flyingChips.value.length,
      array: flyingChips.value.map(c => ({ id: c.id, tagId: c.tagId })) // 创建副本以便调试
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
   * @param removeAll 如果为true，移除所有匹配的飞行实例；如果为false，只移除第一个匹配的实例
   */
  function removeGhost(tagId: string, dimension: string, removeAll: boolean = false) {
    if (removeAll) {
      // 移除所有匹配的飞行实例（用于取消选择时）
      const initialLength = flyingChips.value.length
      flyingChips.value = flyingChips.value.filter(chip => 
        !(chip.tagId === tagId && chip.dimension === dimension)
      )
      const removedCount = initialLength - flyingChips.value.length
      if (removedCount > 0) {
        console.log(`🗑️ removeGhost: Removed ${removedCount} instance(s) for ${dimension}-${tagId}`)
      }
    } else {
      // 只移除第一个匹配的实例（用于动画完成时）
      const index = flyingChips.value.findIndex(chip => 
        chip.tagId === tagId && chip.dimension === dimension
      )
      if (index !== -1) {
        flyingChips.value.splice(index, 1)
        console.log(`🗑️ removeGhost: Removed one instance for ${dimension}-${tagId}`)
      }
    }
  }

  /**
   * 根据唯一实例ID移除飞行中的标签
   * @param uniqueId 唯一实例ID（由triggerFly生成）
   */
  function removeGhostById(uniqueId: string) {
    const index = flyingChips.value.findIndex(chip => chip.id === uniqueId)
    if (index !== -1) {
      flyingChips.value.splice(index, 1)
      console.log(`🗑️ removeGhostById: Removed instance ${uniqueId}`)
    } else {
      console.warn(`⚠️ removeGhostById: Instance not found ${uniqueId}`)
    }
  }

  /**
   * 移除所有飞行中的标签
   */
  function clearAllGhosts() {
    flyingChips.value = []
  }
  
  return {
    flyingChips, // 直接返回响应式引用，不使用 readonly
    triggerFly,
    removeGhost,
    removeGhostById,
    clearAllGhosts
  }
}

