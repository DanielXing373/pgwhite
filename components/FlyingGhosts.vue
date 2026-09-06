<!-- =====================================================
File: components/FlyingGhosts.vue
标题：飞行标签组件
说明：渲染飞行中的"幽灵标签"，使用抛物线动画
====================================================== -->
<template>
  <Teleport to="body">
    <div
      v-for="chip in flyingChips"
      :key="chip.id"
      v-memo="[chip.id, chip.start.x, chip.start.y]"
      class="flying-ghost-wrapper"
      :data-chip-id="chip.id"
      :style="{
        left: `${chip.start.x}px`,
        top: `${chip.start.y}px`,
        zIndex: 9999
      }"
    >
      <!-- 外层：X轴线性移动 -->
      <!-- 注意：不使用 :style="getOuterStyle(chip)" 避免每次渲染都创建新对象 -->
      <div
        :ref="el => setOuterRef(chip.id, el)"
        class="flying-ghost-outer"
        style="transform: translateX(0px); transition: none;"
      >
        <!-- 内层：Y轴抛物线移动 -->
        <!-- 注意：不使用 :style="getInnerStyle(chip)" 避免每次渲染都创建新对象 -->
        <div
          :ref="el => setInnerRef(chip.id, el)"
          class="flying-ghost-inner"
          style="transform: translateY(0px); transition: none;"
        >
          <!-- 幽灵标签（样式与选中标签一致） -->
          <span
            :class="[
              'flying-ghost-chip',
              `flying-ghost-chip--${chip.dimension}`
            ]"
          >
            <template v-for="parts in [labelParts(chip.tagLabel)]" :key="`${chip.id}-label`">
              <ChipEmoji v-if="parts.emoji" :emoji="parts.emoji" />
              <span>{{ parts.text }}</span>
            </template>
          </span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import { useFlyingChips } from '~/composables/useFlyingChips'
import type { FlyingChip } from '~/composables/useFlyingChips'
import { splitLeadingEmoji } from '~/composables/useUIHelpers'

const flyingChipsStore = useFlyingChips()
const flyingChips = flyingChipsStore.flyingChips // 确保使用响应式引用

function labelParts(tagLabel: string) {
  return splitLeadingEmoji(tagLabel)
}

// 生命周期追踪（已禁用，仅在需要调试时启用）
// const componentId = `FlyingGhosts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
// onMounted(() => {
//   console.log('🟢 FlyingGhosts MOUNTED:', { componentId, initialChips: flyingChips.value.length })
// })
// onBeforeUnmount(() => {
//   console.warn('🟡 FlyingGhosts BEFORE UNMOUNT:', { componentId, activeChips: flyingChips.value.length })
// })
// onUnmounted(() => {
//   console.error('🔴 FlyingGhosts UNMOUNTED:', { componentId, activeChips: flyingChips.value.length })
// })

// 动画持续时间（毫秒）
const DURATION = 550

// 存储每个chip的ref和动画状态
const outerRefs = new Map<string, HTMLElement | null>()
const innerRefs = new Map<string, HTMLElement | null>()
const animatingChips = ref(new Set<string>())

function setOuterRef(chipId: string, el: any) {
  const htmlEl = el as HTMLElement | null
  if (htmlEl) {
    outerRefs.set(chipId, htmlEl)
    // 如果chip已经在flyingChips中但还没开始动画，立即启动
    if (flyingChips.value.some(c => c.id === chipId) && !animatingChips.value.has(chipId)) {
      startAnimation(chipId)
    }
  } else {
    outerRefs.delete(chipId)
  }
}

function setInnerRef(chipId: string, el: any) {
  const htmlEl = el as HTMLElement | null
  innerRefs.set(chipId, htmlEl)
}

