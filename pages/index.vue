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
  v-model:timesAll="timesAll"
  v-model:themesAll="themesAll"
  v-model:devicesAll="devicesAll"
/>

  <!-- —— 当前已选（显示所有选中标签的 chips） —— -->
  <SelectedBar
    :selectedLabel="$t('filters.selected')"
    :clearAllText="$t('filters.clearAll')"
    :authors="authors"
    :books="books"
    :genres="genres"
    :times="times"
    :themes="themes"
    :devices="devices"
    :canUndo="history.canUndo.value"
    :canRedo="history.canRedo.value"
    @clearAll="resetAll"
    @undo="handleUndo"
    @redo="handleRedo"
  />

  <!-- —— 结果列表（先渲染数量与卡片简版） —— -->
  <section class="space-y-3">
    <div v-if="results.length === 0" class="rounded border p-4 text-sm result-card" style="border-color:#e5e7eb; color:#6b7280">
      {{ $t('results.empty') }}
    </div>
    <div v-else>
      <div class="results-count" style="color:#6b7280">
        {{ $t('results.count', { count: results.length, lang: currentLangLabel }) }}
      </div>
      <div class="result-stack">
        <div
          v-for="(s, index) in results"
          :key="s.id"
          :class="['result-card', index % 2 === 0 ? 'result-card--even' : 'result-card--odd']"
        >
          <!-- 句子文本 -->
          <div class="mb-3" style="color: var(--color-fg); line-height: 1.6;">
            {{ truncate(s.text, 200) }}
          </div>
          <!-- 标签 chips -->
          <div class="result-chips-container">
            <span
              v-for="(tag, tagIndex) in getSentenceTags(s)"
              :key="tag.id"
              :class="[
                'result-chip',
                tagIndex % 2 === 0 ? 'result-chip--even' : 'result-chip--odd',
                tag.isBook && locale === 'en' ? 'result-chip--book' : '',
                tag.isMatched ? 'result-chip--matched' : ''
              ]"
            >
              {{ tag.label }}
            </span>
          </div>
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
import { useHistoryManagement } from '~/composables/useHistoryManagement'
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'
import { useSearchResults } from '~/composables/useSearchResults'
import { useSentenceTags } from '~/composables/useSentenceTags'
import { truncate } from '~/composables/useUIHelpers'

// —— 数据集 —— //
const { sentences } = useDataset()

// —— 查询状态（URL 同步） —— //
const { q, authors, books, genres, times, themes, devices, timesAll, themesAll, devicesAll, resetAll } = useQueryState()

/**
 * 获取当前搜索条件状态
 */
function getCurrentState() {
  return {
    q: q.value,
    authors: authors.value,
    books: books.value,
    genres: genres.value,
    times: times.value,
    themes: themes.value,
    devices: devices.value,
    timesAll: timesAll.value,
    themesAll: themesAll.value,
    devicesAll: devicesAll.value
  }
}

/**
 * 应用搜索条件状态
 */
function applyState(state: ReturnType<typeof getCurrentState>) {
  authors.value = [...state.authors]
  books.value = [...state.books]
  genres.value = [...state.genres]
  times.value = [...state.times]
  themes.value = [...state.themes]
  devices.value = [...state.devices]
  q.value = state.q
  timesAll.value = state.timesAll
  themesAll.value = state.themesAll
  devicesAll.value = state.devicesAll
}

// —— 历史记录管理 —— //
const { history, handleUndo, handleRedo, setupHistoryWatcher } = useHistoryManagement(
  getCurrentState,
  applyState
)

// 监听搜索条件变化，保存到历史记录
setupHistoryWatcher(
  [q, authors, books, genres, times, themes, devices, timesAll, themesAll, devicesAll],
  getCurrentState,
  history.saveState
)

// 设置键盘快捷键
useKeyboardShortcuts(handleUndo, handleRedo)

// —— 过滤和排序 —— //
const { filter } = useFilterEngine()
const filters = computed(() => ({
  q: q.value,
  authors: authors.value,
  books: books.value,
  genres: genres.value,
  times: times.value,
  themes: themes.value,
  devices: devices.value,
  timesAll: timesAll.value,
  themesAll: themesAll.value,
  devicesAll: devicesAll.value
}))

const filteredResults = computed(() => filter(sentences, filters.value))
const { results } = useSearchResults(filteredResults, filters)

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

// —— 句子标签处理 —— //
const { getSentenceTags } = useSentenceTags(filters)

// —— UI 辅助 —— //
const { locale, t } = useI18n()
const currentLangLabel = computed(() => 
  locale.value === 'en' ? t('lang.enLabel') : t('lang.zhLabel')
)
</script>