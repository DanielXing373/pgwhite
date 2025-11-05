<template>
  <header class="w-full border-b" style="border-color:#e5e7eb;">
    <div class="mx-auto" :style="{ maxWidth: 'var(--container-w)' }">
      <div class="topbar-row">
        <!-- 左侧：仅站点标题（去掉副标题），与右侧语言切换保持同一行 -->
        <div class="flex items-center gap-3">
          <h1 class="text-lg" style="color: var(--color-fg); margin:0;">{{ $t('site.title') }}</h1>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1 rounded border text-sm"
            style="border-color:#e5e7eb"
            @click="toggleLocale"
            :aria-label="$t('lang.toggle')"
          >
            {{ $t('lang.toggle') }}
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
const toggleLocale = () => {
  const newLocale = locale.value === 'zh' ? 'en' : 'zh'
  setLocale(newLocale)
}
</script>

<style scoped>
.topbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  /* 关键：不换行，保证按钮与标题同一行 */
  flex-wrap: nowrap;
}
.topbar-row h1 {
  margin: 0;
  white-space: nowrap;
}
</style>
