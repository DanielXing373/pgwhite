// =====================================================
// tags 种类列与 1/2/3 数值（与 quotes / facets API 共用）
// =====================================================

export function safeIdent(raw: string, fallback: string): string {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw) ? raw : fallback
}

export function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function getTagKindParams(config: ReturnType<typeof useRuntimeConfig>) {
  return {
    kindCol: safeIdent(String(config.tagKindColumn || 'kind'), 'kind'),
    kTime: num(config.tagKindTime, 1),
    kTheme: num(config.tagKindTheme, 2),
    kDevice: num(config.tagKindDevice, 3)
  }
}
