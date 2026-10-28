<template>
  <div class="el2" :class="{ 'el2--consent': screen === 'welcome' }">
    <header v-if="screen !== 'welcome'" class="el2-header">
      <img src="/logo.svg" alt="" class="el2-logo" width="40" height="40" />
      <div>
        <p class="el2-kicker">鸽白词句库</p>
        <h1 class="el2-title">阅读研究</h1>
      </div>
    </header>

    <p v-if="studyMode === 'test'" class="el2-banner">{{ copy.test_banner }}</p>
    <p v-if="error" class="el2-error" role="alert">{{ error }}</p>

    <section v-if="booting" class="el2-panel el2-loading" role="status">
      <span class="el2-spinner el2-spinner--muted" aria-hidden="true" />
      <p class="el2-text el2-muted">{{ copy.loading }}</p>
    </section>

    <!-- Welcome & consent -->
    <section v-else-if="screen === 'welcome'" class="el2-panel el2-welcome">
      <h2 class="el2-h2">{{ copy.welcome }}</h2>
      <p v-for="para in copy.research_description" :key="para" class="el2-text">{{ para }}</p>
      <div class="el2-consent">
        <ul class="el2-list">
          <li v-for="item in copy.consent_bullets" :key="item">{{ item }}</li>
        </ul>
      </div>
      <p class="el2-text el2-muted">{{ copy.consent_ack }}</p>

      <nav class="el2-nav">
        <a class="el2-btn el2-btn-secondary" href="/">{{ copy.decline }}</a>
        <button class="el2-btn el2-btn-primary" type="button" :disabled="loading" @click="start">
          <span v-if="loading" class="el2-spinner" aria-hidden="true" />
          {{ copy.start }}
        </button>
      </nav>
    </section>

    <!-- Questions -->
    <section v-else-if="screen === 'section1' || screen === 'section2'" class="el2-survey">
      <div ref="sentinel" aria-hidden="true" />
      <div class="el2-progress" :class="{ 'el2-progress--stuck': progressStuck }" role="status">
        <div class="el2-progress-row">
          <span class="el2-progress-label">{{ screen === 'section1' ? copy.progress_1 : copy.progress_2 }}</span>
          <span class="el2-progress-count">{{ copy.answered_prefix }} {{ answeredCount }} / 10</span>
        </div>
        <div class="el2-progress-track" aria-hidden="true">
          <div class="el2-progress-fill" :style="{ width: answeredCount * 10 + '%' }" />
        </div>
      </div>

      <div class="el2-instructions">
        <p class="el2-text">{{ sectionCopy }}</p>
        <p v-if="sectionNotice" class="el2-notice"><strong>{{ sectionNotice }}</strong></p>
      </div>

      <article
        v-for="q in pageQuestions"
        :id="'q-' + q.position"
        :key="q.position"
        class="el2-question"
        :class="{ 'el2-question--missing': attempted && !answers[q.position] }"
      >
        <blockquote class="el2-quote">
          <span class="el2-qnum"><span class="el2-required" aria-label="必选">*</span>{{ q.position }}.</span>
          {{ q.text_zh }}
        </blockquote>
        <p class="el2-cite">——{{ q.author_name_zh }}《{{ q.book_title_zh }}》</p>

        <div
          class="el2-options"
          role="radiogroup"
          :aria-label="'第 ' + q.position + ' 段摘录'"
          @keydown="onOptionKeydown($event, q.position)"
        >
          <div class="el2-options-grid">
            <button
              v-for="opt in q.options"
              :key="opt.key"
              type="button"
              class="el2-option"
              :class="{ selected: answers[q.position] === opt.key }"
              role="radio"
              :aria-checked="answers[q.position] === opt.key"
              :tabindex="tabIndexFor(q.position, opt.key)"
              :data-choice="opt.key"
              @click="select(q.position, opt.key)"
            >
              <span class="el2-optkey">{{ opt.key }}</span>
              <span class="el2-theme-stack">
                <Chip
                  v-for="theme in opt.themes"
                  :key="theme.label_zh"
                  :label="theme.label_zh"
                  dimension="themes"
                  :state="answers[q.position] === opt.key ? 'active' : 'hover'"
                />
              </span>
            </button>
          </div>
          <button
            type="button"
            class="el2-option el2-option-none"
            :class="{ selected: answers[q.position] === 'E' }"
            role="radio"
            :aria-checked="answers[q.position] === 'E'"
            :tabindex="tabIndexFor(q.position, 'E')"
            data-choice="E"
            @click="select(q.position, 'E')"
          >
            {{ q.none_label_zh }}
          </button>
        </div>
      </article>

      <nav class="el2-nav">
        <button
          v-if="screen === 'section2'"
          class="el2-btn el2-btn-secondary"
          type="button"
          @click="goSection(1)"
        >
          {{ copy.back }}
        </button>
        <span v-else />
        <button
          v-if="screen === 'section1'"
          class="el2-btn el2-btn-primary"
          type="button"
          @click="goSection(2)"
        >
          {{ copy.continue }}
        </button>
        <button v-else class="el2-btn el2-btn-primary" type="button" @click="askSubmit">
          {{ copy.submit_yes }}
        </button>
      </nav>
    </section>

    <section v-else-if="screen === 'done'" class="el2-panel el2-done">
      <div class="el2-done-mark" aria-hidden="true">✓</div>
      <h2 class="el2-h2">{{ copy.thank_you }}</h2>
    </section>

    <div
      v-if="confirmOpen"
      class="el2-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="el2-confirm-text"
      @keydown.esc="confirmOpen = false"
      @click.self="confirmOpen = false"
    >
      <div class="el2-panel el2-modal-card">
        <p id="el2-confirm-text" class="el2-text">{{ copy.submit_confirm }}</p>
        <nav class="el2-nav">
          <button class="el2-btn el2-btn-secondary" type="button" @click="confirmOpen = false">
            {{ copy.submit_back }}
          </button>
          <button
            ref="confirmBtn"
            class="el2-btn el2-btn-primary"
            type="button"
            :disabled="loading"
            @click="submit"
          >
            <span v-if="loading" class="el2-spinner" aria-hidden="true" />
            {{ copy.submit_yes }}
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { COPY } from '../server/utils/el2hs/copy'