function startAnimation(chipId: string) {
  if (animatingChips.value.has(chipId)) {
    return // 已经在动画中
  }
  
  const chip = flyingChips.value.find(c => c.id === chipId)
  if (!chip) {
    // console.error('❌ Chip not found:', chipId)
    return
  }
  
  // 先设置动画状态为true，触发样式更新
  animatingChips.value.add(chipId)
  
  // 等待DOM更新和下一帧，确保初始状态已渲染，然后触发transition
  nextTick(() => {
    requestAnimationFrame(() => {
      const outerEl = outerRefs.get(chipId)
      const innerEl = innerRefs.get(chipId)
      
      if (outerEl && innerEl) {
        const deltaX = chip.end.x - chip.start.x
        const deltaY = chip.end.y - chip.start.y
        
        // 第一步：清除所有 transition 和 transform，设置初始状态
        outerEl.style.transition = 'none'
        innerEl.style.transition = 'none'
        outerEl.style.transform = 'translateX(0px)'
        innerEl.style.transform = 'translateY(0px)'
        
        // 强制浏览器应用初始状态（同步渲染）
        void outerEl.offsetWidth
        void innerEl.offsetWidth
        
        // 第二步：在下一帧设置 transition 和最终状态
        requestAnimationFrame(() => {
          // 设置 transition
          outerEl.style.transition = `transform ${DURATION}ms linear`
          innerEl.style.transition = `transform ${DURATION}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
          
          // 再次强制重新计算，确保 transition 已设置
          void outerEl.offsetWidth
          void innerEl.offsetWidth
          
          // 第三步：在下一帧应用最终 transform，触发 transition
          requestAnimationFrame(() => {
            // 应用最终transform
            outerEl.style.transform = `translateX(${deltaX}px)`
            innerEl.style.transform = `translateY(${deltaY}px)`
            
            // 监听动画结束 - 使用一个共享的标记来确保只处理一次
            let transitionEnded = false
            let cleanupDone = false
            let fallbackTimeout: ReturnType<typeof setTimeout> | null = null
            
            // 重要：保存元素引用，即使Vue重新渲染，我们仍然可以访问原始元素
            const outerElRef = outerEl
            const innerElRef = innerEl
            
            const performCleanup = () => {
              if (cleanupDone) return
              cleanupDone = true
              
              if (fallbackTimeout) {
                clearTimeout(fallbackTimeout)
                fallbackTimeout = null
              }
              
              const { removeGhostById } = useFlyingChips()
              removeGhostById(chipId)
              animatingChips.value.delete(chipId)
              // console.log('🗑️ Removed chip after animation:', chipId)
              
              // 移除所有事件监听器
              outerElRef.removeEventListener('transitionend', handleTransitionEnd)
              innerElRef.removeEventListener('transitionend', handleTransitionEnd)
              document.body.removeEventListener('transitionend', bodyHandler)
            }
            
            const handleTransitionEnd = (e: TransitionEvent) => {
              // 确保是transform的transition结束，且只处理一次
              // 检查事件目标是否是我们监听的元素（即使DOM被重新创建）
              const target = e.target as HTMLElement
              const isOuter = target === outerElRef || target.closest('.flying-ghost-outer') === outerElRef
              const isInner = target === innerElRef || target.closest('.flying-ghost-inner') === innerElRef
              
              if (e.propertyName === 'transform' && !transitionEnded && (isOuter || isInner)) {
                transitionEnded = true
                // console.log('🏁 Animation ended for', chipId)
                
                // 延迟移除，确保动画完全结束
                setTimeout(performCleanup, 100)
              }
              // else: 忽略其他transitionend事件（可能是其他属性的transition）
            }
            
            // 也监听body上的transitionend事件（作为fallback，以防元素被重新创建）
            const bodyHandler = (e: TransitionEvent) => {
              const target = e.target as HTMLElement
              if (target.closest(`[data-chip-id="${chipId}"]`)) {
                handleTransitionEnd(e)
              }
            }
            
            // 监听两个元素的 transitionend
            outerElRef.addEventListener('transitionend', handleTransitionEnd, { once: true })
            innerElRef.addEventListener('transitionend', handleTransitionEnd, { once: true })
            document.body.addEventListener('transitionend', bodyHandler, { once: true })
            
            // Fallback: 如果transitionend事件没有触发（例如元素被移除），在动画时间后强制清理
            fallbackTimeout = setTimeout(() => {
              if (!cleanupDone) {
                // console.warn('⚠️ Fallback cleanup triggered for', chipId)
                // 移除body监听器
                document.body.removeEventListener('transitionend', bodyHandler)
                performCleanup()
              }
            }, DURATION + 200) // 动画时间 + 200ms 缓冲
          })
        })
      } else {
        // console.error('❌ Missing refs for', chipId, { outerEl: !!outerEl, innerEl: !!innerEl })
      }
    })
  })
}

function getOuterStyle(chip: FlyingChip) {
  const deltaX = chip.end.x - chip.start.x
  const isAnimating = animatingChips.value.has(chip.id)
  
  // 初始状态：不设置 transform，让 JavaScript 控制
  // 这样可以避免 CSS 和 JS 之间的冲突
  const style: Record<string, string> = {
    transform: 'translateX(0px)', // 初始状态
  }
  
  // 不在 CSS 中设置 transition，让 JavaScript 完全控制
  style.transition = 'none'
  
  return style
}

function getInnerStyle(chip: FlyingChip) {
  const deltaY = chip.end.y - chip.start.y
  const isAnimating = animatingChips.value.has(chip.id)
  
  // 初始状态：不设置 transform，让 JavaScript 控制
  const style: Record<string, string> = {
    transform: 'translateY(0px)', // 初始状态
  }
  
  // 不在 CSS 中设置 transition，让 JavaScript 完全控制
  style.transition = 'none'
  
  return style
}

// 监听flyingChips变化，清理已移除的chip的refs并启动新动画
watch(() => flyingChips.value, (newChips, oldChips) => {
  const currentIds = new Set(newChips.map(c => c.id))
  const oldIds = oldChips ? new Set(oldChips.map(c => c.id)) : new Set()
  
  // 清理已移除的chip的refs
  for (const [id] of outerRefs) {
    if (!currentIds.has(id)) {
      outerRefs.delete(id)
      innerRefs.delete(id)
      animatingChips.value.delete(id)
    }
  }
  
  // 为新添加的chip启动动画
  newChips.forEach(chip => {
    if (!oldIds.has(chip.id) && !animatingChips.value.has(chip.id)) {
      // 新添加的chip，等待ref设置后启动动画
      nextTick(() => {
        const outerEl = outerRefs.get(chip.id)
        if (outerEl) {
          startAnimation(chip.id)
        } else {
          // 如果ref还没设置，稍后再试
          setTimeout(() => {
            const el = outerRefs.get(chip.id)
            if (el && !animatingChips.value.has(chip.id)) {
              startAnimation(chip.id)
            }
          }, 10)
        }
      })
    }
  })
}, { immediate: true, deep: true })
</script>

<style scoped>
.flying-ghost-wrapper {
  position: fixed;
  pointer-events: none; /* 关键：让点击事件穿透到底层 */
  transform: translate(-50%, -50%);
  z-index: 9999; /* 确保在所有内容之上，高于所有其他元素 */
  /* 确保元素可见且不受父容器影响 */
  opacity: 1;
  visibility: visible;
  /* 确保不受父容器的filter/opacity影响 */
  isolation: isolate; /* 创建新的stacking context，隔离父容器的样式影响 */
}

.flying-ghost-outer {
  will-change: transform;
}

.flying-ghost-inner {
  will-change: transform;
}

.flying-ghost-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  line-height: 1.5;
  font-weight: 500;
  white-space: nowrap;
  border: 1.5px solid;
  /* 样式与 selected-chip 一致 */
}

/* 主题色样式（与 selected-chip 完全一致） */
.flying-ghost-chip--authors {
  background-color: #FBCFE8;
  border-color: #ec4899;
  color: var(--color-fg);
}

.flying-ghost-chip--books {
  background-color: #FED7AA;
  border-color: #fb923c;
  color: var(--color-fg);
}

.flying-ghost-chip--characters {
  background-color: #FDE047;
  border-color: #eab308;
  color: var(--color-fg);
}

.flying-ghost-chip--times {
  background-color: #BBF7D0;
  border-color: #10b981;
  color: var(--color-fg);
}

.flying-ghost-chip--themes {
  background-color: #BAE6FD;
  border-color: #0ea5e9;
  color: var(--color-fg);
}

.flying-ghost-chip--devices {
  background-color: #A5F3FC;
  border-color: #06b6d4;
  color: var(--color-fg);
}

.flying-ghost-chip--search {
  background-color: #D8B4FE;
  border-color: #a855f7;
  color: var(--color-fg);
}
</style>
