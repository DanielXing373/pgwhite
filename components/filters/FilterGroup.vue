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
          v-for="opt in sortedOptions"
          :key="opt.id"
          :class="getChipClasses(opt)"
          :style="getChipStyles(opt)"
          @click="(e) => handleToggle(opt.id, opt.label, e)"
        >
          {{ opt.label }}
        </button>
        <div v-if="sortedOptions.length === 0" class="text-xs text-muted">
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
type OptionWithCount = Option & { count: number }

const props = defineProps<{
  title: string
  options: Option[]
  modelValue: string[]    // 已选id数组
  showMatchAll?: boolean  // 是否显示"满足所有筛选"复选框
  matchAll?: boolean      // "满足所有筛选"复选框状态
  dimension?: 'authors' | 'books' | 'characters' | 'times' | 'themes' | 'devices' // 标签组类型，用于应用对应的主题色
  dynamicCounts?: Record<string, number> // 当前过滤结果中每个标签的出现次数（用于 Spotlight 效果）
  hasActiveFilters?: boolean // 是否有其他维度的筛选激活（用于判断是否启用 Spotlight）
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string[]): void
  (e: 'update:matchAll', val: boolean): void
}>()

// —— 语言检测（用于判断是否应用斜体） —— //
const { locale } = useI18n()
const isEnglish = computed(() => locale.value === 'en')

// —— 维度颜色映射（与 FiltersPanel 中的 TAB_COLORS 保持一致） —— //
const COLOR_MAP: Record<string, string> = {
  authors: '#FBCFE8',    // 樱花粉
  books: '#FED7AA',      // 奶油橘
  characters: '#FDE047', // 芝士黄
  times: '#BBF7D0',      // 薄荷绿
  themes: '#BAE6FD',     // 天空蓝
  devices: '#A5F3FC',    // 冰川青
}

// 计算当前维度的主题色
const themeColor = computed(() => {
  return props.dimension ? COLOR_MAP[props.dimension] || '#e5e7eb' : '#e5e7eb'
})

// 将十六进制颜色转换为 rgba（用于背景色透明度）
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 获取 chip 的类名（三状态系统）
function getChipClasses(opt: OptionWithCount): string[] {
  const isSelected = props.modelValue.includes(opt.id)
  const classes = [
    'px-2 py-1 text-sm border filter-chip',
    props.dimension ? `filter-chip--${props.dimension}` : '',
    isBookChip(opt.id) && isEnglish.value ? 'filter-chip--book' : ''
  ]

  // 状态 3: 选中状态（优先级最高）
  if (isSelected) {
    classes.push('filter-chip--active')
    return classes
  }

  // 状态 2: 推荐状态（hasActiveFilters && count > 0）
  if (props.hasActiveFilters && props.dynamicCounts && opt.count > 0) {
    classes.push('filter-chip--recommended')
    return classes
  }

  // 状态 1: 中性/无关状态
  if (props.hasActiveFilters && props.dynamicCounts) {
    classes.push('filter-chip--normal')
  }
  
  return classes
}

// 获取 chip 的内联样式（三状态系统）
function getChipStyles(opt: OptionWithCount): Record<string, string> {
  const isSelected = props.modelValue.includes(opt.id)
  
  // 状态 3: 选中状态 - 使用 theme.css 中的样式，不添加内联样式
  if (isSelected) {
    return {}
  }

  // 状态 2: 推荐状态 - 添加左侧粗边框和四周边框（主题色）
  if (props.hasActiveFilters && props.dynamicCounts && opt.count > 0 && props.dimension) {
    return {
      'border-left-width': '4px',
      'border-left-color': themeColor.value,
      'border-left-style': 'solid',
      'border-width': '2px',
      'border-color': themeColor.value,
      'border-style': 'solid'
    }
  }

  // 状态 1: 中性状态 - 透明左边框（保持布局一致）
  if (props.hasActiveFilters && props.dynamicCounts && props.dimension) {
    return {
      'border-left-width': '4px',
      'border-left-color': 'transparent',
      'border-left-style': 'solid'
    }
  }

  // 默认：无特殊样式
  return {}
}

// —— 飞行标签动画 —— //
const { triggerFly, removeGhost } = useFlyingChips()

// —— 检查是否有选中的项 —— //
const hasSelectedItems = computed(() => props.modelValue.length > 0)

// —— 候选项（合并计数并排序，实现 Spotlight 效果） —— //
const sortedOptions = computed<OptionWithCount[]>(() => {
  // 如果没有提供 dynamicCounts 或 hasActiveFilters 为 false，保持原始顺序（按字母顺序）
  if (!props.dynamicCounts || !props.hasActiveFilters) {
    return props.options.map(opt => ({ ...opt, count: 0 }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }
  
  const counts = props.dynamicCounts
  
  // 为每个选项添加计数
  const optionsWithCounts: OptionWithCount[] = props.options.map(opt => ({
    ...opt,
    count: counts[opt.id] || 0
  }))
  
  // 排序（只在 hasActiveFilters 为 true 时排序）：
  // 1. 主排序：有计数的在上（count > 0），无计数的在下（count === 0）
  // 2. 次排序：按字母顺序（label）
  return optionsWithCounts.sort((a, b) => {
    // 主排序：有计数 vs 无计数
    if (a.count > 0 && b.count === 0) return -1
    if (a.count === 0 && b.count > 0) return 1
    
    // 次排序：字母顺序
    return a.label.localeCompare(b.label)
  })
})

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

/* Spotlight 效果样式 - 三状态系统 */
.filter-chip--recommended {
  /* 推荐状态：只通过内联样式添加左边框，不改变其他样式 */
  transition: all 0.2s ease;
}

.filter-chip--normal {
  /* 无关项：保持完全可见，使用透明左边框保持布局一致 */
  /* 样式通过内联样式应用 */
  transition: all 0.2s ease;
}

/* 选中状态：使用 theme.css 中的原有样式，不添加额外样式 */
</style>