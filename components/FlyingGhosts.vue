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
      class="flying-ghost-wrapper"
      :data-chip-id="chip.id"
      :style="{
        left: `${chip.start.x}px`,
        top: `${chip.start.y}px`,
        zIndex: 9999
      }"
    >
      <!-- 外层：X轴线性移动 -->
      <div
        :ref="el => setOuterRef(chip.id, el)"
        class="flying-ghost-outer"
        :style="getOuterStyle(chip)"
      >
        <!-- 内层：Y轴抛物线移动 -->
        <div
          :ref="el => setInnerRef(chip.id, el)"
          class="flying-ghost-inner"
          :style="getInnerStyle(chip)"
        >
          <!-- 幽灵标签（样式与选中标签一致） -->
          <span
            :class="[
              'flying-ghost-chip',
              `flying-ghost-chip--${chip.dimension}`
            ]"
          >
            {{ chip.tagLabel }}
          </span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useFlyingChips } from '~/composables/useFlyingChips'
import type { FlyingChip } from '~/composables/useFlyingChips'

const flyingChipsStore = useFlyingChips()
const flyingChips = flyingChipsStore.flyingChips // 确保使用响应式引用

// 调试：立即检查初始状态
console.log('🔍 FlyingGhosts mounted, initial flyingChips:', {
  length: flyingChips.value.length,
  chips: [...flyingChips.value],
  isRef: !!flyingChips.value
})

// 调试：监听 flyingChips 变化
watch(() => flyingChips.value, (newChips, oldChips) => {
  console.log('🛫 FlyingGhosts: flyingChips changed', {
    length: newChips.length,
    newChips,
    oldLength: oldChips?.length || 0,
    oldChips
  })
}, { deep: true, immediate: true })

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
    console.log('⚠️ Animation already started for', chipId)
    return // 已经在动画中
  }
  
  const chip = flyingChips.value.find(c => c.id === chipId)
  if (!chip) {
    console.error('❌ Chip not found:', chipId)
    return
  }
  
  console.log('🎬 Starting animation for', chipId, {
    start: chip.start,
    end: chip.end,
    deltaX: chip.end.x - chip.start.x,
    deltaY: chip.end.y - chip.start.y
  })
  
  // 先设置动画状态为true，触发样式更新
  animatingChips.value.add(chipId)
  
  // 等待DOM更新和下一帧，确保初始状态已渲染，然后触发transition
  nextTick(() => {
    requestAnimationFrame(() => {
      const outerEl = outerRefs.get(chipId)
      const innerEl = innerRefs.get(chipId)
      
      console.log('🔍 Animation setup:', { chipId, outerEl: !!outerEl, innerEl: !!innerEl })
      
      if (outerEl && innerEl) {
        const deltaX = chip.end.x - chip.start.x
        const deltaY = chip.end.y - chip.start.y
        
        console.log('🎯 About to apply transforms:', {
          chipId,
          deltaX,
          deltaY,
          start: chip.start,
          end: chip.end
        })
        
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
            
            console.log('✅ Applied transforms:', {
              deltaX,
              deltaY,
              outerTransform: outerEl.style.transform,
              innerTransform: innerEl.style.transform,
              outerTransition: outerEl.style.transition,
              innerTransition: innerEl.style.transition
            })
            
            // 监听动画结束 - 使用一个共享的标记来确保只处理一次
            let transitionEnded = false
            let cleanupDone = false
            let fallbackTimeout: ReturnType<typeof setTimeout> | null = null
            
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
              console.log('🗑️ Removed chip after animation:', chipId)
              
              // 移除所有事件监听器
              outerEl.removeEventListener('transitionend', handleTransitionEnd)
              innerEl.removeEventListener('transitionend', handleTransitionEnd)
            }
            
            const handleTransitionEnd = (e: TransitionEvent) => {
              // 确保是transform的transition结束，且只处理一次
              if (e.propertyName === 'transform' && !transitionEnded) {
                transitionEnded = true
                console.log('🏁 Animation ended for', chipId, {
                  propertyName: e.propertyName,
                  elapsedTime: e.elapsedTime,
                  target: e.target === outerEl ? 'outer' : 'inner'
                })
                
                // 延迟移除，确保动画完全结束
                setTimeout(performCleanup, 100)
              } else {
                console.log('⚠️ Ignored transitionend event:', {
                  propertyName: e.propertyName,
                  transitionEnded,
                  chipId,
                  target: e.target === outerEl ? 'outer' : 'inner'
                })
              }
            }
            
            // 监听两个元素的 transitionend
            outerEl.addEventListener('transitionend', handleTransitionEnd, { once: true })
            innerEl.addEventListener('transitionend', handleTransitionEnd, { once: true })
            
            // Fallback: 如果transitionend事件没有触发（例如元素被移除），在动画时间后强制清理
            fallbackTimeout = setTimeout(() => {
              if (!cleanupDone) {
                console.warn('⚠️ Fallback cleanup triggered for', chipId)
                performCleanup()
              }
            }, DURATION + 200) // 动画时间 + 200ms 缓冲
          })
        })
      } else {
        console.error('❌ Missing refs for', chipId, { outerEl: !!outerEl, innerEl: !!innerEl })
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
  console.log('📊 FlyingGhosts watch triggered:', {
    newLength: newChips.length,
    oldLength: oldChips?.length || 0,
    newChips: newChips.map(c => ({ id: c.id, label: c.tagLabel })),
    oldChips: oldChips?.map(c => ({ id: c.id, label: c.tagLabel })) || []
  })
  
  const currentIds = new Set(newChips.map(c => c.id))
  const oldIds = oldChips ? new Set(oldChips.map(c => c.id)) : new Set()
  
  // 清理已移除的chip的refs
  for (const [id] of outerRefs) {
    if (!currentIds.has(id)) {
      console.log('🗑️ Removing refs for', id)
      outerRefs.delete(id)
      innerRefs.delete(id)
      animatingChips.value.delete(id)
    }
  }
  
  // 为新添加的chip启动动画
  newChips.forEach(chip => {
    if (!oldIds.has(chip.id) && !animatingChips.value.has(chip.id)) {
      console.log('🆕 New chip detected, starting animation setup:', chip.id)
      // 新添加的chip，等待ref设置后启动动画
      nextTick(() => {
        const outerEl = outerRefs.get(chip.id)
        if (outerEl) {
          console.log('✅ Ref found, starting animation:', chip.id)
          startAnimation(chip.id)
        } else {
          console.log('⏳ Ref not ready yet, will retry:', chip.id)
          // 如果ref还没设置，稍后再试
          setTimeout(() => {
            const el = outerRefs.get(chip.id)
            if (el && !animatingChips.value.has(chip.id)) {
              console.log('✅ Ref ready after retry, starting animation:', chip.id)
              startAnimation(chip.id)
            } else {
              console.warn('❌ Ref still not ready after retry:', chip.id)
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
  pointer-events: none;
  transform: translate(-50%, -50%);
  /* 确保元素可见 */
  opacity: 1;
  visibility: visible;
}

.flying-ghost-outer {
  will-change: transform;
}

.flying-ghost-inner {
  will-change: transform;
}

.flying-ghost-chip {
  display: inline-block;
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

.flying-ghost-chip--genres {
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
