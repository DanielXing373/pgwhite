<!-- =====================================================
File: pages/index.vue
标题：首页：接上数据/状态/过滤（含语言隐形筛选）
说明：此版仅演示：文本搜索 + 清空全部 + 语言跟随
====================================================== -->
<template>
  <!-- —— 搜索区 —— -->
  <section class="mb-4">
    <label class="block text-sm mb-2" style="color:#6b7280">{{ $t('search.placeholder') }}</label>
    <div class="flex gap-2">
      <input
        v-model="q"
        type="text"
        class="flex-1 px-3 py-2 rounded border"
        style="border-color:#e5e7eb"
        placeholder="如：日落 / friendship"
      />
      <button class="px-3 py-2 rounded border" style="border-color:#e5e7eb" @click="resetAll">
        {{ $t('search.clear') }}
      </button>
    </div>
  </section>

<!-- —— 筛选区（固定高度，内部滚动） —— -->
<section class="mb-4">
  <h2 class="text-sm mb-2">{{ $t('filters.title') }}</h2>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" style="height: var(--filters-h);">
    <FiltersFilterGroup v-model="authors" :title="'作者'" :options="facets.authors" />
    <FiltersFilterGroup v-model="books"   :title="'书籍'" :options="facets.books" />
    <FiltersFilterGroup v-model="genres"  :title="'题材'" :options="facets.genres" />
    <FiltersFilterGroup v-model="times"   :title="'场景时间'" :options="facets.times" />
    <FiltersFilterGroup v-model="themes"  :title="'主题'" :options="facets.themes" />
    <FiltersFilterGroup v-model="devices" :title="'修辞手法'" :options="facets.devices" />
  </div>
</section>

  <!-- —— 当前已选（先仅清空全部） —— -->
  <section class="mb-4">
    <div class="flex items-center justify-between">
      <div class="text-sm">
        {{ $t('filters.selected') }}：
        <span>暂无（V1.0 仅清空全部，后续接上 Chips）</span>
      </div>
      <button class="px-3 py-1 rounded border text-sm" style="border-color:#e5e7eb" @click="resetAll">
        {{ $t('filters.clearAll') }}
      </button>
    </div>
  </section>

  <!-- —— 结果列表（先渲染数量与卡片简版） —— -->
  <section class="space-y-3">
    <div v-if="results.length === 0" class="rounded border p-4 text-sm" style="border-color:#e5e7eb; color:#6b7280">
      {{ $t('results.empty') }}
    </div>
    <div v-else>
      <div class="text-sm mb-2" style="color:#6b7280">共 {{ results.length }} 条（已按界面语言自动筛选：{{ currentLangLabel }}）</div>
      <div v-for="s in results" :key="s.id" class="rounded border p-3" style="border-color:#e5e7eb">
        <div class="mb-1">{{ truncate(s.text, 200) }}</div>
        <div class="text-xs" style="color:#6b7280">
          作者：{{ authorName(s.authorId) }} ｜ 书籍：{{ bookTitle(s.bookId) }} ｜ 章节：{{ s.chapter || '—' }}
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
const { locale } = useI18n()
const currentLangLabel = computed(() => locale.value === 'en' ? '英文' : '中文')
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