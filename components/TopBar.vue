<template>
  <header class="w-full border-b bg-white" style="border-color:#f5f5f4;">
    <div class="topbar-container" :style="{ maxWidth: 'var(--container-w)' }">
      <div class="topbar-row">
        <!-- 左侧：标题 + 副标题（底部对齐） -->
        <div class="topbar-left-section">
          <img src="/logo.svg" alt="Logo" class="topbar-logo" />
          <h1 class="topbar-title">{{ $t('site.title') }}</h1>
          <span class="topbar-subtitle">{{ $t('site.subtitle') }}</span>
        </div>
        <!-- 右侧：Import (R&D) + 语言切换 -->
          <div class="topbar-right">
            <NuxtLink to="/import" class="topbar-import-link">Import</NuxtLink>
            <button
              class="topbar-lang-btn"
              @click="toggleLocale"
              :aria-label="targetLanguageLabel"
            >
              {{ targetLanguageLabel }}
            </button>
          </div>
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
  align-items: center; /* 居中对齐，让语言切换按钮与主标题水平对齐 */
  justify-content: space-between; /* 左右分布，按钮固定在右侧 */
  padding: 8px 0; /* 减少上下内边距，缩短主标题与页面顶部的距离 - 可在此处调整 */
  gap: 16px; /* 左侧和右侧之间的最小间距 */
}

/* 左侧区域：标题 + 副标题（底部对齐） */
.topbar-left-section {
  display: flex;
  align-items: center; /* 居中对齐，保持主标题在原来的位置 */
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
  /* 确保主标题位置稳定 */
  display: inline-block;
}

.topbar-subtitle {
  font-size: 0.875rem; /* 14px，比标题略小 */
  color: var(--color-muted);
  white-space: nowrap;
  /* 通过 margin-top 让副标题底部与主标题底部对齐
     主标题高度约 32px * 1.2 = 38.4px，副标题高度约 14px * 1.5 = 21px
     要让底部对齐，副标题需要向下移动约 (38.4 - 21) / 2 ≈ 8-9px */
  display: inline-block;
  margin-top: 13px; /* 👈 让副标题底部与主标题底部对齐 - 可在此处微调（建议范围：6px - 12px） */
  /* 微调说明：
     - 减小数值（如 7px）：副标题向上移动
     - 增大数值（如 11px）：副标题向下移动
     - 如果看不到变化，请清除浏览器缓存或硬刷新（Ctrl+Shift+R / Cmd+Shift+R）
  */
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.topbar-import-link {
  font-size: 0.875rem;
  color: var(--color-fg);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #f5f5f4;
  background: #fff;
}

.topbar-import-link:hover {
  background-color: #fafafa;
}

.topbar-lang-btn {
  padding: 6px 12px; 
  border-radius: 6px;
  border: 1px solid #f5f5f4;
  font-size: 0.875rem;
  background-color: #ffffff;
  color: var(--color-fg);
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  /* 已通过 align-items: center 实现与主标题水平对齐，无需 margin-bottom */
  flex-shrink: 0; /* 按钮不收缩，保持固定宽度 */
}

.topbar-lang-btn:hover {
  background-color: #fafafa;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}
</style>
