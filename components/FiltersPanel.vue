<!-- =====================================================
File: components/FiltersPanel.vue
标题：筛选面板（标签页设计）
职责：
  - 标签页切换：顶部6个标签水平排列，一次只显示一个标签页内容
  - 每个标签右侧显示全局可见的已选数量计数
  - 文件夹样式的视觉设计
  - 保持所有现有功能不变（复选框、清空本组、chip 交互等）
====================================================== -->

<template>
    <section class="mb-4">
    <!-- 标签页容器（文件夹样式） -->
    <div class="filter-tabs-container" style="box-shadow: none; border: none;">
      <!-- 标签页按钮行 -->
      <div class="filter-tabs-header" style="box-shadow: none; background-color: transparent;">
        <button
          v-for="(tab, index) in tabs"
          :key="tab.key"
          :class="[
            'filter-tab-button',
            `filter-tab-button--${tab.key}`,
            { 'filter-tab-button--active': activeTab === tab.key },
            { 'filter-tab-button--first': index === 0 }
          ]"
          :style="{
            zIndex: activeTab === tab.key ? 50 : 0, /* 未选中标签使用 z-index: 0，确保在内容栏下方 */
            marginBottom: activeTab === tab.key ? '-3px' : '0'
          }"
          @click="activeTab = tab.key"
        >
          <!-- Layer 1: The Tab Shape (Background) -->
          <div 
            class="tab-shape"
            :style="activeTab === tab.key ? { backgroundColor: TAB_COLORS[tab.key] } : {}"
          ></div>
          
          <!-- Layer 2: The Content (Text) -->
          <span class="tab-text filter-tab-label">{{ tab.label }}</span>
          <span class="tab-text filter-tab-count" v-if="tab.count > 0">({{ tab.count }})</span>
        </button>
      </div>

      <!-- 标签页内容区域（固定高度，动态边框颜色） -->
      <div 
        class="filter-tab-content" 
        :style="{
          border: `3px solid ${contentPanelBorderColor}`,
          borderRadius: '0 0 8px 8px'
        }"
      >
        <!-- 作者 -->
        <div v-show="activeTab === 'authors'" class="filter-tab-panel">
          <FiltersFilterGroup
            v-model="localAuthors"
            title=""
            :options="facets.authors"
            :dynamicCounts="HIGHLIGHT_ENABLED_DIMS.includes('authors') ? props.facetCounts.authors : undefined"
            :hasActiveFilters="hasActiveFilters('authors')"
            dimension="authors"
          />
        </div>
  
        <!-- 书籍 -->
        <div v-show="activeTab === 'books'" class="filter-tab-panel">
          <FiltersFilterGroup
            v-model="localBooks"
            title=""
            :options="facets.books"
            :dynamicCounts="HIGHLIGHT_ENABLED_DIMS.includes('books') ? props.facetCounts.books : undefined"
            :hasActiveFilters="hasActiveFilters('books')"
            dimension="books"
          />
        </div>
  
        <!-- 人物 -->
        <div v-show="activeTab === 'characters'" class="filter-tab-panel">
          <FiltersFilterGroup
            v-model="localCharacters"
            title=""
            :options="facets.characters"
            :dynamicCounts="HIGHLIGHT_ENABLED_DIMS.includes('characters') ? props.facetCounts.characters : undefined"
            :hasActiveFilters="hasActiveFilters('characters')"
            dimension="characters"
          />
        </div>
  
        <!-- 场景时间 -->
        <div v-show="activeTab === 'times'" class="filter-tab-panel">
          <FiltersFilterGroup
            v-model="localTimes"
            title=""
            :options="facets.times"
            :dynamicCounts="HIGHLIGHT_ENABLED_DIMS.includes('times') ? props.facetCounts.times : undefined"
            dimension="times"
            :showMatchAll="true"
            :matchAll="props.timesAll"
            @update:matchAll="emit('update:timesAll', $event)"
          />
        </div>
  
        <!-- 主题 -->
        <div v-show="activeTab === 'themes'" class="filter-tab-panel">
          <FiltersFilterGroup
            v-model="localThemes"
            title=""
            :options="facets.themes"
            :dynamicCounts="HIGHLIGHT_ENABLED_DIMS.includes('themes') ? props.facetCounts.themes : undefined"
            dimension="themes"
            :showMatchAll="true"
            :matchAll="props.themesAll"
            @update:matchAll="emit('update:themesAll', $event)"
          />
        </div>
  
        <!-- 修辞手法 -->
        <div v-show="activeTab === 'devices'" class="filter-tab-panel">
          <FiltersFilterGroup
            v-model="localDevices"
            title=""
            :options="facets.devices"
            :dynamicCounts="HIGHLIGHT_ENABLED_DIMS.includes('devices') ? props.facetCounts.devices : undefined"
            dimension="devices"
            :showMatchAll="true"
            :matchAll="props.devicesAll"
            @update:matchAll="emit('update:devicesAll', $event)"
          />
        </div>

        <!-- 精准搜索 -->
        <div v-show="activeTab === 'search'" class="filter-tab-panel">
          <FiltersFilterSearch
            v-model="localQ"
            :placeholder="$t('search.placeholderWithTagsExample')"
          />
        </div>
        </div>
      </div>
    </section>
  </template>
  
  <script setup lang="ts">
  /**
   * Props 定义
   * 父组件(index.vue)会这样传：
   *
   * <FiltersPanel
   *   :title="$t('filters.title')"
   *   :facets="facets"
   *   v-model:authors="authors"
   *   v-model:books="books"
   *   v-model:characters="characters"
   *   v-model:times="times"
   *   v-model:themes="themes"
   *   v-model:devices="devices"
   * />
   *
   * Vue 在看到 v-model:authors="authors" 时，会自动期望：
   * - props.authors 存在
   * - 子组件会在需要更新时 emit('update:authors', newValue)
   *
   * 我们必须在这里把这些都声明清楚。
   */
  
  const props = defineProps<{
    title: string
  
    // facets: 每个筛选项的选项列表（已经是 label 化的结构）
    facets: {
      authors: { id: string; label: string }[]
      books:   { id: string; label: string }[]
      characters:  { id: string; label: string }[]
      times:   { id: string; label: string }[]
      themes:  { id: string; label: string }[]
      devices: { id: string; label: string }[]
    }

    // facetCounts: 当前过滤结果中每个标签的出现次数（用于 Spotlight 效果）
    facetCounts: {
      authors: Record<string, number>
      books: Record<string, number>
      characters: Record<string, number>
      times: Record<string, number>
      themes: Record<string, number>
      devices: Record<string, number>
    }
  
    // 这六个是父组件传进来的当前选中值
    // 注意：父组件里的这些是 ref<string[]>，传进来后在这里就是普通的 string[] 值
    authors: string[]
    books:   string[]
    characters:  string[]
    times:   string[]
    themes:  string[]
    devices: string[]
  
  // 精准搜索文本
  q?: string
  
  // 后三个维度的"满足所有筛选"复选框状态
  timesAll: boolean
  themesAll: boolean
  devicesAll: boolean
  }>()
  
  /**
   * Emit 定义
   * 我们需要对每个 v-model:* 提供对应的 update:* 事件。
   * 这样当用户在 FiltersFilterGroup 勾选/取消勾选时，
   * 我们可以把新的数组往父组件抛回去。
   */
  const emit = defineEmits<{
    (e: 'update:authors', v: string[]): void
    (e: 'update:books',   v: string[]): void
    (e: 'update:characters',  v: string[]): void
    (e: 'update:times',   v: string[]): void
    (e: 'update:themes',  v: string[]): void
    (e: 'update:devices', v: string[]): void
  (e: 'update:q', v: string): void
  (e: 'update:timesAll', v: boolean): void
  (e: 'update:themesAll', v: boolean): void
  (e: 'update:devicesAll', v: boolean): void
  }>()
  
  /**
 * 我们创建六个本地的 computed getter/setter（"代理"）
   * - getter 读的是 props.xxx
   * - setter 发出 emit('update:xxx', newVal)
   *
   * 这样我们就可以在模板里对 <FiltersFilterGroup v-model="localAuthors" />
 * 而不是直接对 props.authors 绑定（那会报"prop 是只读的"）。
   *
   * 这是多路 v-model 的标准写法。
   */
  const localAuthors = computed({
    get: () => props.authors,
    set: (val: string[]) => emit('update:authors', val)
  })
  
  const localBooks = computed({
    get: () => props.books,
    set: (val: string[]) => emit('update:books', val)
  })
  
  const localCharacters = computed({
    get: () => props.characters,
    set: (val: string[]) => emit('update:characters', val)
  })
  
  const localTimes = computed({
    get: () => props.times,
    set: (val: string[]) => emit('update:times', val)
  })
  
  const localThemes = computed({
    get: () => props.themes,
    set: (val: string[]) => emit('update:themes', val)
  })
  
  const localDevices = computed({
    get: () => props.devices,
    set: (val: string[]) => emit('update:devices', val)
  })
  
