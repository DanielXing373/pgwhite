import type { DimKey, FacetOptions } from '~/composables/dimensions'
import {
  TAGTEST_SENTENCES,
  TEST_AUTHOR,
  TEST_BOOK,
  tagtestCatalog,
  tagtestDuplicateGroups,
  type TagtestFlagReason,
  type TagtestStatus
} from '~/data/tagtest/fixture'

export const TAGTEST_DIMS = ['characters', 'times', 'themes', 'devices'] as const
export type TagtestDim = (typeof TAGTEST_DIMS)[number]

export const TAGTEST_FLAG_REASONS: TagtestFlagReason[] = ['typo', 'tag', 'other']

export const TAGTEST_HINT_KEYS = [
  'tagtest.hintChip',
  'tagtest.hintRemove',
  'tagtest.hintNew',
  'tagtest.hintEdit',
  'tagtest.hintDup'
] as const

export type TagtestDraft = {
  text: string
  authorLabel: string
  bookLabel: string
  characterIds: string[]
  timeIds: string[]
  themeIds: string[]
  deviceIds: string[]
  status: TagtestStatus
  flags: TagtestFlagReason[]
}

const ID_FIELD: Record<TagtestDim, keyof Pick<TagtestDraft, 'characterIds' | 'timeIds' | 'themeIds' | 'deviceIds'>> = {
  characters: 'characterIds',
  times: 'timeIds',
  themes: 'themeIds',
  devices: 'deviceIds'
}

