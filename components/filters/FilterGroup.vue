<!-- ==============================================
File: components/filters/FilterGroup.vue
职责：通用筛选组（组内搜索 + 多选 chips + 清空本组）
用法：<FilterGroup v-model="authors" :title="'作者'" :options="facets.authors" />
注意：颜色/字体走 styles/theme.css 的变量
============================================== -->
<template>
  <div class="h-full rounded border p-3 flex flex-col min-h-0" style="border-color:#e5e7eb">
    <!-- 标题与“清空本组” -->
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-medium">{{ title }}</h3>
      <button
        class="text-xs px-2 py-1 rounded border"
        style="border-color:#e5e7eb"
        @click="clearGroup"
      >
        清空本组
      </button>
    </div>

    <!-- 组内搜索 -->
    <input
      v-model="innerQuery"
      type="text"
      class="px-2 py-1 rounded border text-sm mb-2"
      style="border-color:#e5e7eb"
      placeholder="组内搜索…"
    />

    <!-- 候选项（内部滚动，不影响整体高度） -->
    <div class="flex-1 min-h-0 overflow-auto flex flex-wrap gap-2">
      <button
        v-for="opt in filteredOptions"
        :key="opt.id"
        class="px-2 py-1 rounded text-sm border"
        :style="chipStyle(opt.id)"
        @click="toggle(opt.id)"
      >
        {{ opt.label }}
      </button>
      <div v-if="filteredOptions.length === 0" class="text-xs text-muted">无匹配项</div>
    </div>
  </div>
</template>

<script setup lang="ts">
type Option = { id: string; label: string }

const props = defineProps<{
  title: string
  options: Option[]
  modelValue: string[]    // 已选id数组
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string[]): void
}>()

// —— 组内搜索 —— //
const innerQuery = ref('')

const filteredOptions = computed(() => {
  const q = innerQuery.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(o => o.label.toLowerCase().includes(q))
})

// —— 选择/清空 —— //
function toggle(id: string) {
  const set = new Set(props.modelValue)
  if (set.has(id)) set.delete(id); else set.add(id)
  emit('update:modelValue', Array.from(set))
}

function clearGroup() {
  emit('update:modelValue', [])
}

// —— 样式：选中/未选 —— //
function chipStyle(id: string) {
  const active = props.modelValue.includes(id)
  return active
    ? { background: 'var(--color-chip-active)', borderColor: '#93c5fd' }
    : { background: 'var(--color-chip)', borderColor: '#e5e7eb' }
}
</script>