<template>
  <div class="ac1">
    <header class="ac1-header">
      <img src="/logo.svg" alt="" class="ac1-logo" width="40" height="40" />
      <div>
        <p class="ac1-kicker">鸽白词句库</p>
        <h1 class="ac1-title">阅读研究</h1>
      </div>
    </header>

    <p v-if="studyMode === 'test'" class="ac1-banner">{{ copy.test_banner }}</p>
    <p v-if="error" class="ac1-error" role="alert">{{ error }}</p>

    <!-- Welcome & consent -->
    <section v-if="screen === 'welcome'" class="ac1-panel ac1-welcome">
      <h2 class="ac1-h2">{{ copy.welcome }}</h2>
      <p class="ac1-text">{{ copy.research_description }}</p>
      <div class="ac1-consent">
        <p class="ac1-text ac1-consent-intro">{{ copy.consent_intro }}</p>
        <ul class="ac1-list">
          <li v-for="item in copy.consent_bullets" :key="item">{{ item }}</li>
        </ul>
      </div>
      <p class="ac1-text ac1-muted">{{ copy.consent_ack }}</p>

      <nav class="ac1-nav">
        <a class="ac1-btn ac1-btn-secondary" href="/">{{ copy.decline }}</a>
        <button class="ac1-btn ac1-btn-primary" type="button" :disabled="loading" @click="start">
          <span v-if="loading" class="ac1-spinner" aria-hidden="true" />
          {{ copy.start }}
        </button>
      </nav>
    </section>

    <!-- Questions -->
    <section v-else-if="screen === 'section1' || screen === 'section2'" class="ac1-survey">
      <div ref="sentinel" aria-hidden="true" />
      <div class="ac1-progress" :class="{ 'ac1-progress--stuck': progressStuck }" role="status">
        <div class="ac1-progress-row">
          <span class="ac1-progress-label">{{ screen === 'section1' ? copy.progress_1 : copy.progress_2 }}</span>
          <span class="ac1-progress-count">{{ copy.answered_prefix }} {{ answeredCount }} / 10</span>
        </div>
        <div class="ac1-progress-track" aria-hidden="true">
          <div class="ac1-progress-fill" :style="{ width: answeredCount * 10 + '%' }" />
        </div>
      </div>

      <div class="ac1-instructions">
        <p class="ac1-text">{{ sectionCopy }}</p>
        <p v-if="sectionNotice" class="ac1-notice"><strong>{{ sectionNotice }}</strong></p>
      </div>

      <article
        v-for="q in pageQuestions"
        :id="'q-' + q.position"
        :key="q.position"
        class="ac1-question"
        :class="{ 'ac1-question--missing': attempted && !isAnswered(q.position) }"
      >
        <blockquote class="ac1-quote">
          <span class="ac1-qnum"><span class="ac1-required" aria-label="必选">*</span>{{ q.position }}.</span>
          {{ q.text_zh }}
        </blockquote>
        <p class="ac1-cite">——{{ q.author_name_zh }}《{{ q.book_title_zh }}》</p>

        <div class="ac1-options" role="group" :aria-label="'第 ' + q.position + ' 段摘录'">
          <div v-for="group in q.groups" :key="group.dimension" class="ac1-group">
            <p class="ac1-group-label">{{ group.label_zh }}</p>
            <div class="ac1-options-grid">
              <button
                v-for="tag in group.tags"
                :key="tag.tag_id"
                type="button"
                class="ac1-option"
                :class="{ selected: isTicked(q.position, tag.tag_id) }"
                role="checkbox"
                :aria-checked="isTicked(q.position, tag.tag_id)"
                @click="toggle(q.position, tag.tag_id)"
              >
                <span class="ac1-check" aria-hidden="true">
                  <svg v-if="isTicked(q.position, tag.tag_id)" viewBox="0 0 16 16" width="14" height="14">
                    <path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
                <span class="ac1-theme-stack">
                  <Chip
                    :label="tag.label_zh"
                    :dimension="group.dimension === 'theme' ? 'themes' : 'devices'"
                    :state="isTicked(q.position, tag.tag_id) ? 'active' : 'hover'"
                  />
                </span>
              </button>
            </div>
          </div>
          <button
            type="button"
            class="ac1-option ac1-option-none"
            :class="{ selected: answers[q.position]?.none }"
            role="checkbox"
            :aria-checked="!!answers[q.position]?.none"
            @click="chooseNone(q.position)"
          >
            {{ q.none_label_zh }}
          </button>
          <p v-if="attempted && !isAnswered(q.position)" class="ac1-question-hint" role="alert">
            {{ copy.question_hint }}
          </p>
        </div>
      </article>

      <nav class="ac1-nav">
        <button
          v-if="screen === 'section2'"
          class="ac1-btn ac1-btn-secondary"
          type="button"
          @click="goSection(1)"
        >
          {{ copy.back }}
        </button>
        <span v-else />
        <button
          v-if="screen === 'section1'"
          class="ac1-btn ac1-btn-primary"
          type="button"
          @click="goSection(2)"
        >
          {{ copy.continue }}
        </button>
        <button v-else class="ac1-btn ac1-btn-primary" type="button" @click="askSubmit">
          {{ copy.submit_yes }}
        </button>
      </nav>
    </section>

    <section v-else-if="screen === 'done'" class="ac1-panel ac1-done">
      <div class="ac1-done-mark" aria-hidden="true">✓</div>
      <h2 class="ac1-h2">{{ copy.thank_you }}</h2>
    </section>

    <div
      v-if="confirmOpen"
      class="ac1-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ac1-confirm-text"
      @keydown.esc="confirmOpen = false"
      @click.self="confirmOpen = false"
    >
      <div class="ac1-panel ac1-modal-card">
        <p id="ac1-confirm-text" class="ac1-text">{{ copy.submit_confirm }}</p>
        <nav class="ac1-nav">
          <button class="ac1-btn ac1-btn-secondary" type="button" @click="confirmOpen = false">
            {{ copy.submit_back }}
          </button>
          <button
            ref="confirmBtn"
            class="ac1-btn ac1-btn-primary"
            type="button"
            :disabled="loading"
            @click="submit"
          >
            <span v-if="loading" class="ac1-spinner" aria-hidden="true" />
            {{ copy.submit_yes }}
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { COPY } from '../server/utils/ac1hs/copy'