definePageMeta({ layout: false })

type Choice = 'A' | 'B' | 'C' | 'D' | 'E'
type Question = {
  position: number
  section: 1 | 2
  quote_id: string
  text_zh: string
  author_name_zh: string | null
  book_title_zh: string | null
  options: { key: 'A' | 'B' | 'C' | 'D'; themes: { label_zh: string }[] }[]
  none_label_zh: string
}
type Session = {
  study_mode: 'study' | 'test'
  experimental_group: 'control' | 'disclosure'
  completion_status: string
  section_instructions: { 1: string; 2: string }
  section_notices?: { 1: string | null; 2: string | null }
  answers: Record<string, Choice>
  questions: Question[]
}

const CHOICES: Choice[] = ['A', 'B', 'C', 'D', 'E']

const route = useRoute()
const studyMode = computed(() => (route.query.mode === 'test' ? 'test' : 'study'))
const copy = ref<typeof COPY>(COPY)
const session = ref<Session | null>(null)
const answers = ref<Record<number, Choice>>({})
const screen = ref<'welcome' | 'section1' | 'section2' | 'done'>('welcome')
const booting = ref(true)
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
const answeredCount = computed(() => Object.keys(answers.value).length)
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
  const next: Record<number, Choice> = {}
  for (const [k, v] of Object.entries(s.answers || {})) next[Number(k)] = v
  answers.value = next
  if (s.completion_status === 'completed') screen.value = 'done'
}

async function recover() {
  try {
    const data = await $fetch<{ session: Session }>('/api/el2test/session')
    applySession(data.session)
    if (data.session.completion_status !== 'completed') screen.value = 'section1'
  } catch {
    screen.value = 'welcome'
  }
}

onMounted(async () => {
  const loadMeta = async () => {
    try {
      const meta = await $fetch<{ copy: typeof copy.value }>('/api/el2test/meta')
      copy.value = { ...copy.value, ...meta.copy }
    } catch {
      /* frozen fallback copy already in the page */
    }
  }
  await Promise.all([loadMeta(), recover()])
  booting.value = false
})

