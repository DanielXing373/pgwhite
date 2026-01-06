<!-- =====================================================
File: pages/index.vue
标题：首页：接上数据/状态/过滤（含语言隐形筛选）
说明：此版仅演示：文本搜索 + 清空全部 + 语言跟随
====================================================== -->
<template>
<!-- —— 筛选区（固定高度，内部滚动） —— -->
<!-- —— 筛选区（现在每个筛选块自带浅色背景和边框） —— -->
<div class="filters-section">
  <h2 class="filters-subtitle">{{ $t('filters.subtitle') }}</h2>
  <FiltersPanel
    :title="$t('filters.title')"
    :facets="facets"
    :facetCounts="facetCounts"
    v-model:authors="authors"
    v-model:books="books"
    v-model:characters="characters"
    v-model:times="times"
    v-model:themes="themes"
    v-model:devices="devices"
    v-model:q="q"
    v-model:timesAll="timesAll"
    v-model:themesAll="themesAll"
    v-model:devicesAll="devicesAll"
  />
</div>

  <!-- —— 当前已选（显示所有选中标签的 chips） —— -->
  <div ref="selectedBarRef" id="selected-bar-container">
    <SelectedBar
      :selectedLabel="$t('filters.selected')"
      :clearAllText="$t('filters.clearAll')"
      :authors="authors"
      :books="books"
      :characters="characters"
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
  </div>

  <!-- —— 结果列表（先渲染数量与卡片简版） —— -->
  <!-- Note: FlyingGhosts has been moved to app.vue root level to avoid blur/opacity conflicts -->
  <section class="space-y-3">
    <div v-if="results.length === 0" class="results-count" style="color:#6b7280">
      <span class="results-count-line"></span><span class="results-count-text">{{ $t('results.empty') }}</span><span class="results-count-line"></span>
    </div>
    <div v-else>
      <div class="results-count" style="color:#6b7280">
        <span class="results-count-line"></span><span class="results-count-text">{{ $t('results.count', { count: results.length }) }}</span><span class="results-count-line"></span>
      </div>
      <!-- 分页器（顶部） -->
      <Pagination
        v-if="totalPages > 0"
        :currentPage="currentPage"
        :totalPages="totalPages"
        @page-change="handlePageChange"
        class="pagination-top"
      />
      <div 
        class="result-stack"
        :class="{
          'result-stack--refreshing': isRefreshing
        }"
      >
        <div
          v-for="(s, index) in paginatedResults"
          :key="s.id"
          :class="['result-card', index % 2 === 0 ? 'result-card--even' : 'result-card--odd']"
          :ref="el => setCardRef(el, s.id, index)"
        >
          <!-- 句子文本 -->
          <div class="result-text-wrapper">
            <div 
              :ref="el => setTextRef(el, s.id)"
              class="result-text" 
              :class="{ 
                'result-text--expanded': expandedSentences.has(s.id),
                'result-text--collapsed': !expandedSentences.has(s.id)
              }"
            >
              {{ removeIdPrefix(s.text) }}
            </div>
            <button
              v-if="needsExpandButton.has(s.id)"
              class="result-text-toggle"
              @click="toggleSentence(s.id)"
            >
              {{ expandedSentences.has(s.id) ? $t('results.collapse') : $t('results.expand') }}
            </button>
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
                  @click.stop="(e) => handleAddTag(tag.dimension, tag.id, tag.label, e)"
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
      <!-- 分页器（底部） -->
      <Pagination
        v-if="totalPages > 0"
        :currentPage="currentPage"
        :totalPages="totalPages"
        @page-change="handlePageChange"
        class="pagination-bottom"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, watch, computed, ref, nextTick } from 'vue'
import Pagination from '~/components/Pagination.vue'
import SelectedBar from '~/components/SelectedBar.vue'
import { useDataset } from '~/composables/useDataset'
import { useQueryState } from '~/composables/useQueryState'
import { useFilterEngine } from '~/composables/useFilterEngine'
import { useFacets } from '~/composables/useFacets'
import { useHistoryManagement } from '~/composables/useHistoryManagement'
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'
import { useSearchResults } from '~/composables/useSearchResults'
import { useSentenceTags } from '~/composables/useSentenceTags'
import { removeIdPrefix } from '~/composables/useUIHelpers'
import { useFlyingChips } from '~/composables/useFlyingChips'

