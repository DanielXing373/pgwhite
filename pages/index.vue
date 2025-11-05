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
    :canUndo="history.canUndo"
    :canRedo="history.canRedo"
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
                tag.isBook && locale === 'en' ? 'result-chip--book' : ''
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
import { useDataset, type Sentence } from '~/composables/useDataset'
import { useQueryState } from '~/composables/useQueryState'
import { useFilterEngine } from '~/composables/useFilterEngine'
import { useFacets } from '~/composables/useFacets'

// —— 数据集 —— //
const {
  sentences, authorById, bookById, genreById, timeById, themeById, deviceById
} = useDataset()

// —— 查询状态（URL 同步；语言不在这里管理） —— //
const { q, authors, books, genres, times, themes, devices, timesAll, themesAll, devicesAll, resetAll } = useQueryState()

// —— 历史记录管理 —— //
const history = useHistory()

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
 * 使用 nextTick 确保状态更新的原子性
 */
function applyState(state: ReturnType<typeof getCurrentState>) {
  // 创建新数组，确保引用发生变化，触发响应式更新
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

// 标记是否正在执行撤销/恢复操作（避免触发历史记录保存）
const isApplyingHistory = ref(false)

// 初始化历史记录（保存初始状态）
onMounted(() => {
  history.init(getCurrentState())
  
  // 添加键盘快捷键监听
  const handleKeyDown = (event: KeyboardEvent) => {
    // 检查是否在输入框中（忽略输入框中的快捷键）
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }
    
    // Mac: Command, Windows/Linux: Control
    const isModifierKey = event.metaKey || event.ctrlKey
    
    if (isModifierKey && event.key === 'z' && !event.shiftKey) {
      // Command/Ctrl + Z: 撤销
      event.preventDefault()
      handleUndo()
    } else if (isModifierKey && event.key === 'z' && event.shiftKey) {
      // Command/Ctrl + Shift + Z: 恢复
      event.preventDefault()
      handleRedo()
    }
  }
  
  window.addEventListener('keydown', handleKeyDown)
  
  // 清理事件监听器
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
})

// 监听搜索条件变化，保存到历史记录（延迟保存，避免频繁记录）
let saveTimer: ReturnType<typeof setTimeout> | null = null
watch([q, authors, books, genres, times, themes, devices, timesAll, themesAll, devicesAll], () => {
  // 如果正在应用历史记录，不保存
  if (isApplyingHistory.value) {
    return
  }
  
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    history.saveState(getCurrentState())
  }, 300)
}, { deep: true })

/**
 * 撤销操作
 */
function handleUndo() {
  const state = history.undo()
  if (state) {
    isApplyingHistory.value = true
    applyState(state)
    // 使用 nextTick 确保状态更新完成后再重置标记
    nextTick(() => {
      isApplyingHistory.value = false
    })
  }
}

/**
 * 恢复操作
 */
function handleRedo() {
  const state = history.redo()
  if (state) {
    isApplyingHistory.value = true
    applyState(state)
    // 使用 nextTick 确保状态更新完成后再重置标记
    nextTick(() => {
      isApplyingHistory.value = false
    })
  }
}

// —— 过滤引擎（含语言隐形筛选） —— //
const { filter } = useFilterEngine()
const results = computed(() => filter(sentences, {
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

/**
 * 移除句子文本中的 ID 前缀（如 [ZH01]、[EN01]）
 * 格式：[XX##] 后跟空格
 */
function removeIdPrefix(text: string): string {
  // 匹配格式：[两个大写字母 + 数字 + ] + 空格
  return text.replace(/^\[[A-Z]{2}\d+\]\s*/, '')
}

function truncate(text: string, max = 200) {
  // 先移除 ID 前缀，再截断
  const cleanedText = removeIdPrefix(text)
  return cleanedText.length <= max ? cleanedText : cleanedText.slice(0, max) + '…'
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

/**
 * 格式化书名：中文加书名号，英文返回原文本（在 CSS 中处理斜体）
 */
function formatBookTitle(title: string, isEN: boolean): string {
  if (isEN) {
    return title // 英文：返回原文本，通过 CSS class 设置斜体
  } else {
    return `《${title}》` // 中文：加书名号
  }
}

/**
 * 获取句子的所有标签（按顺序：作者、书籍、题材、场景时间、主题、修辞手法）
 * 返回格式：{ id: string, label: string, isBook?: boolean }[]
 */
function getSentenceTags(sentence: Sentence) {
  const tags: { id: string; label: string; isBook?: boolean }[] = []
  const isEN = locale.value === 'en'

  // 1. 作者
  const author = authorById.get(sentence.authorId)
  if (author) {
    tags.push({
      id: sentence.authorId,
      label: isEN ? (author.name_en || author.name_zh || sentence.authorId) : (author.name_zh || author.name_en || sentence.authorId)
    })
  }

  // 2. 书籍（格式化书名）
  const book = bookById.get(sentence.bookId)
  if (book) {
    const rawTitle = isEN ? (book.title_en || book.title_zh || sentence.bookId) : (book.title_zh || book.title_en || sentence.bookId)
    tags.push({
      id: sentence.bookId,
      label: formatBookTitle(rawTitle, isEN),
      isBook: true // 标记这是书名，用于应用斜体样式
    })
  }

  // 3. 题材
  sentence.genreIds.forEach(id => {
    const genre = genreById.get(id)
    if (genre) {
      tags.push({
        id,
        label: isEN ? (genre.name_en || genre.name_zh || id) : (genre.name_zh || genre.name_en || id)
      })
    }
  })

  // 4. 场景时间
  sentence.timeIds.forEach(id => {
    const time = timeById.get(id)
    if (time) {
      tags.push({
        id,
        label: isEN ? (time.name_en || time.name_zh || id) : (time.name_zh || time.name_en || id)
      })
    }
  })

  // 5. 主题
  sentence.themeIds.forEach(id => {
    const theme = themeById.get(id)
    if (theme) {
      tags.push({
        id,
        label: isEN ? (theme.name_en || theme.name_zh || id) : (theme.name_zh || theme.name_en || id)
      })
    }
  })

  // 6. 修辞手法
  sentence.deviceIds.forEach(id => {
    const device = deviceById.get(id)
    if (device) {
      tags.push({
        id,
        label: isEN ? (device.name_en || device.name_zh || id) : (device.name_zh || device.name_en || id)
      })
    }
  })

  return tags
}
</script>