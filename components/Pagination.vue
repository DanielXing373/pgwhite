<template>
  <div class="pagination">
    <button
      class="pagination-btn pagination-btn--arrow"
      :disabled="currentPage === 1"
      @click="goToPage(currentPage - 1)"
      :aria-label="$t('pagination.previous')"
    >
      <span class="pagination-arrow">‹</span>
    </button>

    <template v-for="item in paginationItems" :key="item.key">
      <span
        v-if="item.type === 'ellipsis'"
        class="pagination-ellipsis"
        aria-hidden="true"
      >…</span>
      <button
        v-else
        class="pagination-btn pagination-btn--number"
        :class="{ 'pagination-btn--active': item.page === currentPage }"
        @click="goToPage(item.page)"
      >
        {{ item.page }}
      </button>
    </template>

    <button
      class="pagination-btn pagination-btn--arrow"
      :disabled="currentPage === totalPages"
      @click="goToPage(currentPage + 1)"
      :aria-label="$t('pagination.next')"
    >
      <span class="pagination-arrow">›</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  (e: 'page-change', page: number): void
}>()

type PaginationItem =
  | { type: 'page'; page: number; key: string }
  | { type: 'ellipsis'; key: string }

/** 1 … 4 5 [6] 7 8 … 末页；靠近首尾时展开连续页码块 */
const paginationItems = computed((): PaginationItem[] => {
  const total = props.totalPages
  const current = props.currentPage
  if (total <= 0) return []
  if (total === 1) return [{ type: 'page', page: 1, key: 'page-1' }]

  const maxBlock = 7
  const items: PaginationItem[] = []

  if (total <= maxBlock + 2) {
    for (let p = 1; p <= total; p++) {
      items.push({ type: 'page', page: p, key: `page-${p}` })
    }
    return items
  }

  items.push({ type: 'page', page: 1, key: 'page-1' })

  let start = Math.max(2, current - 2)
  let end = Math.min(total - 1, current + 2)

  if (current <= 4) {
    start = 2
    end = maxBlock
  } else if (current >= total - 3) {
    start = total - maxBlock + 1
    end = total - 1
  }

  if (start > 2) {
    items.push({ type: 'ellipsis', key: 'ellipsis-left' })
  } else {
    for (let p = 2; p < start; p++) {
      items.push({ type: 'page', page: p, key: `page-${p}` })
    }
  }

  for (let p = start; p <= end; p++) {
    items.push({ type: 'page', page: p, key: `page-${p}` })
  }

  if (end < total - 1) {
    items.push({ type: 'ellipsis', key: 'ellipsis-right' })
  } else {
    for (let p = end + 1; p < total; p++) {
      items.push({ type: 'page', page: p, key: `page-${p}` })
    }
  }

  items.push({ type: 'page', page: total, key: `page-${total}` })
  return items
})

function goToPage(page: number) {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage) {
    emit('page-change', page)
  }
}
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin: 16px 0;
  flex-wrap: wrap;
}

.pagination-btn {
  min-width: 36px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background-color: #ffffff;
  color: var(--color-fg);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pagination-btn:hover:not(:disabled) {
  background-color: #f9fafb;
  border-color: #d1d5db;
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-btn--active {
  background-color: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
}

.pagination-btn--active:hover {
  background-color: #2563eb;
  border-color: #2563eb;
}

.pagination-btn--arrow {
  font-size: 1.25rem;
  line-height: 1;
}

.pagination-arrow {
  display: inline-block;
  line-height: 1;
}

.pagination-ellipsis {
  min-width: 28px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-muted);
  font-size: 0.875rem;
  user-select: none;
  padding: 0 2px;
}
</style>
