<!-- 跨平台 emoji：Windows Chrome 对国旗常显示为 FR/US 字母，改用 Twemoji 图片 -->
<template>
  <img
    v-if="src"
    :src="src"
    :alt="emoji"
    class="chip-emoji-img"
    width="16"
    height="16"
    draggable="false"
    loading="lazy"
    @error="onError"
  />
  <span v-else class="chip-emoji" aria-hidden="true">{{ emoji }}</span>
</template>

<script setup lang="ts">
const props = defineProps<{
  emoji: string
}>()

const failed = ref(false)

/** 将 emoji 转为 Twemoji PNG 路径（如 🇬🇧 → 1f1ec-1f1e7） */
function toTwemojiCode(emoji: string): string | null {
  const raw = emoji.trim()
  if (!raw) return null
  const cps: string[] = []
  for (const ch of raw) {
    const cp = ch.codePointAt(0)
    if (cp == null) continue
    // 跳过字面选择符 FE0F，Twemoji 文件名通常不含它
    if (cp === 0xfe0f) continue
    cps.push(cp.toString(16))
  }
  return cps.length ? cps.join('-') : null
}

const src = computed(() => {
  if (failed.value) return ''
  const code = toTwemojiCode(props.emoji)
  if (!code) return ''
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/${code}.png`
})

function onError() {
  failed.value = true
}
</script>
