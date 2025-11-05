// =====================================================
// File: composables/useQueryState.ts
// 标题：查询状态（与 URL 同步）
// 规则：空数组 = 默认全选；page 可后续加入
// =====================================================
type DimKey = 'authors' | 'books' | 'genres' | 'times' | 'themes' | 'devices'

function parseArr(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[]
  if (typeof val === 'string' && val.length) return val.split(',').filter(Boolean)
  return []
}
function joinArr(arr: string[]) { return arr.length ? arr.join(',') : undefined }

export function useQueryState() {
  const route = useRoute()
  const router = useRouter()

  const q = ref<string>(typeof route.query.q === 'string' ? route.query.q : '')

  const authors = ref<string[]>(parseArr(route.query.authors))
  const books   = ref<string[]>(parseArr(route.query.books))
  const genres  = ref<string[]>(parseArr(route.query.genres))
  const times   = ref<string[]>(parseArr(route.query.times))
  const themes  = ref<string[]>(parseArr(route.query.themes))
  const devices = ref<string[]>(parseArr(route.query.devices))

  // 后三个维度的"满足所有筛选"复选框状态
  const timesAll = ref<boolean>(route.query.timesAll === 'true')
  const themesAll = ref<boolean>(route.query.themesAll === 'true')
  const devicesAll = ref<boolean>(route.query.devicesAll === 'true')

  // —— 写回 URL（防抖，避免跳动） —— //
  function debounce<T extends (...args: any[]) => void>(fn: T, delay = 200): T {
    let timer: ReturnType<typeof setTimeout> | null = null
    return ((...args: Parameters<T>) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => fn(...args), delay)
    }) as T
  }
  
  const updateUrl = debounce(() => {
    router.replace({
      query: {
        q: q.value || undefined,
        authors: joinArr(authors.value),
        books:   joinArr(books.value),
        genres:  joinArr(genres.value),
        times:   joinArr(times.value),
        themes:  joinArr(themes.value),
        devices: joinArr(devices.value),
        timesAll: timesAll.value ? 'true' : undefined,
        themesAll: themesAll.value ? 'true' : undefined,
        devicesAll: devicesAll.value ? 'true' : undefined
      }
    })
  }, 200)

  watch([q, authors, books, genres, times, themes, devices, timesAll, themesAll, devicesAll], updateUrl, { deep: true })

  /**
   * 只清除文本搜索，不影响标签筛选
   */
  function clearSearch() {
    q.value = ''
  }

  /**
   * 清除所有搜索条件（文本搜索 + 所有标签）
   */
  function resetAll() {
    q.value = ''
    authors.value = []
    books.value = []
    genres.value = []
    times.value = []
    themes.value = []
    devices.value = []
    timesAll.value = false
    themesAll.value = false
    devicesAll.value = false
  }

  return { q, authors, books, genres, times, themes, devices, timesAll, themesAll, devicesAll, clearSearch, resetAll }
}