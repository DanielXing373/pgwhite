<template>
  <div class="pagination">
    <!-- 左箭头 -->
    <button
      class="pagination-btn pagination-btn--arrow"
      :disabled="currentPage === 1"
      @click="goToPage(currentPage - 1)"
      :aria-label="$t('pagination.previous')"
    >
      <span class="pagination-arrow">‹</span>
    </button>

    <!-- 页码按钮 -->
    <button
      v-for="page in visiblePages"
      :key="page"
      class="pagination-btn pagination-btn--number"
      :class="{
        'pagination-btn--active': page === currentPage
      }"
      @click="goToPage(page)"
    >
      {{ page }}
    </button>

    <!-- 右箭头 -->
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
import { useI18n } from '#imports'

const props = defineProps<{
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  (e: 'page-change', page: number): void
}>()

const { t } = useI18n()

// 计算可见的页码（显示当前页及前后各2页，最多显示7个页码）
const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 7
  const halfVisible = Math.floor(maxVisible / 2)

  let start = Math.max(1, props.currentPage - halfVisible)
  let end = Math.min(props.totalPages, props.currentPage + halfVisible)

  // 如果当前页靠近开头，确保显示足够的页码
  if (props.currentPage <= halfVisible) {
    end = Math.min(maxVisible, props.totalPages)
  }

  // 如果当前页靠近结尾，确保显示足够的页码
  if (props.currentPage > props.totalPages - halfVisible) {
    start = Math.max(1, props.totalPages - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
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
</style>