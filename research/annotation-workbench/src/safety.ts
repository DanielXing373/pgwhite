// =====================================================
// Hard guards: Annotation Workbench must never mutate DB
// =====================================================

const FORBIDDEN_SQL =
  /\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE|CALL|LOAD\s+DATA)\b/i

/** Reject any SQL that is not a pure read. */
export function assertReadOnlySql(sql: string): void {
  if (FORBIDDEN_SQL.test(sql)) {
    throw new Error(
      `[annotation-workbench] BLOCKED non-read SQL: ${sql.slice(0, 120)}`
    )
  }
}

export function assertNoPersistImport(importMetaUrl: string): void {
  const u = String(importMetaUrl)
  if (u.includes('persistImport') || u.includes('/weread/import')) {
    throw new Error(
      '[annotation-workbench] BLOCKED: must not load weread persistence / import APIs'
    )
  }
}

export const RESEARCH_ONLY_BANNER =
  'PGWhite annotation workbench — RESEARCH ONLY — ZERO DATABASE MUTATION — NO PRODUCTION TAG WRITES'
