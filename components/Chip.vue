<!-- ==============================================
File: components/Chip.vue
职责：通用 Chip 组件
用法：
  <Chip 
    :label="tag.label"
    :dimension="tag.dimension"
    :state="'active' | 'hover' | 'default'"
    :clickable="true"
    :isBook="false"
    @click="handleClick"
  />
说明：
  - 统一管理所有 chip 的样式和交互
  - 支持三种使用场景：筛选栏、已选栏、搜索结果
  - 通过 props 控制状态、可点击性、元素类型等
============================================== -->
<template>
  <component
    :is="clickable ? 'button' : 'span'"
    :class="chipClasses"
    :disabled="disabled"
    @click="handleClick"
  >
    {{ label }}
  </component>
</template>

<script setup lang="ts">
type Dimension = 'authors' | 'books' | 'genres' | 'times' | 'themes' | 'devices'
type ChipState = 'default' | 'hover' | 'active'

const props = withDefaults(defineProps<{
  label: string
  dimension?: Dimension
  state?: ChipState // 状态：default（未选中）、hover（hover/未匹配）、active（选中/匹配）
  clickable?: boolean // 是否可点击
  disabled?: boolean // 是否禁用
  isBook?: boolean // 是否为书名（用于斜体样式）
}>(), {
  state: 'default',
  clickable: false,
  disabled: false,
  isBook: false
})

const emit = defineEmits<{
  (e: 'click'): void
}>()

const { locale } = useI18n()
const isEnglish = computed(() => locale.value === 'en')

const chipClasses = computed(() => {
  const baseClass = props.clickable ? 'filter-chip' : 'result-chip'
  const dimensionClass = props.dimension ? `${baseClass}--${props.dimension}` : ''
  const stateClass = props.state === 'active' 
    ? `${baseClass}--active` 
    : props.state === 'hover' 
    ? `${baseClass}--hover` 
    : ''
  const bookClass = props.isBook && isEnglish.value ? `${baseClass}--book` : ''
  
  return [
    baseClass,
    dimensionClass,
    stateClass,
    bookClass
  ].filter(Boolean).join(' ')
})

function handleClick() {
  if (props.clickable && !props.disabled) {
    emit('click')
  }
}
</script>

<style scoped>
/* 基础样式在 theme.css 中定义 */
/* 这里只处理组件特定的样式 */
</style>

