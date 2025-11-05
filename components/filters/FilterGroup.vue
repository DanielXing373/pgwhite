<!-- ==============================================
File: components/filters/FilterGroup.vue
职责：通用筛选组（组内搜索 + 多选 chips + 清空本组）
用法：<FilterGroup v-model="authors" :title="'作者'" :options="facets.authors" />
注意：颜色/字体走 styles/theme.css 的变量
============================================== -->
<template>
  <div class="h-full rounded border p-3 flex flex-col min-h-0" style="border-color:#e5e7eb">
    <!-- 标题与"清空本组" -->
    <div class="filter-group-header">
      <div class="filter-group-title-row">
        <h3 class="filter-group-title">{{ title }}</h3>
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
      <button
        class="text-xs px-2 py-1 rounded border"
        style="border-color:#e5e7eb"
        @click="clearGroup"
      >
        {{ $t('filters.clearGroup') }}
      </button>
    </div>

    <!-- 组内搜索 -->
    <input
      v-model="innerQuery"
      type="text"
      class="px-2 py-1 rounded border text-sm mb-2"
      style="border-color:#e5e7eb"
      :placeholder="$t('filters.searchInGroup')"
    />

    <!-- 候选项（内部滚动，不影响整体高度） -->
    <div class="filter-chips-container">
      <button
        v-for="opt in filteredOptions"
        :key="opt.id"
        :class="[
          'px-2 py-1 rounded text-sm border',
          isBookChip(opt.id) && isEnglish ? 'filter-chip--book' : ''
        ]"
        :style="chipStyle(opt.id)"
        @click="toggle(opt.id)"
      >
        {{ opt.label }}
      </button>
      <div v-if="filteredOptions.length === 0" class="text-xs text-muted">
        {{ $t('filters.noMatch') }}
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
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string[]): void
  (e: 'update:matchAll', val: boolean): void
}>()

// —— 语言检测（用于判断是否应用斜体） —— //
const { locale } = useI18n()
const isEnglish = computed(() => locale.value === 'en')

// —— 组内搜索 —— //
const innerQuery = ref('')

const filteredOptions = computed(() => {
  const q = innerQuery.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(o => o.label.toLowerCase().includes(q))
})

// —— 判断是否是书名 chip（通过 ID 前缀判断） —— //
function isBookChip(id: string): boolean {
  return id.startsWith('b_')
}

// —— 选择/清空 —— //
function toggle(id: string) {
  const set = new Set(props.modelValue)
  if (set.has(id)) set.delete(id); else set.add(id)
  emit('update:modelValue', Array.from(set))
}

function clearGroup() {
  emit('update:modelValue', [])
}

function handleMatchAllChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:matchAll', target.checked)
}

// —— 样式：选中/未选 —— //
function chipStyle(id: string) {
  const active = props.modelValue.includes(id)
  return active
    ? { background: 'var(--color-chip-active)', borderColor: '#93c5fd' }
    : { background: 'var(--color-chip)', borderColor: '#e5e7eb' }
}
</script>

<style scoped>
/* 标题行布局（标题 + 复选框） */
.filter-group-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
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
</style>