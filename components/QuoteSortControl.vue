<template>
  <div class="quote-sort">
    <span class="quote-sort__label">{{ $t('sort.label') }}</span>
    <div class="quote-sort__toggle" role="group" :aria-label="$t('sort.label')">
      <button
        type="button"
        class="quote-sort__btn"
        :class="{ 'quote-sort__btn--active': modelValue === 'desc' }"
        @click="setSort('desc')"
      >
        {{ $t('sort.newest') }}
      </button>
      <button
        type="button"
        class="quote-sort__btn"
        :class="{ 'quote-sort__btn--active': modelValue === 'asc' }"
        @click="setSort('asc')"
      >
        {{ $t('sort.oldest') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
export type QuoteSortOrder = 'asc' | 'desc'

const props = defineProps<{
  modelValue: QuoteSortOrder
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: QuoteSortOrder): void
}>()

function setSort(value: QuoteSortOrder) {
  if (value !== props.modelValue) {
    emit('update:modelValue', value)
  }
}
</script>

<style scoped>
.quote-sort {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.quote-sort__label {
  font-size: 0.8125rem;
  color: var(--color-muted);
  white-space: nowrap;
}

.quote-sort__toggle {
  display: inline-flex;
  padding: 2px;
  border-radius: 8px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}

.quote-sort__btn {
  border: none;
  background: transparent;
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.2;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  white-space: nowrap;
}

.quote-sort__btn:hover:not(.quote-sort__btn--active) {
  color: var(--color-fg);
  background: rgba(255, 255, 255, 0.6);
}

.quote-sort__btn--active {
  background: #ffffff;
  color: var(--color-fg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
</style>
