// =====================================================
// File: composables/dimensions.ts
// 标题：维度常量与空 Facets（统一入口，便于未来增删维度）
// =====================================================
export const DIM_KEYS = ['authors','books','genres','times','themes','devices'] as const
export type DimKey = typeof DIM_KEYS[number]

export type FacetOptions = {
  authors: Array<{ id: string; label: string }>
  books:   Array<{ id: string; label: string }>
  genres:  Array<{ id: string; label: string }>
  times:   Array<{ id: string; label: string }>
  themes:  Array<{ id: string; label: string }>
  devices: Array<{ id: string; label: string }>
}

export const EMPTY_FACETS: FacetOptions = {
  authors: [], books: [], genres: [], times: [], themes: [], devices: []
}
