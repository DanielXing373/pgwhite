<!-- =====================================================
File: pages/index.vue
标题：首页：接上数据/状态/过滤（含语言隐形筛选）
说明：此版仅演示：文本搜索 + 清空全部 + 语言跟随
====================================================== -->
<template>
  <!-- —— 搜索区 —— -->
  <SearchBar
    v-model="q"
    :label="$t('search.placeholder')"
    :placeholder="$t('search.placeholderExample')"
    :clearText="$t('search.clear')"
    @clear="resetAll"
  />

<!-- —— 筛选区（固定高度，内部滚动） —— -->
<!-- —— 筛选区（现在每个筛选块自带浅色背景和边框） —— -->
<FiltersPanel
  :title="$t('filters.title')"
  :facets="facets"
  v-model:authors="authors"
  v-model:books="books"
  v-model:genres="genres"
  v-model:times="times"
  v-model:themes="themes"
  v-model:devices="devices"
/>

  <!-- —— 当前已选（先仅清空全部） —— -->
  <SelectedBar
  :selectedLabel="$t('filters.selected')"
  :clearAllText="$t('filters.clearAll')"
  @clearAll="resetAll"
/>

  <!-- —— 结果列表（先渲染数量与卡片简版） —— -->
  <section class="space-y-3">
    <div v-if="results.length === 0" class="rounded border p-4 text-sm" style="border-color:#e5e7eb; color:#6b7280">
      {{ $t('results.empty') }}
    </div>
    <div v-else>
      <div class="text-sm mb-2" style="color:#6b7280">
        {{ $t('results.count', { count: results.length, lang: currentLangLabel }) }}
      </div>
      <div v-for="s in results" :key="s.id" class="rounded border p-3" style="border-color:#e5e7eb">
        <div class="mb-1">{{ truncate(s.text, 200) }}</div>
        <div class="text-xs" style="color:#6b7280">
          {{ $t('results.authorLabel') }}{{ authorName(s.authorId) }} ｜ 
          {{ $t('results.bookLabel') }}{{ bookTitle(s.bookId) }} ｜ 
          {{ $t('results.chapterLabel') }}{{ s.chapter || '—' }}
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useDataset } from '~/composables/useDataset'
import { useQueryState } from '~/composables/useQueryState'
import { useFilterEngine } from '~/composables/useFilterEngine'
import { useFacets } from '~/composables/useFacets'

// —— 数据集 —— //
const {
  sentences, authorById, bookById
} = useDataset()

// —— 查询状态（URL 同步；语言不在这里管理） —— //
const { q, authors, books, genres, times, themes, devices, resetAll } = useQueryState()

// —— 过滤引擎（含语言隐形筛选） —— //
const { filter } = useFilterEngine()
const results = computed(() => filter(sentences, {
  q: q.value,
  authors: authors.value,
  books: books.value,
  genres: genres.value,
  times: times.value,
  themes: themes.value,
  devices: devices.value
}))

// —— Facets 计算 —— //
const { build: buildFacets } = useFacets()
const facets = computed(() => buildFacets(sentences, {
  q: q.value,
  authors: authors.value,
  books: books.value,
  genres: genres.value,
  times: times.value,
  themes: themes.value,
  devices: devices.value
}))

// —— UI 辅助 —— //
const { locale, t } = useI18n()
const currentLangLabel = computed(() => 
  locale.value === 'en' ? t('lang.enLabel') : t('lang.zhLabel')
)
function truncate(text: string, max = 200) {
  return text.length <= max ? text : text.slice(0, max) + '…'
}
function authorName(id: string) {
  const a = authorById.get(id)
  if (!a) return id
  return locale.value === 'en' ? (a.name_en || a.name_zh || id) : (a.name_zh || a.name_en || id)
}
function bookTitle(id: string) {
  const b = bookById.get(id)
  if (!b) return id
  return locale.value === 'en' ? (b.title_en || b.title_zh || id) : (b.title_zh || b.title_en || id)
}
</script>