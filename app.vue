<!-- =====================================================
File: app.vue
标题：应用根（全局骨架）
说明：顶部信息条 + 公告 + 主容器（页面内容）
布局：主容器宽度受 --container-w 控制
====================================================== -->
<template>
  <!-- FlyingGhosts must be at root level, outside any container that might be blurred -->
  <!-- Use stable key to prevent re-mounting on route/query parameter changes -->
  <FlyingGhosts key="flying-ghosts-stable-root" />

  <TopBar />

  <main class="main-container" :style="{ maxWidth: 'var(--container-w)' }">
    <NuxtPage />
  </main>

  <FloatingButtons />
</template>

<script setup lang="ts">
// 全局仅作布局承载
</script>