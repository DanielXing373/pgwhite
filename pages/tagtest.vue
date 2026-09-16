<!--
  /tagtest — 一次一句标注 Wizard of Oz（内部页，无首页入口）
  交互复用 FilterGroup / SelectedBar / FlyingGhosts。
  会话逻辑：composables/useTagtestSession.ts
  剧本与词表：data/tagtest/fixture.ts
  设计说明：docs/tagtest.md
-->
<template>
  <div class="tagtest-page">
    <div v-if="!langPicked" class="tagtest-lang">
      <div class="tagtest-lang__backdrop" />
      <div class="tagtest-lang__box">
        <p class="tagtest-lang__lead">{{ $t('tagtest.pickLang') }}</p>
        <div class="tagtest-lang__row">
          <button class="tagtest-lang__card" @click="pickLang('zh')">简体中文</button>
          <button class="tagtest-lang__card" @click="pickLang('en')">English</button>
        </div>
      </div>
    </div>

    <header class="tagtest-head">
      <div class="tagtest-brand">
        <img src="/logo.svg" alt="" class="tagtest-logo">
        <h1>{{ $t('tagtest.brand') }}</h1>
        <span class="tagtest-sub">{{ $t('tagtest.subtitle') }}</span>
      </div>
      <div class="tagtest-progress" :title="`${currentIndex + 1} / ${total}`">
        <div class="tagtest-progress__bar">
          <span
            v-for="i in total"
            :key="i"
            :class="['tagtest-progress__seg', { 'is-done': i <= currentIndex + 1 }]"
          />
        </div>
        <span class="tagtest-progress__n">{{ currentIndex + 1 }}/{{ total }}</span>
      </div>
    </header>

    <div class="tagtest-rotate">
      <span class="tagtest-rotate__mark" aria-hidden="true">💡</span>
      <span class="tagtest-rotate__label">{{ $t('tagtest.hintLabel') }}</span>
      <p class="tagtest-rotate__text">{{ $t(hintKeys[hintIndex]) }}</p>
      <div class="tagtest-rotate__nav">
        <button type="button" class="tagtest-rotate__btn" :aria-label="$t('tagtest.hintPrev')" @click="hintStep(-1)">‹</button>
        <span class="tagtest-rotate__n">{{ hintIndex + 1 }}/{{ hintKeys.length }}</span>
        <button type="button" class="tagtest-rotate__btn" :aria-label="$t('tagtest.hintNext')" @click="hintStep(1)">›</button>
      </div>
    </div>

    <section v-if="phase === 'loading'" class="tagtest-fill">{{ $t('tagtest.loading') }}</section>

    <section v-else-if="phase === 'done'" class="tagtest-fill tagtest-done">
      <p>{{ commitMessage }}</p>
    </section>

    <section v-else-if="phase === 'edit' && currentDraft" class="tagtest-work" :class="{ 'is-flash': flashing }">
      <p v-if="duplicatePeerIds.length" class="tagtest-dup">
        {{ $t('tagtest.duplicate') }}
        <span v-for="id in duplicatePeerIds" :key="id">#{{ sentenceNumber(id) }}</span>
      </p>

      <div class="tagtest-bookline">
        <span>{{ $t('tagtest.currentBook') }}</span>
        <input v-model="currentDraft.authorLabel" class="tagtest-inline" :aria-label="$t('filters.authors')">
        <span>{{ $t('tagtest.of') }}</span>
        <input v-model="currentDraft.bookLabel" class="tagtest-inline" :aria-label="$t('filters.books')">
      </div>

      <textarea v-model="currentDraft.text" class="tagtest-quote" rows="2" />

      <div class="tagtest-selected">
        <SelectedBar
          :selectedLabel="$t('tagtest.currentTags')"
          :clearAllText="$t('filters.clearAll')"
          :facetOptions="catalog"
          :authors="[]"
          :books="[]"
          :characters="currentDraft.characterIds"
          :times="currentDraft.timeIds"
          :themes="currentDraft.themeIds"
          :devices="currentDraft.deviceIds"
          :canUndo="false"
          :canRedo="false"
          @clearAll="clearCurrentTags"
          @removeTag="removeTag"
        />
      </div>

      <div class="tagtest-dims">
        <div v-for="dim in tagDims" :key="dim" class="tagtest-dim">
          <div class="tagtest-dim-head">
            <span class="tagtest-dim-title">{{ dim === 'characters' ? $t('tagtest.characterCatalog') : $t(`filters.${dim}`) }}</span>
            <form class="tagtest-new" @submit.prevent="createTag(dim)">
              <input v-model="newTagDraft[dim]" class="tagtest-mini" :placeholder="$t('tagtest.newTag')">
              <button class="tagtest-btn" type="submit">+</button>
            </form>
          </div>
          <p v-if="dim === 'characters' && catalog.characters.length" class="tagtest-dim-note">{{ characterNote }}</p>
          <FiltersFilterGroup
            :title="''"
            :options="catalog[dim]"
            :modelValue="idsFor(dim)"
            :dimension="dim"
            :pinnedIds="pinnedIds[dim]"
            :empty-label="dim === 'characters' ? $t('tagtest.characterEmpty') : undefined"
            @update:modelValue="setIds(dim, $event)"
          />
        </div>
      </div>

      <div class="tagtest-foot">
        <div class="tagtest-flags">
          <button
            v-for="f in flagReasons"
            :key="f"
            type="button"
            :class="['tagtest-flag', { 'is-on': currentDraft.flags.includes(f) }]"
            @click="toggleFlag(f)"
          >{{ $t(`tagtest.flag_${f}`) }}</button>
        </div>
        <div class="tagtest-nav">
          <button class="tagtest-btn" :disabled="currentIndex === 0 || navLock" @click="go(-1)">
            {{ $t('tagtest.prev') }}
          </button>
          <button
            v-if="currentIndex < total - 1"
            class="tagtest-btn tagtest-btn--primary"
            :disabled="navLock"
            @click="go(1)"
          >{{ $t('tagtest.next') }}</button>
          <button
            v-else
            class="tagtest-btn tagtest-btn--primary"
            :disabled="committing"
            @click="commitAll"
          >{{ $t('tagtest.submit') }}</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import SelectedBar from '~/components/SelectedBar.vue'