// —— 数据集 —— //
const { sentences } = useDataset()

// —— 查询状态（URL 同步） —— //
const { q, authors, books, characters, times, themes, devices, timesAll, themesAll, devicesAll, resetAll } = useQueryState()

/**
 * 获取当前搜索条件状态
 */
function getCurrentState() {
  return {
    q: q.value,
    authors: authors.value,
    books: books.value,
    characters: characters.value,
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
  characters.value = [...state.characters]
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
  [q, authors, books, characters, times, themes, devices, timesAll, themesAll, devicesAll],
  getCurrentState,
  history.saveState
)

// —— 过滤和排序 —— //
const { filter } = useFilterEngine()
const filters = computed(() => ({
  q: q.value,
  authors: authors.value,
  books: books.value,
  characters: characters.value,
  times: times.value,
  themes: themes.value,
  devices: devices.value,
  timesAll: timesAll.value,
  themesAll: themesAll.value,
  devicesAll: devicesAll.value
}))

const filteredResults = computed(() => filter(sentences, filters.value))
const { results } = useSearchResults(filteredResults, filters)

// —— 分页逻辑 —— //
const ITEMS_PER_PAGE = 10
const currentPage = ref(1)

// 计算总页数
const totalPages = computed(() => {
  return Math.ceil(results.value.length / ITEMS_PER_PAGE)
})

// 分页后的结果列表
const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE
  const end = start + ITEMS_PER_PAGE
  return results.value.slice(start, end)
})

// 当搜索结果变化时，重置到第一页（如果当前页超出范围）
watch([results, totalPages], () => {
  if (currentPage.value > totalPages.value && totalPages.value > 0) {
    currentPage.value = 1
  } else if (totalPages.value === 0) {
    currentPage.value = 1
  }
})

// SelectedBar 引用（使用 HTMLElement 类型）
const selectedBarRef = ref<HTMLElement | null>(null)

// 处理页码变化
function handlePageChange(page: number) {
  currentPage.value = page
  // 滚动到 SelectedBar（已选 chips 部分）
  nextTick(() => {
    if (selectedBarRef.value) {
      const barTop = selectedBarRef.value.getBoundingClientRect().top + window.scrollY
      const offset = 20 // 距离顶部的小偏移
      window.scrollTo({ 
        top: barTop - offset, 
        behavior: 'smooth' 
      })
    }
  })
}

// 设置键盘快捷键（必须在分页逻辑定义之后）
useKeyboardShortcuts(handleUndo, handleRedo, {
  currentPage,
  totalPages,
  onPageChange: handlePageChange
})

// —— 句子展开/收起状态管理（基于行数） —— //
const expandedSentences = ref<Set<string>>(new Set())
const needsExpandButton = ref<Set<string>>(new Set())
const textRefs = new Map<string, HTMLElement>()
const cardRefs = new Map<string, HTMLElement>()

// 设置卡片元素的引用
function setCardRef(el: Element | ComponentPublicInstance | null, sentenceId: string, index: number) {
  const htmlEl = el as HTMLElement | null
  if (htmlEl) {
    cardRefs.set(sentenceId, htmlEl)
  } else {
    cardRefs.delete(sentenceId)
  }
}

// 设置文本元素的引用
function setTextRef(el: Element | ComponentPublicInstance | null, sentenceId: string) {
  const htmlEl = el as HTMLElement | null
  if (htmlEl) {
    textRefs.set(sentenceId, htmlEl)
    // 在下一个tick检测是否需要展开按钮
    nextTick(() => {
      checkIfNeedsExpand(sentenceId, htmlEl)
    })
  } else {
    textRefs.delete(sentenceId)
    needsExpandButton.value.delete(sentenceId)
  }
}

