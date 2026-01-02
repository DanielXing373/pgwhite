<!-- =====================================================
File: components/FloatingButtons.vue
标题：右下角悬浮按钮组
说明：返回顶部、帮助、我要投稿（后两个为占位）
====================================================== -->
<template>
  <!-- 返回顶部（最上面） -->
  <button
    class="floating-btn floating-btn--top"
    @click="scrollToTop"
    :aria-label="$t('floatingButtons.scrollToTop')"
  >
    <span class="floating-btn-label">{{ $t('floatingButtons.scrollToTop') }}</span>
    <span class="floating-btn-icon">↑</span>
  </button>

  <!-- 帮助（中间） -->
  <button
    class="floating-btn floating-btn--help"
    :aria-label="$t('floatingButtons.help')"
    @click="handleHelpClick"
  >
    <span class="floating-btn-label">{{ $t('floatingButtons.help') }}</span>
    <span class="floating-btn-icon">?</span>
  </button>

  <!-- 我要投稿（最下面） -->
  <button
    class="floating-btn floating-btn--submit"
    :aria-label="$t('floatingButtons.submit')"
    @click="handleSubmitClick"
  >
    <span class="floating-btn-label">{{ $t('floatingButtons.submit') }}</span>
    <span class="floating-btn-icon">✎</span>
  </button>
</template>

<script setup lang="ts">
const { t } = useI18n()

/**
 * 滚动到页面顶部
 */
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

/**
 * 处理帮助按钮点击（占位，显示提示）
 */
function handleHelpClick() {
  alert(t('floatingButtons.comingSoon'))
}

/**
 * 处理投稿按钮点击（占位，显示提示）
 */
function handleSubmitClick() {
  alert(t('floatingButtons.comingSoon'))
}
</script>

<style scoped>
/* 所有按钮共用基础样式 */
.floating-btn {
  position: fixed;
  right: 20px;
  width: 48px;
  height: 48px;
  border-radius: 24px;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center; /* 默认居中对齐图标 */
  transition: width 0.3s ease, padding 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease, justify-content 0.3s ease;
  z-index: 1000;
  overflow: hidden;
  padding: 0;
}

/* 每个按钮独立定位，避免互相影响 */
.floating-btn--top {
  bottom: 140px; /* 最上面：20px + 48px + 12px + 48px + 12px */
}

.floating-btn--help {
  bottom: 80px; /* 中间：20px + 48px + 12px gap */
}

.floating-btn--submit {
  bottom: 20px; /* 最下面 */
}

.floating-btn:hover {
  width: auto;
  min-width: 48px;
  padding-left: 16px;
  padding-right: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  background-color: #f9fafb;
  justify-content: flex-start; /* hover时切换到左对齐，向右展开 */
}

.floating-btn-label {
  opacity: 0;
  width: 0;
  overflow: hidden;
  white-space: nowrap;
  font-size: 0.875rem;
  color: var(--color-fg);
  margin-right: 8px;
  transition: opacity 0.3s ease, width 0.3s ease;
  order: 1; /* 标签在左侧 */
  /* 默认状态下完全隐藏，不占用空间 */
  position: absolute;
  left: -9999px;
}

.floating-btn:hover .floating-btn-label {
  position: static; /* hover 时恢复正常流 */
}

.floating-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--color-fg);
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  line-height: 1;
  margin: 0;
  padding: 0;
  transition: none; /* 图标保持原位，不移动 */
  order: 2; /* 图标在右侧 */
}

.floating-btn:hover .floating-btn-label {
  opacity: 1;
  width: auto;
}
</style>

