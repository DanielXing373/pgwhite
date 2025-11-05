<template>
  <section class="selected-bar-section">
    <div class="selected-bar-card">
      <div class="selected-bar-container">
      <div class="selected-bar-header">
        <div class="text-sm">
          {{ selectedLabel }}：
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
        <span
          v-for="item in selectedItems"
          :key="`${item.dimension}-${item.id}`"
          :class="[
            'selected-chip',
            item.dimension === 'books' && isEnglish ? 'selected-chip--book' : ''
          ]"
        >
          {{ item.label }}
        </span>
      </div>
      <div v-else class="selected-empty">
        {{ $t('selected.emptyHint') }}
      </div>
    </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useDataset } from '~/composables/useDataset'
import { DIM_KEYS } from '~/composables/dimensions'
import type { DimKey } from '~/composables/dimensions'

type SelectedItem = {
  dimension: DimKey
  id: string
  label: string
}

const props = defineProps<{
  selectedLabel: string
  clearAllText: string
  authors: string[]
  books: string[]
  genres: string[]
  times: string[]
  themes: string[]
  devices: string[]
  canUndo?: boolean
  canRedo?: boolean
}>()

defineEmits<{ 
  (e: 'clearAll'): void
  (e: 'undo'): void
  (e: 'redo'): void
}>()

// —— 数据集和语言 —— //
const {
  authorById, bookById, genreById, timeById, themeById, deviceById
} = useDataset()
const { locale } = useI18n()
const isEnglish = computed(() => locale.value === 'en')

/**
 * 格式化书名：中文加书名号，英文返回原文本（通过 CSS 处理斜体）
 */
function formatBookTitle(title: string, isEN: boolean): string {
  if (isEN) {
    return title
  } else {
    return `《${title}》`
  }
}

/**
 * 获取所有选中项的标签，按维度顺序排列
 * 返回格式：{ dimension: DimKey, id: string, label: string }[]
 */
const selectedItems = computed<SelectedItem[]>(() => {
  const items: SelectedItem[] = []
  const isEN = isEnglish.value

  // 按照 DIM_KEYS 的顺序处理每个维度
  for (const dim of DIM_KEYS) {
    const selectedIds = props[dim] as string[]
    if (!selectedIds || selectedIds.length === 0) continue

    // 对每个维度内的 ID 进行排序（按标签文本排序，保持一致性）
    const sortedIds = [...selectedIds].sort((a, b) => {
      const labelA = getLabelForId(dim, a, isEN)
      const labelB = getLabelForId(dim, b, isEN)
      return labelA.localeCompare(labelB)
    })

    // 为每个 ID 创建选中项
    for (const id of sortedIds) {
      const label = getLabelForId(dim, id, isEN)
      items.push({ dimension: dim, id, label })
    }
  }

  return items
})

/**
 * 根据维度和 ID 获取标签文本
 */
function getLabelForId(dim: DimKey, id: string, isEN: boolean): string {
  switch (dim) {
    case 'authors': {
      const author = authorById.get(id)
      if (!author) return id
      return isEN ? (author.name_en || author.name_zh || id) : (author.name_zh || author.name_en || id)
    }
    case 'books': {
      const book = bookById.get(id)
      if (!book) return id
      const rawTitle = isEN ? (book.title_en || book.title_zh || id) : (book.title_zh || book.title_en || id)
      return formatBookTitle(rawTitle, isEN)
    }
    case 'genres': {
      const genre = genreById.get(id)
      if (!genre) return id
      return isEN ? (genre.name_en || genre.name_zh || id) : (genre.name_zh || genre.name_en || id)
    }
    case 'times': {
      const time = timeById.get(id)
      if (!time) return id
      return isEN ? (time.name_en || time.name_zh || id) : (time.name_zh || time.name_en || id)
    }
    case 'themes': {
      const theme = themeById.get(id)
      if (!theme) return id
      return isEN ? (theme.name_en || theme.name_zh || id) : (theme.name_zh || theme.name_en || id)
    }
    case 'devices': {
      const device = deviceById.get(id)
      if (!device) return id
      return isEN ? (device.name_en || device.name_zh || id) : (device.name_zh || device.name_en || id)
    }
  }
}
</script>