<template>
  <header class="w-full border-b" style="border-color:#e5e7eb;">
    <div class="topbar-container" :style="{ maxWidth: 'var(--container-w)' }">
      <div class="topbar-row">
        <!-- 左侧：标题 + 副标题（底部对齐） -->
        <div class="topbar-left-section">
          <img src="/logo.svg" alt="Logo" class="topbar-logo" />
          <h1 class="topbar-title">{{ $t('site.title') }}</h1>
          <span class="topbar-subtitle">{{ $t('site.subtitle') }}</span>
        </div>
        <!-- 右侧：语言切换按钮（固定位置） -->
          <button
          class="topbar-lang-btn"
            @click="toggleLocale"
          :aria-label="targetLanguageLabel"
          >
          {{ targetLanguageLabel }}
          </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
// —— 语言切换（默认 zh ↔ en） ——
// 注意：此处依赖 @nuxtjs/i18n 已正确配置在 nuxt.config.ts 的 modules 中
const { locale, setLocale } = useI18n()

// 计算目标语言标签（显示要切换到的语言）
const targetLanguageLabel = computed(() => {
  return locale.value === 'zh' ? 'English' : '简体中文'
})

const toggleLocale = () => {
  const newLocale = locale.value === 'zh' ? 'en' : 'zh'
  setLocale(newLocale)
}
</script>

<style scoped>
.topbar-row {
  display: flex;
  align-items: flex-end; /* 底部对齐，让副标题和按钮对齐到标题底部 */
  justify-content: space-between; /* 左右分布，按钮固定在右侧 */
  padding: 12px 0; /* 移除左右 padding，让内容与主容器对齐 */
  gap: 16px; /* 左侧和右侧之间的最小间距 */
}

/* 左侧区域：标题 + 副标题（底部对齐） */
.topbar-left-section {
  display: flex;
  align-items: center; /* 居中对齐，让logo和标题垂直居中 */
  gap: 20px; /* 减小间距，消除空白 */
  flex: 1; /* 允许左侧区域占据剩余空间 */
  min-width: 0; /* 允许收缩 */
}

/* Logo 样式 */
.topbar-logo {
  width: 6rem; /* 大幅放大，与标题高度匹配 (96px) */
  height: 6rem; /* 大幅放大，与标题高度匹配 (96px) */
  min-width: 4rem; /* 确保最小宽度 */
  min-height: 4rem; /* 确保最小高度 */
  flex-shrink: 0; /* Logo 不收缩 */
  display: block;
  object-fit: contain; /* 保持SVG比例 */
  margin-right: -8px; /* 负边距，进一步减小视觉间距 */
}

.topbar-title {
  margin: 0;
  padding: 0;
  font-size: 2rem; /* 32px，更大更醒目 */
  font-weight: 600;
  line-height: 1.2; /* 减小行高，让标题更紧凑 */
  color: var(--color-fg);
  white-space: nowrap;
}

.topbar-subtitle {
  font-size: 0.875rem; /* 14px，比标题略小 */
  color: var(--color-muted);
  white-space: nowrap;
  /* 通过 margin-bottom 微调位置，使其与标题底部更对齐 */
  margin-bottom: 0.2em; /* 稍微向下调整，与标题底部对齐 */
}

.topbar-lang-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  font-size: 0.875rem;
  background-color: #ffffff;
  color: var(--color-fg);
  cursor: pointer;
  transition: background-color 0.2s ease;
  white-space: nowrap;
  /* 通过 margin-bottom 微调位置，使其与标题底部对齐 */
  margin-bottom: 0.2em; /* 与副标题保持相同的底部位置 */
  flex-shrink: 0; /* 按钮不收缩，保持固定宽度 */
}

.topbar-lang-btn:hover {
  background-color: #f9fafb;
}
</style>
