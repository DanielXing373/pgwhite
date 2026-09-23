// =====================================================
// Dev-only gate for Sprint 1A data-model proof endpoints.
// Not production authentication.
// =====================================================

export function isDevDataToolsEnabled(): boolean {
  if (process.env.DEV_DATA_TOOLS === '1' || process.env.DEV_DATA_TOOLS === 'true') return true
  // Local `nuxt dev` / non-production only
  return process.env.NODE_ENV !== 'production'
}

export function assertDevDataTools() {
  if (!isDevDataToolsEnabled()) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not found'
    })
  }
}