// 检测文本是否超过2行，需要显示展开按钮
function checkIfNeedsExpand(sentenceId: string, element?: HTMLElement) {
  const el = element || textRefs.get(sentenceId)
  if (!el) return

  // 如果当前是展开状态，不检测
  if (expandedSentences.value.has(sentenceId)) {
    return
  }

  // 确保元素处于折叠状态
  const wasExpanded = el.classList.contains('result-text--expanded')
  if (wasExpanded) {
    el.classList.remove('result-text--expanded')
  }
  if (!el.classList.contains('result-text--collapsed')) {
    el.classList.add('result-text--collapsed')
  }

  // 使用 requestAnimationFrame 确保样式已应用
  requestAnimationFrame(() => {
    // 获取行高（line-height）
    const computedStyle = window.getComputedStyle(el)
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.6
    const maxHeight = lineHeight * 2 // 2行的最大高度

    // 临时移除行数限制，检测完整高度
    el.classList.remove('result-text--collapsed')
    const fullHeight = el.scrollHeight
    
    // 立即恢复行数限制（避免闪烁）
    el.classList.add('result-text--collapsed')

    // 如果完整高度大于2行的最大高度，说明超过2行
    if (fullHeight > maxHeight + 1) { // +1 是为了处理舍入误差
      needsExpandButton.value.add(sentenceId)
    } else {
      needsExpandButton.value.delete(sentenceId)
    }
  })
}

// 切换句子展开/收起状态
function toggleSentence(sentenceId: string) {
  if (expandedSentences.value.has(sentenceId)) {
    expandedSentences.value.delete(sentenceId)
    // 收起后重新检测是否需要展开按钮
    nextTick(() => {
      checkIfNeedsExpand(sentenceId)
    })
  } else {
    expandedSentences.value.add(sentenceId)
  }
}

// 监听分页结果变化，重新检测所有文本元素
watch(paginatedResults, () => {
  nextTick(() => {
    textRefs.forEach((el, sentenceId) => {
      checkIfNeedsExpand(sentenceId, el)
    })
  })
}, { deep: true })

// —— Facet 计数（Spotlight 效果） —— //
// 统计当前过滤结果中每个标签的出现次数
const facetCounts = computed(() => {
  const counts = {
    authors: {} as Record<string, number>,
    books: {} as Record<string, number>,
    characters: {} as Record<string, number>,
    times: {} as Record<string, number>,
    themes: {} as Record<string, number>,
    devices: {} as Record<string, number>
  }

  // 遍历当前过滤结果，统计每个标签的出现次数
  results.value.forEach(sentence => {
    // 作者
    const authorId = sentence.authorId
    if (!counts.authors[authorId]) {
      counts.authors[authorId] = 0
    }
    counts.authors[authorId] = (counts.authors[authorId] || 0) + 1

    // 书籍
    const bookId = sentence.bookId
    if (!counts.books[bookId]) {
      counts.books[bookId] = 0
    }
    counts.books[bookId] = (counts.books[bookId] || 0) + 1

    // 人物（可能有多个）
    sentence.characterIds.forEach(id => {
      if (!counts.characters[id]) {
        counts.characters[id] = 0
      }
      counts.characters[id]++
    })

    // 场景时间（可能有多个）
    sentence.timeIds.forEach(id => {
      if (!counts.times[id]) {
        counts.times[id] = 0
      }
      counts.times[id]++
    })

    // 主题（可能有多个）
    sentence.themeIds.forEach(id => {
      if (!counts.themes[id]) {
        counts.themes[id] = 0
      }
      counts.themes[id]++
    })

    // 修辞手法（可能有多个）
    sentence.deviceIds.forEach(id => {
      if (!counts.devices[id]) {
        counts.devices[id] = 0
      }
      counts.devices[id]++
    })
  })

  return counts
})

// —— 搜索结果刷新微交互（"Breath & Blur"效果） —— //
const isRefreshing = ref(false)

// 监听搜索结果变化，触发微交互
watch(results, () => {
  isRefreshing.value = true
  setTimeout(() => {
    isRefreshing.value = false
  }, 300)
}, { deep: true })

// —— 中空取消逻辑：监听选中标签变化，移除飞行中的标签 —— //
// 当标签从选中数组中移除时，立即取消飞行中的动画
const previousSelectedTags = ref<Set<string>>(new Set())
let isInitializing = true // 防止初始化时误删除

function getSelectedTagsSet() {
  const set = new Set<string>()
  authors.value.forEach(id => set.add(`authors-${id}`))
  books.value.forEach(id => set.add(`books-${id}`))
  characters.value.forEach(id => set.add(`characters-${id}`))
  times.value.forEach(id => set.add(`times-${id}`))
  themes.value.forEach(id => set.add(`themes-${id}`))
  devices.value.forEach(id => set.add(`devices-${id}`))
  return set
}

