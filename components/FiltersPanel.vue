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
            zIndex: activeTab === tab.key ? 50 : (tabs.length - index)
          }"
          @click="activeTab = tab.key"
        >
          <!-- Layer 1: The Tab Shape (Background) -->
          <div class="tab-shape"></div>
          
          <!-- Layer 2: The Content (Text) -->
          <span class="tab-text filter-tab-label">{{ tab.label }}</span>
          <span class="tab-text filter-tab-count" v-if="tab.count > 0">({{ tab.count }})</span>
        </button>
      </div>

      <!-- 标签页内容区域（固定高度） -->
      <div class="filter-tab-content" style="border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <!-- 作者 -->
        <div v-show="activeTab === 'authors'" class="filter-tab-panel">
          <FiltersFilterGroup
            v-model="localAuthors"
            title=""
            :options="facets.authors"
            dimension="authors"
          />
        </div>

        <!-- 书籍 -->
        <div v-show="activeTab === 'books'" class="filter-tab-panel">
          <FiltersFilterGroup
            v-model="localBooks"
            title=""
            :options="facets.books"
            dimension="books"
          />
        </div>

        <!-- 题材 -->
        <div v-show="activeTab === 'genres'" class="filter-tab-panel">
          <FiltersFilterGroup
            v-model="localGenres"
            title=""
            :options="facets.genres"
            dimension="genres"
          />
        </div>

        <!-- 场景时间 -->
        <div v-show="activeTab === 'times'" class="filter-tab-panel">
          <FiltersFilterGroup
            v-model="localTimes"
            title=""
            :options="facets.times"
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
 *   v-model:genres="genres"
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
    genres:  { id: string; label: string }[]
    times:   { id: string; label: string }[]
    themes:  { id: string; label: string }[]
    devices: { id: string; label: string }[]
  }

  // 这六个是父组件传进来的当前选中值
  // 注意：父组件里的这些是 ref<string[]>，传进来后在这里就是普通的 string[] 值
  authors: string[]
  books:   string[]
  genres:  string[]
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
  (e: 'update:genres',  v: string[]): void
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

const localGenres = computed({
  get: () => props.genres,
  set: (val: string[]) => emit('update:genres', val)
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
const activeTab = ref<'authors' | 'books' | 'genres' | 'times' | 'themes' | 'devices' | 'search'>('authors')

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
    key: 'genres' as const,
    label: t('filters.genres'),
    count: props.genres.length
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