/** `/tagtest` 会话：假预处理、逐句草稿、状态与 flag。 */
export function useTagtestSession() {
  const { locale, setLocale, t } = useI18n()

  const langPicked = ref(false)
  const phase = ref<'loading' | 'edit' | 'done'>('loading')
  const currentIndex = ref(0)
  const committing = ref(false)
  const navLock = ref(false)
  const flashing = ref(false)
  const commitMessage = ref('')
  const hintIndex = ref(0)
  const catalog = ref<FacetOptions>(tagtestCatalog('zh'))
  const pinnedIds = ref<Record<TagtestDim, string[]>>({
    characters: [],
    times: [],
    themes: [],
    devices: []
  })
  const newTagDraft = reactive<Record<TagtestDim, string>>({
    characters: '',
    times: '',
    themes: '',
    devices: ''
  })
  const drafts = ref<TagtestDraft[]>([])
  const total = TAGTEST_SENTENCES.length

  const currentDraft = computed(() => drafts.value[currentIndex.value])

  const characterNote = computed(() => {
    const n = catalog.value.characters.length
    return n === 0 ? t('tagtest.characterEmpty') : t('tagtest.characterPinned', { count: n })
  })

  const duplicatePeerIds = computed(() => {
    const texts: Record<string, string> = {}
    TAGTEST_SENTENCES.forEach((s, i) => {
      texts[s.id] = drafts.value[i]?.text ?? s.text_zh
    })
    const id = TAGTEST_SENTENCES[currentIndex.value]?.id
    const group = tagtestDuplicateGroups(texts).find(g => g.ids.includes(id))
    return group ? group.ids.filter(x => x !== id) : []
  })

  function sentenceNumber(id: string) {
    return TAGTEST_SENTENCES.findIndex(s => s.id === id) + 1
  }

  function idsFor(dim: TagtestDim): string[] {
    const d = currentDraft.value
    if (!d) return []
    return d[ID_FIELD[dim]]
  }

  function setIds(dim: TagtestDim, ids: string[]) {
    const d = currentDraft.value
    if (!d) return
    d[ID_FIELD[dim]] = ids
  }

  function removeTag(dimension: DimKey, id: string) {
    if (!TAGTEST_DIMS.includes(dimension as TagtestDim)) return
    const dim = dimension as TagtestDim
    setIds(dim, idsFor(dim).filter(x => x !== id))
  }

  function clearCurrentTags() {
    const d = currentDraft.value
    if (!d) return
    d.characterIds = []
    d.timeIds = []
    d.themeIds = []
    d.deviceIds = []
  }

  function toggleFlag(reason: TagtestFlagReason) {
    const d = currentDraft.value
    if (!d) return
    d.flags = d.flags.includes(reason)
      ? d.flags.filter(x => x !== reason)
      : [...d.flags, reason]
  }

  function createTag(dim: TagtestDim) {
    const label = newTagDraft[dim].trim()
    if (!label) return
    const id = `new_${dim}_${Date.now()}`
    catalog.value = {
      ...catalog.value,
      [dim]: [{ id, label }, ...catalog.value[dim]]
    }
    pinnedIds.value[dim] = [id, ...pinnedIds.value[dim].filter(x => x !== id)]
    setIds(dim, [...idsFor(dim), id])
    newTagDraft[dim] = ''
  }

  function applyAutoTags(
    s: (typeof TAGTEST_SENTENCES)[number],
    auto: Partial<Record<DimKey, string[]>>
  ): TagtestDraft {
    const isEn = locale.value === 'en'
    const hasTags = Boolean(
      auto.characters?.length || auto.times?.length || auto.themes?.length || auto.devices?.length
    )
    return {
      text: isEn ? s.text_en : s.text_zh,
      authorLabel: isEn ? TEST_AUTHOR.label_en : TEST_AUTHOR.label_zh,
      bookLabel: isEn ? TEST_BOOK.label_en : TEST_BOOK.label_zh,
      characterIds: [...(auto.characters ?? [])],
      timeIds: [...(auto.times ?? [])],
      themeIds: [...(auto.themes ?? [])],
      deviceIds: [...(auto.devices ?? [])],
      status: hasTags ? 'preprocessed' : 'raw',
      flags: []
    }
  }

  async function startPreprocess() {
    phase.value = 'loading'
    try {
      const res = await $fetch<{ items: { id: string; autoTags: Partial<Record<DimKey, string[]>> }[] }>(
        '/api/tagtest/preprocess',
        { method: 'POST' }
      )
      const byId = new Map(res.items.map(i => [i.id, i.autoTags]))
      drafts.value = TAGTEST_SENTENCES.map(s => applyAutoTags(s, byId.get(s.id) ?? s.autoTags))
    } catch {
      drafts.value = TAGTEST_SENTENCES.map(s => applyAutoTags(s, s.autoTags))
    }
    currentIndex.value = 0
    phase.value = 'edit'
  }

  function keepCustomTags(next: FacetOptions): FacetOptions {
    const merge = (dim: TagtestDim) => {
      const extras = catalog.value[dim].filter(o => o.id.startsWith('new_'))
      const ids = new Set(next[dim].map(o => o.id))
      return [...extras.filter(o => !ids.has(o.id)), ...next[dim]]
    }
    return {
      ...next,
      characters: merge('characters'),
      times: merge('times'),
      themes: merge('themes'),
      devices: merge('devices')
    }
  }

  async function pickLang(code: 'zh' | 'en') {
    await setLocale(code)
    catalog.value = keepCustomTags(tagtestCatalog(code))
    langPicked.value = true
    await startPreprocess()
  }

  function hintStep(delta: number) {
    hintIndex.value = (hintIndex.value + delta + TAGTEST_HINT_KEYS.length) % TAGTEST_HINT_KEYS.length
  }

  function go(delta: number) {
    if (navLock.value) return
    const next = currentIndex.value + delta
    if (next < 0 || next >= total) return
    navLock.value = true
    flashing.value = true
    currentIndex.value = next
    hintStep(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    window.setTimeout(() => {
      flashing.value = false
      navLock.value = false
    }, 450)
  }

  async function commitAll() {
    committing.value = true
    const last = drafts.value[drafts.value.length - 1]
    if (last) last.status = 'reviewed'
    const payload = {
      sentences: TAGTEST_SENTENCES.map((s, i) => ({ id: s.id, ...drafts.value[i] }))
    }
    try {
      const res = await $fetch<{ message: string }>('/api/tagtest/commit', { method: 'POST', body: payload })
      commitMessage.value = res.message
    } catch {
      commitMessage.value = t('tagtest.commitFail')
    } finally {
      committing.value = false
      phase.value = 'done'
    }
  }

  let hintTimer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    hintTimer = setInterval(() => hintStep(1), 7000)
  })
  onUnmounted(() => {
    if (hintTimer) clearInterval(hintTimer)
  })

  return {
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
  }
}