async function start() {
  error.value = ''
  loading.value = true
  try {
    const data = await $fetch<{ session: Session }>('/api/el2test/session', {
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

async function persist() {
  const payload = Object.entries(answers.value).map(([position, choice]) => ({
    position: Number(position),
    choice
  }))
  try {
    await $fetch('/api/el2test/draft', { method: 'POST', body: { answers: payload } })
  } catch (e: any) {
    if (e?.statusCode === 409) {
      screen.value = 'done'
      error.value = copy.value.already_submitted
    }
  }
}

function select(position: number, choice: Choice) {
  answers.value = { ...answers.value, [position]: choice }
  if (attempted.value && !firstUnanswered()) error.value = ''
  persist()
}

function tabIndexFor(position: number, choice: Choice) {
  const current = answers.value[position]
  if (current) return current === choice ? 0 : -1
  return choice === 'A' ? 0 : -1
}

function onOptionKeydown(event: KeyboardEvent, position: number) {
  const step =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : 0
  if (!step) return
  event.preventDefault()
  const current = answers.value[position] ?? 'A'
  const next = CHOICES[(CHOICES.indexOf(current) + step + CHOICES.length) % CHOICES.length]!
  select(position, next)
  const group = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-choice="${next}"]`)
  group?.focus()
}

function firstUnanswered(): number | null {
  for (const q of pageQuestions.value) {
    if (!answers.value[q.position]) return q.position
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

async function goSection(n: 1 | 2) {
  error.value = ''
  if (n === 2 && flagMissing()) return
  attempted.value = false
  screen.value = n === 1 ? 'section1' : 'section2'
  await nextTick()
  window.scrollTo({ top: 0 })
}

function askSubmit() {
  if (flagMissing()) return
  confirmOpen.value = true
}

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const payload = Object.entries(answers.value).map(([position, choice]) => ({
      position: Number(position),
      choice
    }))
    const data = await $fetch<{ session: Session }>('/api/el2test/submit', {
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
.el2 {
  --el2-sky: #0ea5e9;
  --el2-sky-soft: #f0f9ff;
  --el2-lavender: #d8b4fe;
  --el2-lavender-soft: #faf5ff;
  --el2-mint: #10b981;
  --el2-red: #dc2626;
  --el2-border: #e7e5e4;
  --el2-ease: cubic-bezier(0.2, 0.7, 0.2, 1);

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

.el2-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 28px;
  margin-bottom: 28px;
}
.el2-logo { width: 40px; height: 40px; }
.el2-kicker { margin: 0; color: var(--color-muted); font-size: 0.85rem; line-height: 1.3; }
.el2-title { margin: 0; font-size: 1.3rem; font-weight: 600; line-height: 1.3; }

.el2-text {
  margin: 0 0 1em;
  font-family: var(--font-serif);
  line-height: 1.6;
}
.el2-text:last-child { margin-bottom: 0; }
.el2-muted { color: var(--color-muted); }

.el2-banner, .el2-error {
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
}
.el2-banner { background: #fef9c3; border: 1px solid #fde047; }
.el2-error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

.el2-panel {
  background: #fff;
  border: 1px solid #f5f5f4;
  border-radius: 12px;
  padding: 24px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.el2-h2 {
  margin: 0 0 16px;
  font-family: var(--font-serif);
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.5;
}

.el2-consent {
  margin: 20px 0;
  padding: 16px;
  background: var(--color-bg);
  border-radius: 8px;
}
.el2-list {
  margin: 0;
  padding-left: 1.25em;
  list-style: disc;
  font-family: var(--font-serif);
}
.el2-list li { margin: 0 0 8px; line-height: 1.6; }
.el2-list li:last-child { margin-bottom: 0; }

/* Consent screen: no header, so the card leads. svh keeps Safari's toolbar from forcing a scroll. */
.el2.el2--consent {
  box-sizing: border-box;
  min-height: 100vh;
  min-height: 100svh;
  padding-top: max(16px, env(safe-area-inset-top));
  padding-bottom: max(24px, env(safe-area-inset-bottom));
}
.el2--consent .el2-panel { padding: 22px 18px; }
.el2--consent .el2-h2 { margin-bottom: 12px; font-size: 1.125rem; }
.el2--consent .el2-text { margin-bottom: 0.75em; font-size: 0.9375rem; line-height: 1.7; }
.el2--consent .el2-consent { margin: 16px 0; padding: 14px 16px; }
.el2--consent .el2-list { padding-left: 1.1em; font-size: 0.875rem; }
.el2--consent .el2-list li { margin-bottom: 6px; line-height: 1.65; }
.el2--consent .el2-muted { font-size: 0.875rem; }
.el2--consent .el2-nav { margin-top: 20px; }

/* Navigation row: back/decline on the left, forward action on the right. */
.el2-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 28px;
}

.el2-btn {
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
  transition: transform 0.15s var(--el2-ease), box-shadow 0.15s var(--el2-ease),
    background-color 0.15s ease, border-color 0.15s ease;
}
.el2-btn:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
.el2-btn:active:not(:disabled) { transform: scale(0.97); }
.el2-btn:disabled { opacity: 0.55; cursor: progress; }

.el2-btn-primary {
  background: var(--color-brand);
  color: #fff;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.25);
}
.el2-btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  transform: translateY(-1px);
}
.el2-btn-secondary {
  background: #fff;
  color: var(--color-fg);
  border-color: #d6d3d1;
}
.el2-btn-secondary:hover {
  background: #fafaf9;
  border-color: #a8a29e;
}

.el2-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
  border-radius: 50%;
  animation: el2-spin 0.7s linear infinite;
}
@keyframes el2-spin { to { transform: rotate(360deg); } }
.el2-spinner--muted { flex-shrink: 0; border-color: #e7e5e4; border-top-color: var(--color-brand); }
.el2-loading { display: flex; align-items: center; gap: 12px; }

/* Progress */
.el2-progress {
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
.el2-progress--stuck {
  border-bottom-color: #e7e5e4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.el2-progress-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  font-size: 0.9rem;
}
.el2-progress-label { font-weight: 600; }
.el2-progress-count { color: var(--color-muted); font-variant-numeric: tabular-nums; }
.el2-progress-track {
  height: 6px;
  background: #e7e5e4;
  border-radius: 999px;
  overflow: hidden;
}
.el2-progress-fill {
  height: 100%;
  background: var(--el2-mint);
  border-radius: 999px;
  transition: width 0.3s var(--el2-ease);
}

.el2-instructions {
  margin-bottom: 24px;
  padding: 14px 16px;
  background: var(--el2-lavender-soft);
  border-left: 4px solid var(--el2-lavender);
  border-radius: 8px;
}
.el2-notice {
  margin: 8px 0 0;
  color: var(--color-ink, #1c1917);
}
.el2-required { color: var(--el2-red); font-weight: 700; margin-right: 2px; }

/* Question unit */
.el2-question {
  background: #fff;
  border: 1px solid #f5f5f4;
  border-radius: 12px;
  padding: 20px 16px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  scroll-margin-top: 88px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.el2-question--missing {
  border-color: #fca5a5;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
}
.el2-quote {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-fg);
}
.el2-qnum {
  margin-right: 4px;
  font-family: var(--font-sans);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.el2-cite {
  margin: 10px 0 20px;
  text-align: right;
  font-family: var(--font-serif);
  font-size: 0.9rem;
  color: var(--color-muted);
}

.el2-options { display: flex; flex-direction: column; gap: 10px; }
.el2-options-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.el2-option {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 10px 4px 12px;
  background: #fff;
  border: 1.5px solid var(--el2-border);
  border-radius: 10px;
  color: inherit;
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.12s var(--el2-ease), border-color 0.15s ease,
    background-color 0.15s ease, box-shadow 0.15s ease;
}
.el2-option:hover { border-color: #7dd3fc; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.12); }
.el2-option:active { transform: scale(0.97); }
.el2-option:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
.el2-option.selected {
  border-color: var(--el2-sky);
  background: var(--el2-sky-soft);
  box-shadow: 0 0 0 1px var(--el2-sky);
}
.el2-optkey {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-muted);
  line-height: 1;
  margin-bottom: 2px;
}
.el2-option.selected .el2-optkey { color: var(--el2-sky); }
.el2-theme-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.el2-theme-stack :deep(.result-chip) {
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

.el2-option-none {
  flex-direction: row;
  justify-content: center;
  padding: 12px;
  color: var(--color-muted);
  border-style: dashed;
}
.el2-option-none:hover { border-color: #a8a29e; box-shadow: none; }
.el2-option-none.selected {
  color: var(--color-fg);
  border-style: solid;
  border-color: #78716c;
  background: #f5f5f4;
  box-shadow: 0 0 0 1px #78716c;
}

/* Completion */
.el2-done { text-align: center; padding: 40px 20px; }
.el2-done-mark {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #dcfce7;
  color: var(--el2-mint);
  font-size: 1.6rem;
  font-weight: 700;
}

/* Confirm dialog */
.el2-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(28, 25, 23, 0.4);
  animation: el2-fade 0.15s ease;
}
.el2-modal-card { width: 100%; max-width: 26rem; }
.el2-modal-card .el2-nav { margin-top: 20px; }
@keyframes el2-fade { from { opacity: 0; } }

@media (min-width: 640px) {
  .el2 { padding: 0 24px 96px; }
  .el2-panel { padding: 32px; }
  .el2-progress { margin: 0 -24px 20px; padding: 10px 24px 12px; }
  .el2-question { padding: 24px; }
  .el2-options-grid { gap: 12px; }
  .el2.el2--consent { padding-top: 48px; padding-bottom: 48px; }
  .el2--consent .el2-panel { padding: 32px; }
}

@media (prefers-reduced-motion: reduce) {
  .el2 *, .el2 *::before, .el2 *::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
