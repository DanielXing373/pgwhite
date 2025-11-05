<!-- =====================================================
File: components/FiltersPanel.vue
标题：筛选面板（六个筛选块的容器）
职责：
  - 负责布局和样式：分成6个小卡片（作者/书籍/题材/场景时间/主题/修辞手法）
  - 负责把父组件传下来的 facets 选项传给每个 FiltersFilterGroup
  - 负责把用户的勾选变化通过 update:xxx 事件回传给父组件
重要：
  - 我们支持多个 v-model（authors / books / genres / times / themes / devices）
  - 这些 v-model 在父组件(index.vue)里分别对应 useQueryState() 里的 ref 数组
未来扩展点：
  - 这里之后可以加每个分组的特殊 UI（例如作者头像、场景时间作为时间轴等）
  - 也可以在这里引入 sticky、折叠等交互
====================================================== -->

<template>
    <section class="mb-4">
      <!-- 标题行（例如“筛选条件”） -->
      <h2 class="text-sm mb-2">{{ title }}</h2>
  
      <!-- 垂直堆叠的六个筛选块卡片 -->
      <!-- 注意：这些 class 来自 theme.css，我们已经在 theme.css 里定义了
           .filter-stack, .filter-card, .filter-card--a, .filter-card--b
           如果需要统一改背景色、圆角等，请去 styles/theme.css 改，不要在这里到处写行内样式 -->
      <div class="filter-stack">
        <!-- 作者 -->
        <div class="filter-card filter-card--a">
          <FiltersFilterGroup
            v-model="localAuthors"
            :title="$t('filters.authors')"
            :options="facets.authors"
          />
        </div>
  
        <!-- 书籍 -->
        <div class="filter-card filter-card--b">
          <FiltersFilterGroup
            v-model="localBooks"
            :title="$t('filters.books')"
            :options="facets.books"
          />
        </div>
  
        <!-- 题材 -->
        <div class="filter-card filter-card--a">
          <FiltersFilterGroup
            v-model="localGenres"
            :title="$t('filters.genres')"
            :options="facets.genres"
          />
        </div>
  
        <!-- 场景时间 -->
        <div class="filter-card filter-card--b">
          <FiltersFilterGroup
            v-model="localTimes"
            :title="$t('filters.times')"
            :options="facets.times"
          />
        </div>
  
        <!-- 主题 -->
        <div class="filter-card filter-card--a">
          <FiltersFilterGroup
            v-model="localThemes"
            :title="$t('filters.themes')"
            :options="facets.themes"
          />
        </div>
  
        <!-- 修辞手法 -->
        <div class="filter-card filter-card--b">
          <FiltersFilterGroup
            v-model="localDevices"
            :title="$t('filters.devices')"
            :options="facets.devices"
          />
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
  }>()
  
  /**
   * 我们创建六个本地的 computed getter/setter（“代理”）
   * - getter 读的是 props.xxx
   * - setter 发出 emit('update:xxx', newVal)
   *
   * 这样我们就可以在模板里对 <FiltersFilterGroup v-model="localAuthors" />
   * 而不是直接对 props.authors 绑定（那会报“prop 是只读的”）。
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
  
  /**
   * 未来扩展点（请保留这段注释供后续自己/助手阅读）:
   *
   * - 如果将来“作者筛选”想加特殊 UI（例如搜索作者名、按国籍分组、展示头像）：
   *   我们可以把那一块从 <FiltersFilterGroup> 换成 <AuthorFilter> 组件。
   *   其它块不会受影响，因为它们各自独立。
   *
   * - 如果我们要给某些块加 tooltip 解释（比如“修辞手法是什么”），
   *   就在对应的 <div class="filter-card ..."> 里面加一行说明。
   *
   * - 如果将来我们要在手机端折叠部分筛选（例如只先显示作者+书籍，点展开后显示其余四项），
   *   这个组件是最合适的地方做“折叠逻辑”。index.vue 不需要知道细节。
   */
  </script>