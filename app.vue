<!-- =====================================================
File: app.vue
标题：应用根（全局骨架）
说明：顶部信息条 + 公告 + 主容器（页面内容）
布局：主容器宽度受 --container-w 控制
====================================================== -->
<template>
  <TopBar />

  <main class="mx-auto px-4 py-6" :style="{ maxWidth: 'var(--container-w)' }">
    <NuxtPage />
  </main>
</template>

<script setup lang="ts">
// 全局仅作布局承载
</script>