import {
  TAGTEST_DIMS,
  TAGTEST_FLAG_REASONS,
  TAGTEST_HINT_KEYS,
  useTagtestSession
} from '~/composables/useTagtestSession'

definePageMeta({ layout: 'tagtest' })

useHead({
  title: 'pgWhite — tagtest',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
})

const tagDims = TAGTEST_DIMS
const flagReasons = TAGTEST_FLAG_REASONS
const hintKeys = TAGTEST_HINT_KEYS

const {
  langPicked,
  phase,
  currentIndex,
  committing,
  navLock,
  flashing,
  commitMessage,
  hintIndex,
  catalog,
  pinnedIds,
  newTagDraft,
  total,
  currentDraft,
  characterNote,
  duplicatePeerIds,
  sentenceNumber,
  idsFor,
  setIds,
  removeTag,
  clearCurrentTags,
  toggleFlag,
  createTag,
  pickLang,
  hintStep,
  go,
  commitAll
} = useTagtestSession()
</script>

<style scoped>
.tagtest-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 8px 16px 12px;
  box-sizing: border-box;
  overflow: hidden;
}

.tagtest-lang {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tagtest-lang__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(41, 37, 36, 0.45);
  backdrop-filter: blur(8px);
}
.tagtest-lang__box { position: relative; width: min(720px, 92vw); }
.tagtest-lang__lead {
  text-align: center;
  color: #fff;
  margin: 0 0 16px;
  font-size: 1.1rem;
}
.tagtest-lang__row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.tagtest-lang__card {
  min-height: 160px;
  border: none;
  border-radius: 12px;
  background: #fff;
  font-size: 1.5rem;
  cursor: pointer;
}

.tagtest-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
.tagtest-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.tagtest-logo { width: 36px; height: 36px; }
.tagtest-brand h1 {
  font-size: 1.1rem;
  margin: 0;
  white-space: nowrap;
}
.tagtest-sub {
  color: var(--color-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}

.tagtest-progress { display: flex; align-items: center; gap: 8px; }
.tagtest-progress__bar { display: flex; gap: 3px; }
.tagtest-progress__seg {
  width: 14px;
  height: 8px;
  border-radius: 2px;
  background: #e5e7eb;
}
.tagtest-progress__seg.is-done { background: #292524; }
.tagtest-progress__n { font-size: 0.8rem; color: var(--color-muted); }

.tagtest-rotate {
  flex-shrink: 0;
  margin: 8px 0 10px;
  font-size: 0.85rem;
  color: var(--color-muted);
  min-height: 1.4em;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tagtest-rotate__mark { font-size: 1rem; line-height: 1; }
.tagtest-rotate__label {
  flex-shrink: 0;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  color: #78716c;
  border: 1px solid #e7e5e4;
  border-radius: 4px;
  padding: 1px 6px;
}
.tagtest-rotate__text { margin: 0; flex: 1; min-width: 0; }
.tagtest-rotate__nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.tagtest-rotate__btn {
  width: 28px;
  height: 28px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
}
.tagtest-rotate__n { font-size: 0.75rem; min-width: 2.4em; text-align: center; }

.tagtest-fill {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tagtest-work {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tagtest-work.is-flash { animation: tagtest-flash 0.45s ease; }
@keyframes tagtest-flash {
  0% { filter: brightness(1.25); }
  100% { filter: brightness(1); }
}

.tagtest-dup {
  flex-shrink: 0;
  background: #fff7ed;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.75rem;
}

.tagtest-bookline {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.tagtest-inline {
  border: none;
  border-bottom: 1px dashed #a8a29e;
  background: transparent;
  font: inherit;
  min-width: 6rem;
  padding: 2px 4px;
}
.tagtest-quote {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  height: 3.4em;
  max-height: 3.4em;
  resize: none;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 12px;
  font: inherit;
  font-size: 1.05rem;
  line-height: 1.45;
  text-align: center;
  flex: 0 0 3.4em;
  overflow: auto;
}

.tagtest-selected {
  flex-shrink: 0;
  max-height: 72px;
  overflow: auto;
}
.tagtest-selected :deep(.selected-bar-header) { display: none; }
.tagtest-selected :deep(.selected-bar-section) { margin: 0; }
.tagtest-selected :deep(.selected-bar-card) { padding: 4px 8px; }

.tagtest-dims {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 16px;
}
.tagtest-dim {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  min-height: 0;
  overflow: auto;
}
.tagtest-dim-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
}
.tagtest-dim-title {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.3;
}
.tagtest-dim-note {
  margin: 0 0 6px;
  font-size: 0.7rem;
  color: var(--color-muted);
}
.tagtest-new { display: flex; gap: 4px; }
.tagtest-mini {
  width: 7rem;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 0.75rem;
  padding: 2px 4px;
}

.tagtest-foot {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.tagtest-flags { display: flex; gap: 6px; }
.tagtest-flag {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 0.85rem;
  cursor: pointer;
}
.tagtest-flag.is-on { background: #292524; color: #fff; border-color: #292524; }
.tagtest-nav { display: flex; gap: 8px; }
.tagtest-btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
}
.tagtest-btn--primary { background: #111; color: #fff; border-color: #111; }
.tagtest-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tagtest-done { font-size: 1rem; }
</style>