definePageMeta({ layout: false })

/** Per excerpt: the ticked tags, or `none` for 「都不合适」. A tag is ticked (合适) or not (不合适); no third state. */
type Answer = { selected: string[]; none: boolean }
type Question = {
  position: number
  section: 1 | 2
  quote_id: string
  text_zh: string
  author_name_zh: string | null
  book_title_zh: string | null
  groups: {
    dimension: 'theme' | 'rhetoric' | 'technique'
    label_zh: string
    tags: { tag_id: string; label_zh: string }[]
  }[]
  none_label_zh: string
}
type Session = {
  study_mode: 'study' | 'test'
  experimental_group: 'control' | 'disclosure'
  completion_status: string
  section_instructions: { 1: string; 2: string }
  section_notices?: { 1: string | null; 2: string | null }
  answers: Record<string, Answer>
  questions: Question[]
}

const route = useRoute()
const studyMode = computed(() => (route.query.mode === 'test' ? 'test' : 'study'))
const copy = ref<typeof COPY>(COPY)
const session = ref<Session | null>(null)
const answers = ref<Record<number, Answer>>({})
const screen = ref<'welcome' | 'section1' | 'section2' | 'done'>('welcome')
const loading = ref(false)
const error = ref('')
const confirmOpen = ref(false)
const attempted = ref(false)
const confirmBtn = ref<HTMLButtonElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
const progressStuck = ref(false)
let stuckObserver: IntersectionObserver | null = null

watch(sentinel, el => {
  stuckObserver?.disconnect()
  if (!el) return
  stuckObserver = new IntersectionObserver(([entry]) => {
    progressStuck.value = !entry?.isIntersecting
  })
  stuckObserver.observe(el)
})
onBeforeUnmount(() => stuckObserver?.disconnect())

