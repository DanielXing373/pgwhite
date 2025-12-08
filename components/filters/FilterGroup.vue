<!-- ==============================================
File: components/filters/FilterGroup.vue
职责：通用筛选组（组内搜索 + 多选 chips + 清空本组）
用法：<FilterGroup v-model="authors" :title="'作者'" :options="facets.authors" />
注意：颜色/字体走 styles/theme.css 的变量
============================================== -->
<template>
  <div class="filter-group-wrapper h-full flex flex-col min-h-0">
    <!-- 主内容区：chips 在左侧，操作按钮在右侧 -->
    <div class="filter-group-main">
      <!-- 候选项（内部滚动，不影响整体高度） -->
      <div class="filter-chips-container">
        <button
          v-for="opt in filteredOptions"
          :key="opt.id"
          :class="[
            'px-2 py-1 text-sm border filter-chip',
            props.dimension ? `filter-chip--${props.dimension}` : '',
            props.modelValue.includes(opt.id) ? 'filter-chip--active' : '',
            isBookChip(opt.id) && isEnglish ? 'filter-chip--book' : ''
          ]"
          @click="(e) => handleToggle(opt.id, opt.label, e)"
        >
          {{ opt.label }}
        </button>
        <div v-if="filteredOptions.length === 0" class="text-xs text-muted">
          {{ $t('filters.noMatch') }}
        </div>
      </div>

      <!-- 操作栏："清空本组"按钮和"满足所有筛选"复选框 -->
      <div class="filter-group-actions">
        <button
          class="text-xs px-2 py-1 rounded border filter-clear-group-btn"
          :class="{ 'filter-clear-group-btn--disabled': !hasSelectedItems }"
          :disabled="!hasSelectedItems"
          style="border-color:#e5e7eb"
          @click="clearGroup"
        >
          {{ $t('filters.clearGroup') }}
        </button>
        <!-- "满足所有筛选"复选框（仅在后三个维度显示） -->
        <label v-if="showMatchAll" class="filter-match-all-checkbox">
          <input
            type="checkbox"
            :checked="matchAll"
            @change="handleMatchAllChange"
            class="filter-checkbox-input"
          />
          <span class="filter-checkbox-label">{{ $t('filters.matchAll') }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type Option = { id: string; label: string }

const props = defineProps<{
  title: string
  options: Option[]
  modelValue: string[]    // 已选id数组
  showMatchAll?: boolean  // 是否显示"满足所有筛选"复选框
  matchAll?: boolean      // "满足所有筛选"复选框状态
  dimension?: 'authors' | 'books' | 'genres' | 'times' | 'themes' | 'devices' // 标签组类型，用于应用对应的主题色
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string[]): void
  (e: 'update:matchAll', val: boolean): void
}>()

// —— 语言检测（用于判断是否应用斜体） —— //
const { locale } = useI18n()
const isEnglish = computed(() => locale.value === 'en')

// —— 飞行标签动画 —— //
const { triggerFly, removeGhost } = useFlyingChips()

// —— 检查是否有选中的项 —— //
const hasSelectedItems = computed(() => props.modelValue.length > 0)

// —— 候选项（直接使用 props.options，不再进行组内搜索过滤） —— //
const filteredOptions = computed(() => props.options)

// —— 判断是否是书名 chip（通过 ID 前缀判断） —— //
function isBookChip(id: string): boolean {
  return id.startsWith('b_')
}

// —— 选择/清空 —— //
async function handleToggle(id: string, label: string, event: MouseEvent) {
  const set = new Set(props.modelValue)
  const wasSelected = set.has(id)
  
  if (wasSelected) {
    // 取消选择：移除飞行中的标签（如果存在）- 移除所有匹配的飞行实例
    if (props.dimension) {
      removeGhost(id, props.dimension, true) // removeAll = true
    }
    set.delete(id)
  } else {
    // 选择：触发飞行动画
    set.add(id)
    
    if (props.dimension) {
      // 捕获起始位置
      const startRect = (event.target as HTMLElement).getBoundingClientRect()
      
      // 更新数据模型
      emit('update:modelValue', Array.from(set))
      
      // 等待DOM更新
      await nextTick()
      
      // 查找目标元素
      const destinationId = `active-tag-${props.dimension}-${id}`
      const destinationEl = document.getElementById(destinationId)
      
      if (destinationEl) {
        // 初始时目标标签不可见（作为占位符）
        destinationEl.style.opacity = '0'
        const endRect = destinationEl.getBoundingClientRect()
        
      // 触发飞行动画
      triggerFly(id, props.dimension, label, startRect, endRect)
        
        // 动画结束后显示目标标签
        setTimeout(() => {
          if (destinationEl) {
            destinationEl.style.opacity = '1'
            destinationEl.style.transition = 'opacity 0.2s ease-in'
          }
        }, 550) // 与动画持续时间一致
      } else {
        // 如果找不到目标元素，等待更长时间再试
        setTimeout(async () => {
          const retryEl = document.getElementById(destinationId)
          if (retryEl && props.dimension) {
            retryEl.style.opacity = '0'
            const endRect = retryEl.getBoundingClientRect()
            triggerFly(id, props.dimension, label, startRect, endRect)
            setTimeout(() => {
              if (retryEl) {
                retryEl.style.opacity = '1'
                retryEl.style.transition = 'opacity 0.2s ease-in'
              }
            }, 550)
          }
        }, 50)
      }
      
      return
    }
  }
  
  emit('update:modelValue', Array.from(set))
}

function clearGroup() {
  emit('update:modelValue', [])
}

function handleMatchAllChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:matchAll', target.checked)
}

// 不再需要 chipStyle 函数，改用 CSS 类
</script>

<style scoped>
/* 主内容区：chips 在左侧，操作按钮在右侧 */
.filter-group-main {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  height: 100%;
}

/* 筛选区 chips 容器（左侧，占据剩余空间） */
.filter-chips-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-content: flex-start;
}

/* 操作栏（右侧，固定宽度） */
.filter-group-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

/* "满足所有筛选"复选框样式 */
.filter-match-all-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 0.75rem; /* text-xs */
  color: var(--color-muted);
  user-select: none;
}

.filter-checkbox-input {
  cursor: pointer;
  margin: 0;
}

.filter-checkbox-label {
  cursor: pointer;
}

/* 清空本组按钮样式 */
.filter-clear-group-btn {
  transition: opacity 0.2s ease, color 0.2s ease;
}

.filter-clear-group-btn:disabled,
.filter-clear-group-btn--disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: var(--color-muted);
}

/* 筛选组包装器（在标签页布局中不需要边框和内边距） */
.filter-group-wrapper {
  /* 移除边框和内边距，因为标签页面板已经有 padding */
}
</style>