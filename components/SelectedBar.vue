<template>
    <section class="mb-4">
      <div class="flex items-center justify-between">
        <div class="text-sm">
          {{ selectedLabel }}：
          <span>暂无（V1.0 仅清空全部，后续接上 Chips）</span>
        </div>
        <button class="px-3 py-1 rounded border text-sm" style="border-color:#e5e7eb" @click="$emit('clearAll')">
          {{ clearAllText }}
        </button>
      </div>
    </section>
  </template>
  
  <script setup lang="ts">
  const props = defineProps<{
    selectedLabel: string
    clearAllText: string
  }>()
  defineEmits<{ (e:'clearAll'): void }>()
  </script>