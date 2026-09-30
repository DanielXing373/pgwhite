<!-- PGWhite 1.2 — Live WeRead Import (R&D / Daniel MVP) -->
<template>
  <div class="import-page">
    <header class="import-header">
      <h1 class="import-title">WeRead Import</h1>
      <p class="import-sub">
        R&amp;D MVP · API key is used only for this request (not stored).
        Homepage remains Tag / Filter → Result.
      </p>
      <NuxtLink to="/" class="import-home-link">← Back to Result</NuxtLink>
    </header>

    <section class="import-card">
      <label class="import-label" for="weread-key">WeRead Agent API Key</label>
      <input
        id="weread-key"
        v-model="apiKey"
        class="import-input"
        type="password"
        autocomplete="off"
        placeholder="wrk-…"
        :disabled="busy"
      />
      <div class="import-actions">
        <button class="import-btn" type="button" :disabled="busy || !apiKey.trim()" @click="loadNotebooks">
          {{ busy && step === 'notebooks' ? 'Loading…' : 'Load notebooks' }}
        </button>
      </div>
      <p v-if="error" class="import-error">{{ error }}</p>
    </section>

    <section v-if="books.length" class="import-card">
      <div class="import-picker-head">
        <h2 class="import-h2">Notebooks ({{ books.length }})</h2>
        <div class="import-actions">
          <button class="import-btn import-btn--ghost" type="button" :disabled="busy" @click="selectValidationPair">
            Select validation pair
          </button>
          <button
            class="import-btn import-btn--primary"
            type="button"
            :disabled="busy || selectedIds.length === 0"
            @click="runImport"
          >
            {{ busy && step === 'import' ? 'Importing…' : `Import selected (${selectedIds.length})` }}
          </button>
        </div>
      </div>
      <p class="import-hint">
        Validation books: 如果在冬夜，一个旅人 · 索拉里斯星（译林幻系列）. Do not bulk-import all books on first run.
      </p>
      <ul class="book-list">
        <li v-for="b in books" :key="b.bookId" class="book-row">
          <label class="book-row-label">
            <input v-model="selectedIds" type="checkbox" :value="b.bookId" :disabled="busy" />
            <img
              v-if="b.cover"
              class="book-cover"
              :src="b.cover"
              :alt="b.title"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <div v-else class="book-cover book-cover--ph" aria-hidden="true" />
            <div class="book-meta">
              <div class="book-title">{{ b.title }}</div>
              <div class="book-author">{{ b.author }}</div>
              <div class="book-stats">
                Progress {{ b.readingProgress }}% · Notes {{ b.noteCount }} · Reviews {{ b.reviewCount }}
              </div>
            </div>
          </label>
        </li>
      </ul>
    </section>

    <section v-if="result" class="import-card import-result">
      <h2 class="import-h2">Import result</h2>
      <p>
        Import #{{ result.importId }} · status
        <strong>{{ result.status }}</strong>
      </p>
      <p>
        Items: total {{ result.counters.total_items }}, successful
        {{ result.counters.successful_items }}, failed {{ result.counters.failed_items }}
      </p>
      <ul>
        <li v-for="b in result.books" :key="b.wereadBookId">
          {{ b.title }} → PG book {{ b.pgBookId }} · {{ b.quoteIds.length }} quotes
          <NuxtLink
            v-if="b.pgBookId"
            class="import-home-link"
            :to="{ path: '/', query: { books: String(b.pgBookId) } }"
          >
            View in Result
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
type NotebookBook = {
  bookId: string
  title: string
  author: string
  cover: string | null
  readingProgress: number
  noteCount: number
  reviewCount: number
}

type ImportResult = {
  importId: number
  status: string
  counters: {
    total_items: number
    successful_items: number
    failed_items: number
  }
  books: Array<{
    wereadBookId: string
    pgBookId: number
    title: string
    quoteIds: number[]
  }>
}

const VALIDATION_TITLES = ['如果在冬夜，一个旅人', '索拉里斯星（译林幻系列）']

const apiKey = ref('')
const books = ref<NotebookBook[]>([])
const selectedIds = ref<string[]>([])
const busy = ref(false)
const step = ref<'idle' | 'notebooks' | 'import'>('idle')
const error = ref('')
const result = ref<ImportResult | null>(null)

function selectValidationPair() {
  const ids = books.value
    .filter(b => VALIDATION_TITLES.some(t => b.title.includes(t) || t.includes(b.title)))
    .map(b => b.bookId)
  selectedIds.value = ids
}

async function loadNotebooks() {
  error.value = ''
  result.value = null
  busy.value = true
  step.value = 'notebooks'
  try {
    const data = await $fetch<{ books: NotebookBook[] }>('/api/weread/notebooks', {
      method: 'POST',
      body: { apiKey: apiKey.value.trim() }
    })
    books.value = data.books || []
    selectedIds.value = []
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string; message?: string }
    error.value = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Failed to load notebooks'
    books.value = []
  } finally {
    busy.value = false
    step.value = 'idle'
  }
}

async function runImport() {
  error.value = ''
  result.value = null
  busy.value = true
  step.value = 'import'
  try {
    const data = await $fetch<ImportResult>('/api/weread/import', {
      method: 'POST',
      body: {
        apiKey: apiKey.value.trim(),
        bookIds: selectedIds.value
      }
    })
    result.value = data
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string; message?: string }
    error.value = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Import failed'
  } finally {
    busy.value = false
    step.value = 'idle'
  }
}
</script>

<style scoped>
.import-page {
  padding: 1.5rem 0 3rem;
  max-width: 720px;
}
.import-header {
  margin-bottom: 1.25rem;
}
.import-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.35rem;
}
.import-sub {
  color: #6b7280;
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
}
.import-home-link {
  color: #1d4ed8;
  text-decoration: underline;
  font-size: 0.9rem;
}
.import-card {
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
  background: #fff;
}
.import-label {
  display: block;
  font-size: 0.85rem;
  margin-bottom: 0.35rem;
  color: #44403c;
}
.import-input {
  width: 100%;
  border: 1px solid #d6d3d1;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 0.95rem;
}
.import-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.import-btn {
  border: 1px solid #d6d3d1;
  background: #fafaf9;
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  cursor: pointer;
  font-size: 0.9rem;
}
.import-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.import-btn--primary {
  background: #1c1917;
  color: #fff;
  border-color: #1c1917;
}
.import-btn--ghost {
  background: #fff;
}
.import-error {
  color: #b91c1c;
  margin: 0.75rem 0 0;
  font-size: 0.9rem;
}
.import-h2 {
  font-size: 1.1rem;
  margin: 0;
}
.import-picker-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.import-hint {
  color: #78716c;
  font-size: 0.85rem;
  margin: 0.5rem 0 0.75rem;
}
.book-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  max-height: 28rem;
  overflow: auto;
}
.book-row-label {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  cursor: pointer;
}
.book-cover {
  width: 48px;
  height: 68px;
  object-fit: cover;
  border-radius: 4px;
  background: #f5f5f4;
  flex-shrink: 0;
}
.book-cover--ph {
  background: linear-gradient(145deg, #e7e5e4, #d6d3d1);
}
.book-title {
  font-weight: 600;
  font-size: 0.95rem;
}
.book-author {
  color: #57534e;
  font-size: 0.85rem;
}
.book-stats {
  color: #a8a29e;
  font-size: 0.8rem;
  margin-top: 0.15rem;
}
.import-result ul {
  padding-left: 1.1rem;
}
</style>
