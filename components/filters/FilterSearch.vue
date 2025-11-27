<!-- ==============================================
File: components/filters/FilterSearch.vue
职责：精准搜索输入框（用于标签页中的搜索tab）
用法：<FilterSearch v-model="q" :placeholder="..." />
============================================== -->
<template>
  <div class="filter-search-container">
    <div class="filter-search-wrapper">
      <input
        :value="modelValue"
        @input="onInput"
        type="text"
        class="filter-search-input"
        :class="{ 'filter-search-input--has-clear': hasValue }"
        :placeholder="placeholder"
      />
      <button
        v-if="hasValue"
        class="filter-search-clear-btn"
        @click.stop.prevent="handleClear"
        type="button"
        aria-label="Clear search"
        title="Clear search"
      >
        ×
      </button>
    </div>
    <div class="filter-search-hint">
      {{ $t('filters.searchHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  placeholder: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

const hasValue = computed(() => {
  const val = props.modelValue
  return val !== undefined && val !== null && val.length > 0
})

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function handleClear() {
  emit('update:modelValue', '')
}
</script>

<style scoped>
.filter-search-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.filter-search-wrapper {
  width: 100%;
  max-width: 100%;
  position: relative;
  box-sizing: border-box;
  flex-shrink: 0;
}

.filter-search-input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 8px 40px 8px 12px; /* 右侧留出空间给x按钮 */
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--color-fg);
  background-color: #ffffff;
  outline: none;
  margin: 0;
}

.filter-search-input:focus {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.filter-search-clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  padding: 0;
  margin: 0;
  border: none;
  background-color: transparent;
  color: #6b7280;
  font-size: 20px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: color 0.2s ease, background-color 0.2s ease;
  z-index: 10;
  pointer-events: auto;
  flex-shrink: 0;
}

.filter-search-clear-btn:hover {
  color: var(--color-fg);
  background-color: #f3f4f6;
}

.filter-search-clear-btn:active {
  background-color: #e5e7eb;
}

.filter-search-hint {
  font-size: 0.75rem;
  color: var(--color-muted);
  padding: 4px 0;
}
</style>