const pageQuestions = computed(() => {
  const section = screen.value === 'section2' ? 2 : 1
  return session.value?.questions.filter(q => q.section === section) ?? []
})
function isAnswered(position: number) {
  const a = answers.value[position]
  return !!a && (a.none || a.selected.length > 0)
}
function isTicked(position: number, tagId: string) {
  return answers.value[position]?.selected.includes(tagId) ?? false
}
const answeredCount = computed(
  () => Object.keys(answers.value).filter(position => isAnswered(Number(position))).length
)
const sectionCopy = computed(() => {
  if (!session.value) return ''
  return screen.value === 'section2' ? session.value.section_instructions[2] : session.value.section_instructions[1]
})
const sectionNotice = computed(() => {
  const notices = session.value?.section_notices
  if (!notices) return null
  return screen.value === 'section2' ? notices[2] : notices[1]
})

watch(confirmOpen, open => {
  if (open) nextTick(() => confirmBtn.value?.focus())
})

function applySession(s: Session) {
  session.value = s
  const next: Record<number, Answer> = {}
  for (const [k, v] of Object.entries(s.answers || {})) {
    next[Number(k)] = { selected: [...(v.selected ?? [])], none: !!v.none }
  }
  answers.value = next
  if (s.completion_status === 'completed') screen.value = 'done'
}

async function recover() {
  try {
    const data = await $fetch<{ session: Session }>('/api/ac1test/session')
    applySession(data.session)
    if (data.session.completion_status !== 'completed') screen.value = 'section1'
  } catch {
    screen.value = 'welcome'
  }
}

onMounted(async () => {
  try {
    const meta = await $fetch<{ copy: typeof copy.value }>('/api/ac1test/meta')
    copy.value = { ...copy.value, ...meta.copy }
  } catch {
    /* frozen fallback copy already in the page */
  }
  recover()
})

async function start() {
  error.value = ''
  loading.value = true
  try {
    const data = await $fetch<{ session: Session }>('/api/ac1test/session', {
      method: 'POST',
      body: { consented: true, study_mode: studyMode.value }
    })
    applySession(data.session)
    screen.value = 'section1'
    window.scrollTo({ top: 0 })
  } catch (e: any) {
    error.value = e?.data?.data?.message || copy.value.start_failed
  } finally {
    loading.value = false
  }
}

/** Only answered excerpts are sent; an excerpt with nothing ticked and no 「都不合适」 is unanswered. */
function answerPayload() {
  return Object.entries(answers.value)
    .filter(([position]) => isAnswered(Number(position)))
    .map(([position, a]) => ({ position: Number(position), selected: a.selected, none: a.none }))
}

async function persist() {
  const payload = answerPayload()
  try {
    await $fetch('/api/ac1test/draft', { method: 'POST', body: { answers: payload } })
  } catch (e: any) {
    if (e?.statusCode === 409) {
      screen.value = 'done'
      error.value = copy.value.already_submitted
    }
  }
}

function commit(position: number, answer: Answer) {
  answers.value = { ...answers.value, [position]: answer }
  if (attempted.value && !firstUnanswered()) error.value = ''
  persist()
}

/** Ticking a tag clears 「都不合适」. */
function toggle(position: number, tagId: string) {
  const current = answers.value[position]?.selected ?? []
  const selected = current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId]
  commit(position, { selected, none: false })
}

/** 「都不合适」 clears every tick; clicking it again leaves the excerpt unanswered. */
function chooseNone(position: number) {
  commit(position, { selected: [], none: !answers.value[position]?.none })
}

function firstUnanswered(): number | null {
  for (const q of pageQuestions.value) {
    if (!isAnswered(q.position)) return q.position
  }
  return null
}

