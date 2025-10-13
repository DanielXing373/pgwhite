<!-- =====================================================
File: components/NoticeBar.vue
标题：公告/今日提醒（单行）
说明：不 sticky、不记忆关闭；内容来自 i18n
改色：styles/theme.css 中的颜色变量
====================================================== -->
<template>
  <div class="w-full" style="background: var(--color-chip);">
    <div class="mx-auto py-2 px-4 text-sm" :style="{ maxWidth: 'var(--container-w)' }">
      <span>{{ $t('notice.message') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 预留 props（未来可以扩展类型 info/success/warning）
</script>