watch([authors, books, characters, times, themes, devices], () => {
  const currentSet = getSelectedTagsSet()
  
  // 跳过初始化阶段
  if (isInitializing) {
    previousSelectedTags.value = currentSet
    isInitializing = false
    return
  }
  
  // 找出被移除的标签
  previousSelectedTags.value.forEach(tagKey => {
    if (!currentSet.has(tagKey)) {
      // 🛑 DISABLED: 中空取消功能已禁用
      // 原因：当URL更新时，响应式数组可能在同步过程中短暂重置，导致误判标签被移除
      // 解决方案：让动画自然完成，用户可以在动画完成后手动移除标签
      // const [dimension, id] = tagKey.split('-', 2)
      // removeGhost(id, dimension, true) // removeAll = true - DISABLED
    }
  })
  
  previousSelectedTags.value = currentSet
}, { deep: true, immediate: true })

// —— Facets 计算 —— //
// 注意：facets 只根据语言生成，不受文本搜索和标签筛选影响
// 这样用户可以随时看到所有可用的标签选项，自由选择
const { build: buildFacets } = useFacets()
const facets = computed(() => buildFacets(sentences, {
  q: '', // 不传递文本搜索，让 facets 显示所有选项
  authors: [],
  books: [],
  characters: [],
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

// —— 飞行标签动画 —— //
const { triggerFly, removeGhost } = useFlyingChips()

/**
 * 处理添加标签
 */
async function handleAddTag(dimension: string, id: string, label: string, event: MouseEvent) {
  // 检查是否已存在，避免重复添加
  let alreadyExists = false
  switch (dimension) {
    case 'authors':
      alreadyExists = authors.value.includes(id)
      if (!alreadyExists) {
        authors.value = [...authors.value, id]
      }
      break
    case 'books':
      alreadyExists = books.value.includes(id)
      if (!alreadyExists) {
        books.value = [...books.value, id]
      }
      break
    case 'characters':
      alreadyExists = characters.value.includes(id)
      if (!alreadyExists) {
        characters.value = [...characters.value, id]
      }
      break
    case 'times':
      alreadyExists = times.value.includes(id)
      if (!alreadyExists) {
        times.value = [...times.value, id]
      }
      break
    case 'themes':
      alreadyExists = themes.value.includes(id)
      if (!alreadyExists) {
        themes.value = [...themes.value, id]
      }
      break
    case 'devices':
      alreadyExists = devices.value.includes(id)
      if (!alreadyExists) {
        devices.value = [...devices.value, id]
      }
      break
  }
  
  // 如果已存在，不触发动画
  if (alreadyExists) {
    activeChipId.value = null
    return
  }
  
  // 触发飞行动画
  // 查找点击的按钮元素（可能是添加按钮或chip本身）
  const clickTarget = event.target as HTMLElement
  const chipButton = clickTarget.closest('.result-chip') || clickTarget.closest('.result-chip-action-btn')
  
  if (chipButton) {
    const startRect = chipButton.getBoundingClientRect()
    
    // 等待DOM更新
    await nextTick()
    
    // 查找目标元素，可能需要多次尝试
    const destinationId = `active-tag-${dimension}-${id}`
    let destinationEl = document.getElementById(destinationId)
    
    // 如果找不到，等待一下再试
    if (!destinationEl) {
      await new Promise(resolve => setTimeout(resolve, 50))
      destinationEl = document.getElementById(destinationId)
    }
    
    if (destinationEl) {
      // 初始时目标标签不可见（作为占位符）
      destinationEl.style.opacity = '0'
      const endRect = destinationEl.getBoundingClientRect()
      
      // 触发飞行动画
      triggerFly(id, dimension, label, startRect, endRect)
      
      // 动画结束后显示目标标签
      setTimeout(() => {
        if (destinationEl) {
          destinationEl.style.opacity = '1'
          destinationEl.style.transition = 'opacity 0.2s ease-in'
        }
      }, 550) // 与动画持续时间一致
    }
  }
  
  // 添加后隐藏按钮
  activeChipId.value = null
}

/**
 * 处理删除标签
 */
function handleRemoveTag(dimension: string, id: string) {
  // 移除飞行中的标签（如果存在）- 中空取消逻辑（移除所有匹配的飞行实例）
  removeGhost(id, dimension, true) // removeAll = true
  
  switch (dimension) {
    case 'authors':
      authors.value = authors.value.filter(aid => aid !== id)
      break
    case 'books':
      books.value = books.value.filter(bid => bid !== id)
      break
    case 'characters':
      characters.value = characters.value.filter(cid => cid !== id)
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