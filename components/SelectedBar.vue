<template>
  <section class="selected-bar-section">
    <div class="selected-bar-card">
      <div class="selected-bar-container">
      <div class="selected-bar-header">
        <div class="selected-bar-title-section">
        <div class="text-sm">
          {{ selectedLabel }}：
          </div>
          <span v-if="selectedItems.length > 0" class="selected-hint">
            {{ $t('selected.clickHint') }}
          </span>
        </div>
        <div class="selected-bar-actions">
          <button
            class="selected-action-btn"
            :class="{ 'selected-action-btn--disabled': !canUndo }"
            :disabled="!canUndo"
            @click="$emit('undo')"
            :aria-label="$t('selected.undo')"
            :title="$t('selected.undo')"
          >
            ↶
          </button>
          <button
            class="selected-action-btn"
            :class="{ 'selected-action-btn--disabled': !canRedo }"
            :disabled="!canRedo"
            @click="$emit('redo')"
            :aria-label="$t('selected.redo')"
            :title="$t('selected.redo')"
          >
            ↷
          </button>
          <button 
            class="selected-clear-all-btn"
            :class="{ 'selected-clear-all-btn--disabled': selectedItems.length === 0 }"
            :disabled="selectedItems.length === 0"
            @click="$emit('clearAll')"
          >
          {{ clearAllText }}
          </button>
        </div>
      </div>
      <!-- 选中的标签 chips -->
      <div v-if="selectedItems.length > 0" class="selected-chips-container">
        <button
          v-for="item in selectedItems"
          :key="`${item.dimension}-${item.id}`"
          :id="`active-tag-${item.dimension}-${item.id}`"
          :class="[
            'selected-chip',
            `selected-chip--${item.dimension}`,
            item.dimension === 'books' && isEnglish ? 'selected-chip--book' : ''
          ]"
          @click="handleRemoveTag(item.dimension, item.id)"
          :aria-label="$t('selected.removeTag', { label: item.displayLabel })"
        >
          <span v-if="item.emoji" class="chip-emoji" aria-hidden="true">{{ item.emoji }}</span>
          <span>{{ item.label }}</span>
        </button>
      </div>
      <div v-else class="selected-empty">
        {{ $t('selected.emptyHint') }}
      </div>
    </div>
      </div>
    </section>
  </template>
  
  <script setup lang="ts">
import { DIM_KEYS } from '~/composables/dimensions'
import type { DimKey, FacetOptions } from '~/composables/dimensions'

type SelectedItem = {
  dimension: DimKey
  id: string
  label: string
  emoji?: string
  displayLabel: string
}

const props = defineProps<{
  selectedLabel: string
  clearAllText: string
  /** 与 GET /api/facets 一致，用于把 id 显示为当前语言文案 */
  facetOptions: FacetOptions
  authors: string[]
  books: string[]
  characters: string[]
  times: string[]
  themes: string[]
  devices: string[]
  canUndo?: boolean
  canRedo?: boolean
}>()

const emit = defineEmits<{
  (e: 'clearAll'): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'removeTag', dimension: DimKey, id: string): void
}>()

const { locale } = useI18n()
const isEnglish = computed(() => locale.value === 'en')

function getOptionForId(dim: DimKey, id: string) {
  return props.facetOptions[dim].find(o => o.id === id)
}

function getLabelForId(dim: DimKey, id: string): string {
  return getOptionForId(dim, id)?.label ?? id
}

/**
 * 获取所有选中项的标签，按维度顺序排列
 */
const selectedItems = computed<SelectedItem[]>(() => {
  const items: SelectedItem[] = []

  for (const dim of DIM_KEYS) {
    const selectedIds = props[dim] as string[]
    if (!selectedIds || selectedIds.length === 0) continue

    const sortedIds = [...selectedIds].sort((a, b) => {
      const labelA = getLabelForId(dim, a)
      const labelB = getLabelForId(dim, b)
      return labelA.localeCompare(labelB)
    })

    for (const id of sortedIds) {
      const opt = getOptionForId(dim, id)
      const label = opt?.label ?? id
      const emoji = opt?.emoji
      items.push({
        dimension: dim,
        id,
        label,
        emoji,
        displayLabel: emoji ? `${emoji} ${label}` : label
      })
    }
  }

  return items
})

function handleRemoveTag(dimension: DimKey, id: string) {
  emit('removeTag', dimension, id)
}
  </script>
