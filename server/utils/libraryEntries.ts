// =====================================================
// Personal library membership helpers (Sprint 1A)
// Product: Library Entry ≠ Favorite / 收藏
// =====================================================

export type UserRow = {
  id: number
  display_name: string
  created_at: Date | string
  seed_key: string | null
}

export type LibraryEntryRow = {
  id: number
  user_id: number
  quote_id: number
  created_at: Date | string
}

/** MySQL unique index name from migration 0002 — regression anchor */
export const LIBRARY_ENTRY_UNIQUE_INDEX = 'uq_library_entries_user_quote'

export function isDuplicateLibraryMembershipError(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; message?: string }
  if (e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062) return true
  const msg = String(e?.message || '')
  return msg.includes(LIBRARY_ENTRY_UNIQUE_INDEX) || msg.includes('Duplicate entry')
}

/**
 * Pure validation before touching the DB.
 */
export function validateLibraryMembershipIds(
  userId: unknown,
  quoteId: unknown
):
  | { ok: true; userId: number; quoteId: number }
  | { ok: false; reason: 'invalid_user' | 'invalid_quote' } {
  const uid = Number(userId)
  const qid = Number(quoteId)
  if (!Number.isInteger(uid) || uid <= 0) return { ok: false, reason: 'invalid_user' }
  if (!Number.isInteger(qid) || qid <= 0) return { ok: false, reason: 'invalid_quote' }
  return { ok: true, userId: uid, quoteId: qid }
}
