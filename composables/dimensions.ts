// =====================================================
// File: composables/dimensions.ts
// 标题：维度常量与空 Facets（统一入口，便于未来增删维度）
// 筛选选项文案来自 GET /api/facets；id 与 URL query、/api/quotes 一致。
// =====================================================
export const DIM_KEYS = ['authors','books','characters','times','themes','devices'] as const
export type DimKey = typeof DIM_KEYS[number]

export type FacetOption = {
  id: string
  /** 显示文案（不含 emoji） */
  label: string
  /** 可选图标；国旗等需单独渲染以免变成字母 */
  emoji?: string
}

export type FacetOptions = {
  authors: FacetOption[]
  books: FacetOption[]
  characters: FacetOption[]
  times: FacetOption[]
  themes: FacetOption[]
  devices: FacetOption[]
}

export const EMPTY_FACETS: FacetOptions = {
  authors: [], books: [], characters: [], times: [], themes: [], devices: []
}