const localQ = computed({
  get: () => props.q || '',
  set: (val: string) => emit('update:q', val)
})

// —— 标签页切换逻辑 —— //
const { t } = useI18n()
const activeTab = ref<'authors' | 'books' | 'characters' | 'times' | 'themes' | 'devices' | 'search'>('authors')

// —— Spotlight 效果白名单：在前三个维度（Authors、Books、Characters）启用高亮和排序 —— //
const HIGHLIGHT_ENABLED_DIMS = ['authors', 'books', 'characters'] as const

// 计算是否有其他维度的筛选激活（用于判断是否启用 Spotlight）
function hasActiveFilters(excludeDimension: string): boolean {
  // 检查除了当前维度外的其他维度是否有选中项
  if (excludeDimension !== 'authors' && props.authors.length > 0) return true
  if (excludeDimension !== 'books' && props.books.length > 0) return true
  if (excludeDimension !== 'characters' && props.characters.length > 0) return true
  if (excludeDimension !== 'times' && props.times.length > 0) return true
  if (excludeDimension !== 'themes' && props.themes.length > 0) return true
  if (excludeDimension !== 'devices' && props.devices.length > 0) return true
  // 检查文本搜索
  if (props.q && props.q.trim().length > 0) return true
  return false
}

// 标签页颜色映射
const TAB_COLORS = {
  authors: '#FBCFE8', // 樱花粉
  books: '#FED7AA',   // 奶油橘
  characters: '#FDE047',  // 芝士黄
  times: '#BBF7D0',   // 薄荷绿
  themes: '#BAE6FD',  // 天空蓝
  devices: '#A5F3FC', // 冰川青
  search: '#D8B4FE'   // 香芋紫
} as const

// 计算内容面板的边框颜色（匹配激活标签页）
const contentPanelBorderColor = computed(() => {
  return TAB_COLORS[activeTab.value] || '#e5e7eb'
})

// 标签页配置（包含标签文本和已选数量）
const tabs = computed(() => [
  {
    key: 'authors' as const,
    label: t('filters.authors'),
    count: props.authors.length
  },
  {
    key: 'books' as const,
    label: t('filters.books'),
    count: props.books.length
  },
  {
    key: 'characters' as const,
    label: t('filters.characters'),
    count: props.characters.length
  },
  {
    key: 'times' as const,
    label: t('filters.times'),
    count: props.times.length
  },
  {
    key: 'themes' as const,
    label: t('filters.themes'),
    count: props.themes.length
  },
  {
    key: 'devices' as const,
    label: t('filters.devices'),
    count: props.devices.length
  },
  {
    key: 'search' as const,
    label: t('filters.search'),
    count: (props.q && props.q.length > 0) ? 1 : 0 // 如果有搜索文本，显示计数为1
  }
])
  </script>
