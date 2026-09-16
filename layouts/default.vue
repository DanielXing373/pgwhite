<template>
  <FlyingGhosts key="flying-ghosts-stable-root" />
  <TopBar />
  <main class="main-container" :style="{ maxWidth: 'var(--container-w)' }">
    <slot />
  </main>
  <FloatingButtons />
</template>
