<!-- =====================================================
File: components/TopBar.vue
标题：顶部信息条（非 sticky，低存在感）
说明：左侧为站名与副标题；右侧为语言切换按钮
改色：颜色/字体来源 styles/theme.css（统一修改入口）
====================================================== -->
<template>
  <header class="w-full border-b" style="border-color:#e5e7eb;">
    <div class="mx-auto" :style="{ maxWidth: 'var(--container-w)' }">
      <div class="flex items-center justify-between py-3 px-4">
        <div class="flex items-baseline gap-3">
          <strong class="text-lg" style="color: var(--color-fg)">{{ $t('site.title') }}</strong>
          <span class="text-sm text-muted">{{ $t('site.subtitle') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1 rounded border text-sm"
            style="border-color:#e5e7eb"
            @click="toggleLocale"
            aria-label="Toggle language"
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
const { locale } = useI18n()
const toggleLocale = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh'
}
</script>
