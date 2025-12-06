<!-- =====================================================
File: pages/index.vue
标题：首页：接上数据/状态/过滤（含语言隐形筛选）
说明：此版仅演示：文本搜索 + 清空全部 + 语言跟随
====================================================== -->
<template>
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
  v-model:q="q"
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
    @removeTag="handleRemoveTag"
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
            <div
              v-for="(tag, tagIndex) in getSentenceTags(s)"
              :key="tag.id"
              class="result-chip-wrapper"
            >
              <button
                :class="[
                  'result-chip',
                  `result-chip--${tag.dimension}`,
                  tagIndex % 2 === 0 ? 'result-chip--even' : 'result-chip--odd',
                  tag.isBook && locale === 'en' ? 'result-chip--book' : '',
                  tag.isMatched ? 'result-chip--matched result-chip--active' : 'result-chip--hover'
                ]"
                @click="handleChipClick(s.id, tag)"
              >
                {{ tag.label }}
              </button>
              <!-- 添加/删除按钮 -->
              <div
                v-if="activeChipId?.quoteId === s.id && activeChipId?.tagId === `${tag.dimension}-${tag.id}`"
                class="result-chip-action"
              >
                <button
                  v-if="!tag.isMatched"
                  class="result-chip-action-btn result-chip-action-btn--add"
                  @click.stop="handleAddTag(tag.dimension, tag.id)"
                >
                  <span class="result-chip-action-icon">+</span>
                  {{ $t('results.add') }}
                </button>
                <button
                  v-else
                  class="result-chip-action-btn result-chip-action-btn--remove"
                  @click.stop="handleRemoveTag(tag.dimension, tag.id)"
                >
                  <span class="result-chip-action-icon">×</span>
                  {{ $t('results.remove') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
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
// 注意：facets 只根据语言生成，不受文本搜索和标签筛选影响
// 这样用户可以随时看到所有可用的标签选项，自由选择
const { build: buildFacets } = useFacets()
const facets = computed(() => buildFacets(sentences, {
  q: '', // 不传递文本搜索，让 facets 显示所有选项
  authors: [],
  books: [],
  genres: [],
  times: [],
  themes: [],
  devices: []
}))

// —— 句子标签处理 —— //
const { getSentenceTags } = useSentenceTags(filters)

// —— UI 辅助 —— //
const { locale, t } = useI18n()
const currentLangLabel = computed(() => 
  locale.value === 'en' ? t('lang.enLabel') : t('lang.zhLabel')
)

// —— 管理显示操作按钮的 chip —— //
// 使用复合键来跟踪特定 quote 中的特定 tag
const activeChipId = ref<{ quoteId: string; tagId: string } | null>(null)

// 点击外部区域时隐藏按钮
onMounted(() => {
  document.addEventListener('click', (e) => {
    // 如果点击的不是 chip 或操作按钮，则隐藏
    const target = e.target as HTMLElement
    if (!target.closest('.result-chip-wrapper')) {
      activeChipId.value = null
    }
  })
})

/**
 * 处理 chip 点击
 */
function handleChipClick(quoteId: string, tag: { dimension: string; id: string }) {
  const tagId = `${tag.dimension}-${tag.id}`
  const currentKey = activeChipId.value
  // 如果点击的是同一个 quote 中的同一个 tag，则隐藏按钮；否则显示按钮
  if (currentKey?.quoteId === quoteId && currentKey?.tagId === tagId) {
    activeChipId.value = null
  } else {
    activeChipId.value = { quoteId, tagId }
  }
}

/**
 * 处理添加标签
 */
function handleAddTag(dimension: string, id: string) {
  switch (dimension) {
    case 'authors':
      if (!authors.value.includes(id)) {
        authors.value = [...authors.value, id]
      }
      break
    case 'books':
      if (!books.value.includes(id)) {
        books.value = [...books.value, id]
      }
      break
    case 'genres':
      if (!genres.value.includes(id)) {
        genres.value = [...genres.value, id]
      }
      break
    case 'times':
      if (!times.value.includes(id)) {
        times.value = [...times.value, id]
      }
      break
    case 'themes':
      if (!themes.value.includes(id)) {
        themes.value = [...themes.value, id]
      }
      break
    case 'devices':
      if (!devices.value.includes(id)) {
        devices.value = [...devices.value, id]
      }
      break
  }
  // 添加后隐藏按钮
  activeChipId.value = null
}

/**
 * 处理删除标签
 */
function handleRemoveTag(dimension: string, id: string) {
  switch (dimension) {
    case 'authors':
      authors.value = authors.value.filter(aid => aid !== id)
      break
    case 'books':
      books.value = books.value.filter(bid => bid !== id)
      break
    case 'genres':
      genres.value = genres.value.filter(gid => gid !== id)
      break
    case 'times':
      times.value = times.value.filter(tid => tid !== id)
      break
    case 'themes':
      themes.value = themes.value.filter(tid => tid !== id)
      break
    case 'devices':
      devices.value = devices.value.filter(did => did !== id)
      break
  }
  // 删除后隐藏按钮
  activeChipId.value = null
}
</script>