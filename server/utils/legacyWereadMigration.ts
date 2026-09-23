// =====================================================
// Sprint 1C — Legacy WeRead corpus → Daniel Library
// Constants + helpers (not Favorite). Evidence-backed range only.
// =====================================================

/** Machine-readable Import.origin semantics (imports.provenance_type) */
export const IMPORT_PROVENANCE_TYPES = ['runtime', 'reconstructed'] as const
export type ImportProvenanceType = (typeof IMPORT_PROVENANCE_TYPES)[number]

export function isImportProvenanceType(v: unknown): v is ImportProvenanceType {
  return (
    typeof v === 'string' &&
    (IMPORT_PROVENANCE_TYPES as readonly string[]).includes(v)
  )
}

/**
 * Unique reconstruction_key for the documented 2026-07-26 WeRead SQL batch.
 * Encodes calendar batch date; does not invent runtime start/end timestamps.
 */
export const LEGACY_WEREAD_RECONSTRUCTION_KEY = 'legacy_weread_batch_2026-07-26'

/** Validated HIGH-confidence WeRead quote id range (Sprint 1C.0 reconstruction) */
export const LEGACY_WEREAD_QUOTE_ID_MIN = 119
export const LEGACY_WEREAD_QUOTE_ID_MAX = 1287
export const LEGACY_WEREAD_QUOTE_COUNT = 1169

/** Global / curated corpus upper bound (not assigned to Daniel in Sprint 1C) */
export const LEGACY_GLOBAL_QUOTE_ID_MAX = 118
export const LEGACY_GLOBAL_QUOTE_COUNT = 118

export const DANIEL_SEED_KEY = 'dev_daniel'

export function isLegacyWereadQuoteId(quoteId: number): boolean {
  return (
    Number.isInteger(quoteId) &&
    quoteId >= LEGACY_WEREAD_QUOTE_ID_MIN &&
    quoteId <= LEGACY_WEREAD_QUOTE_ID_MAX
  )
}

export function isLegacyGlobalQuoteId(quoteId: number): boolean {
  return (
    Number.isInteger(quoteId) &&
    quoteId >= 1 &&
    quoteId <= LEGACY_GLOBAL_QUOTE_ID_MAX
  )
}

/** Expected Daniel library membership after Sprint 1C migration */
export function expectedDanielLibraryMembership(quoteId: number): boolean {
  return isLegacyWereadQuoteId(quoteId)
}
