// =====================================================
// Import / Import Item status vocabulary (Sprint 1B)
// Import ≠ Favorite. Preserve raw data first.
// =====================================================

/** Import (batch/event) statuses */
export const IMPORT_STATUSES = [
  'pending',
  'processing',
  'completed',
  'completed_with_issues',
  'failed'
] as const

export type ImportStatus = (typeof IMPORT_STATUSES)[number]

/**
 * pending — created, not started
 * processing — actively handling items
 * completed — finished; every item ended in a successful terminal state (processed or duplicate)
 * completed_with_issues — finished; at least one item failed/partial/still pending
 * failed — batch could not be completed (aborted / unusable)
 */
export const IMPORT_STATUS_MEANINGS: Record<ImportStatus, string> = {
  pending: 'Created; not started',
  processing: 'Actively processing items',
  completed: 'Finished with no failed/partial/pending items',
  completed_with_issues: 'Finished; some items failed, partial, or unresolved',
  failed: 'Batch aborted or could not complete'
}

/** Import Item statuses */
export const IMPORT_ITEM_STATUSES = [
  'pending',
  'processed',
  'duplicate',
  'partial',
  'failed'
] as const

export type ImportItemStatus = (typeof IMPORT_ITEM_STATUSES)[number]

/**
 * pending — observed; not yet processed; raw_payload retained
 * processed — successfully linked to a Library Entry (and thus a Quote path)
 * duplicate — recognized as already represented; may optionally link an existing entry
 * partial — incomplete normalization; raw retained; library_entry_id may be null
 * failed — could not produce a Library Entry; raw_payload MUST remain for later inspect/retry
 */
export const IMPORT_ITEM_STATUS_MEANINGS: Record<ImportItemStatus, string> = {
  pending: 'Observed; not processed yet',
  processed: 'Successfully produced / linked Library Entry',
  duplicate: 'Already represented; raw retained',
  partial: 'Incomplete result; raw retained',
  failed: 'No Library Entry; raw retained for inspect/retry'
}

export function isImportStatus(v: unknown): v is ImportStatus {
  return typeof v === 'string' && (IMPORT_STATUSES as readonly string[]).includes(v)
}

export function isImportItemStatus(v: unknown): v is ImportItemStatus {
  return typeof v === 'string' && (IMPORT_ITEM_STATUSES as readonly string[]).includes(v)
}

/** Successful terminal item outcomes for an Import marked fully completed */
export function isSuccessfulItemStatus(s: ImportItemStatus): boolean {
  return s === 'processed' || s === 'duplicate'
}

export function isIssueItemStatus(s: ImportItemStatus): boolean {
  return s === 'failed' || s === 'partial' || s === 'pending'
}

/**
 * Derive Import status from item statuses after a batch finishes processing.
 * Does not implement a workflow engine — pure aggregation helper.
 */
export function deriveImportStatusFromItems(
  itemStatuses: ImportItemStatus[]
): Extract<ImportStatus, 'completed' | 'completed_with_issues' | 'failed'> {
  if (itemStatuses.length === 0) return 'completed'
  const allFailed = itemStatuses.every(s => s === 'failed')
  if (allFailed) return 'failed'
  if (itemStatuses.some(isIssueItemStatus)) return 'completed_with_issues'
  return 'completed'
}

export function summarizeItemCounts(itemStatuses: ImportItemStatus[]): {
  total_items: number
  processed_items: number
  successful_items: number
  failed_items: number
} {
  const total_items = itemStatuses.length
  const processed_items = itemStatuses.filter(s => s !== 'pending').length
  const successful_items = itemStatuses.filter(isSuccessfulItemStatus).length
  const failed_items = itemStatuses.filter(s => s === 'failed').length
  return { total_items, processed_items, successful_items, failed_items }
}
