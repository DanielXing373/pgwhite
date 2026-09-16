<template>
  <FlyingGhosts key="flying-ghosts-stable-root" />
  <div class="tagtest-layout">
    <slot />
  </div>
  <FloatingButtons hide-submit />
</template>

<style scoped>
.tagtest-layout {
  height: 100vh;
  overflow: hidden;
  max-width: var(--container-w);
  margin: 0 auto;
}
</style>