function flagMissing(): boolean {
  const missing = firstUnanswered()
  if (missing == null) return false
  attempted.value = true
  error.value = `${copy.value.validation_incomplete} ${copy.value.validation_scroll}`
  document.getElementById(`q-${missing}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

function goSection(n: 1 | 2) {
  error.value = ''
  if (n === 2 && flagMissing()) return
  attempted.value = false
  screen.value = n === 1 ? 'section1' : 'section2'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function askSubmit() {
  if (flagMissing()) return
  confirmOpen.value = true
}

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const payload = answerPayload()
    const data = await $fetch<{ session: Session }>('/api/ac1test/submit', {
      method: 'POST',
      body: { answers: payload }
    })
    applySession(data.session)
    confirmOpen.value = false
    screen.value = 'done'
    window.scrollTo({ top: 0 })
  } catch (e: any) {
    error.value = e?.data?.data?.message || copy.value.submit_failed
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* Colour roles: one colour per kind of thing.
   theme labels = sky blue (homepage "themes"), actions = brand blue,
   instructions = lavender (homepage "search"), progress = mint,
   required/error = red, test banner = cheese yellow. */
.ac1 {
  --ac1-sky: #0ea5e9;
  --ac1-sky-soft: #f0f9ff;
  --ac1-lavender: #d8b4fe;
  --ac1-lavender-soft: #faf5ff;
  --ac1-mint: #10b981;
  --ac1-red: #dc2626;
  --ac1-border: #e7e5e4;
  --ac1-ease: cubic-bezier(0.2, 0.7, 0.2, 1);

  min-height: 100vh;
  max-width: 42rem;
  margin: 0 auto;
  padding: 0 20px 96px;
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-sans);
  line-height: 1.6;
  /* clip (not hidden) so the sticky progress bar still sticks to the viewport */
  overflow-x: clip;
}

.ac1-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 28px;
  margin-bottom: 28px;
}
.ac1-logo { width: 40px; height: 40px; }
.ac1-kicker { margin: 0; color: var(--color-muted); font-size: 0.85rem; line-height: 1.3; }
.ac1-title { margin: 0; font-size: 1.3rem; font-weight: 600; line-height: 1.3; }

.ac1-text {
  margin: 0 0 1em;
  font-family: var(--font-serif);
  line-height: 1.6;
}
.ac1-text:last-child { margin-bottom: 0; }
.ac1-muted { color: var(--color-muted); }

.ac1-banner, .ac1-error {
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
}
.ac1-banner { background: #fef9c3; border: 1px solid #fde047; }
.ac1-error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

.ac1-panel {
  background: #fff;
  border: 1px solid #f5f5f4;
  border-radius: 12px;
  padding: 24px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.ac1-h2 {
  margin: 0 0 16px;
  font-family: var(--font-serif);
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.5;
}

.ac1-consent {
  margin: 20px 0;
  padding: 16px;
  background: var(--color-bg);
  border-radius: 8px;
}
.ac1-consent-intro { margin-bottom: 8px; font-weight: 600; }
.ac1-list {
  margin: 0;
  padding-left: 1.25em;
  list-style: disc;
  font-family: var(--font-serif);
}
.ac1-list li { margin: 0 0 8px; line-height: 1.6; }
.ac1-list li:last-child { margin-bottom: 0; }

/* Navigation row: back/decline on the left, forward action on the right. */
.ac1-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 28px;
}

.ac1-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  min-width: 112px;
  padding: 0 20px;
  border-radius: 10px;
  border: 1px solid transparent;
  font: inherit;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s var(--ac1-ease), box-shadow 0.15s var(--ac1-ease),
    background-color 0.15s ease, border-color 0.15s ease;
}
.ac1-btn:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
.ac1-btn:active:not(:disabled) { transform: scale(0.97); }
.ac1-btn:disabled { opacity: 0.55; cursor: progress; }

.ac1-btn-primary {
  background: var(--color-brand);
  color: #fff;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.25);
}
.ac1-btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  transform: translateY(-1px);
}
.ac1-btn-secondary {
  background: #fff;
  color: var(--color-fg);
  border-color: #d6d3d1;
}
.ac1-btn-secondary:hover {
  background: #fafaf9;
  border-color: #a8a29e;
}

.ac1-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ac1-spin 0.7s linear infinite;
}
@keyframes ac1-spin { to { transform: rotate(360deg); } }

/* Progress */
.ac1-progress {
  position: sticky;
  top: 0;
  z-index: 20;
  margin: 0 -20px 20px;
  padding: 10px 20px 12px;
  background: rgba(249, 248, 246, 0.94);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.ac1-progress--stuck {
  border-bottom-color: #e7e5e4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.ac1-progress-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  font-size: 0.9rem;
}
.ac1-progress-label { font-weight: 600; }
.ac1-progress-count { color: var(--color-muted); font-variant-numeric: tabular-nums; }
.ac1-progress-track {
  height: 6px;
  background: #e7e5e4;
  border-radius: 999px;
  overflow: hidden;
}
.ac1-progress-fill {
  height: 100%;
  background: var(--ac1-mint);
  border-radius: 999px;
  transition: width 0.3s var(--ac1-ease);
}

.ac1-instructions {
  margin-bottom: 24px;
  padding: 14px 16px;
  background: var(--ac1-lavender-soft);
  border-left: 4px solid var(--ac1-lavender);
  border-radius: 8px;
}
.ac1-notice {
  margin: 8px 0 0;
  color: var(--color-ink, #1c1917);
}
.ac1-required { color: var(--ac1-red); font-weight: 700; margin-right: 2px; }

/* Question unit */
.ac1-question {
  background: #fff;
  border: 1px solid #f5f5f4;
  border-radius: 12px;
  padding: 20px 16px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  scroll-margin-top: 88px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.ac1-question--missing {
  border-color: #fca5a5;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
}
.ac1-quote {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-fg);
}
.ac1-qnum {
  margin-right: 4px;
  font-family: var(--font-sans);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.ac1-cite {
  margin: 10px 0 20px;
  text-align: right;
  font-family: var(--font-serif);
  font-size: 0.9rem;
  color: var(--color-muted);
}

.ac1-options { display: flex; flex-direction: column; gap: 14px; }
.ac1-options-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.ac1-option {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 10px 4px 12px;
  background: #fff;
  border: 1.5px solid var(--ac1-border);
  border-radius: 10px;
  color: inherit;
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.12s var(--ac1-ease), border-color 0.15s ease,
    background-color 0.15s ease, box-shadow 0.15s ease;
}
.ac1-option:hover { border-color: #7dd3fc; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.12); }
.ac1-option:active { transform: scale(0.97); }
.ac1-option:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
.ac1-option.selected {
  border-color: var(--ac1-sky);
  background: var(--ac1-sky-soft);
  box-shadow: 0 0 0 1px var(--ac1-sky);
}
/* Checkbox square in the slot where the earlier questionnaire showed the option letter. */
.ac1-check {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-bottom: 2px;
  background: #fff;
  border: 1.5px solid #a8a29e;
  border-radius: 5px;
  color: #fff;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.ac1-option.selected .ac1-check { background: var(--ac1-sky); border-color: var(--ac1-sky); }

.ac1-group { display: flex; flex-direction: column; gap: 8px; }
.ac1-group-label {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-muted);
  letter-spacing: 0.04em;
}
.ac1-question-hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ac1-red);
}
.ac1-theme-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.ac1-theme-stack :deep(.result-chip) {
  font-size: 0.78rem;
  padding: 3px 8px;
  /* box size from the previous 0.875rem label, kept so cards don't shrink */
  box-sizing: border-box;
  min-width: 46px;
  min-height: 29px;
  justify-content: center;
  cursor: inherit;
  white-space: normal;
  text-align: center;
}

.ac1-option-none {
  flex-direction: row;
  justify-content: center;
  padding: 12px;
  color: var(--color-muted);
  border-style: dashed;
}
.ac1-option-none:hover { border-color: #a8a29e; box-shadow: none; }
.ac1-option-none.selected {
  color: var(--color-fg);
  border-style: solid;
  border-color: #78716c;
  background: #f5f5f4;
  box-shadow: 0 0 0 1px #78716c;
}

/* Completion */
.ac1-done { text-align: center; padding: 40px 20px; }
.ac1-done-mark {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #dcfce7;
  color: var(--ac1-mint);
  font-size: 1.6rem;
  font-weight: 700;
}

/* Confirm dialog */
.ac1-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(28, 25, 23, 0.4);
  animation: ac1-fade 0.15s ease;
}
.ac1-modal-card { width: 100%; max-width: 26rem; }
.ac1-modal-card .ac1-nav { margin-top: 20px; }
@keyframes ac1-fade { from { opacity: 0; } }

@media (min-width: 640px) {
  .ac1 { padding: 0 24px 96px; }
  .ac1-panel { padding: 32px; }
  .ac1-progress { margin: 0 -24px 20px; padding: 10px 24px 12px; }
  .ac1-question { padding: 24px; }
  .ac1-options-grid { gap: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .ac1 *, .ac1 *::before, .ac1 *::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
