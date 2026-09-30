# ADR-003 — Import and Provenance

- **Status:** Accepted
- **Date:** 2026-09-30
- **Milestone:** PGWhite 1.1 (Documentation Baseline)

## Context

External highlights (especially WeRead) enter PGWhite through ingestion events. Historical production data was applied via offline SQL before Import tables existed. The product must preserve honest provenance: do not invent item-level history that cannot be recovered, and never conflate Import with Favorite.

## Decision

1. **Import ≠ Favorite.** Import is external content entering PGWhite; Favorite (future) is a PGWhite-native action on an existing Quote.
2. Prefer **raw preservation** for runtime imports (`import_items.raw_payload`) so failed/partial items remain inspectable.
3. Conceptual runtime path: **User → Import → ImportItem → LibraryEntry → Quote**.
4. Historical WeRead corpus (quote ids **119–1287**) uses **reconstructed** batch-level provenance:
   - one Import with `provenance_type = 'reconstructed'`
   - `reconstruction_key = 'legacy_weread_batch_2026-07-26'`
   - Library Entries may reference Import via `library_entries.import_id`
   - **zero** synthetic historical ImportItems
5. **Runtime imports must populate both paths, and both must reference the same Import:**
   - `ImportItem → LibraryEntry` (item-level provenance)
   - `LibraryEntry.import_id → Import` (batch-level provenance)
   - Failed/partial items may still lack a LibraryEntry; successful membership rows must set both links consistently.
6. AI / unreviewed annotations may remain usable in personal retrieval (Product Model); they are not “Favorite.”

Engineering references:

- Migrations `0002`–`0005` (`database/migrations/`)
- Forensic audit: `analysis/legacy-provenance-reconstruction.json` (not runtime)
- Constants: `server/utils/legacyWereadMigration.ts`

## Consequences

- Absence of historical ImportItems is meaningful truth, not unfinished migration.
- Deleting an Import with `library_entries.import_id` uses `ON DELETE SET NULL` — membership survives; batch pointer clears.
- Admin/offline WeRead SQL generator remains valid for 1.0 ops until 1.2 live user ingestion ships.
- `/api/dev/*` Import tooling is R&D-only (`DEV_DATA_TOOLS`).
- 1.2+ runtime ingestion implementations must not omit either link when a LibraryEntry is created; item and batch pointers must not point at different Imports.

## Alternatives considered

- Fabricate 1169 ImportItems with empty/fake payloads — rejected as dishonest.
- Treat reconstructed Import as indistinguishable from runtime — rejected; `provenance_type` is required.
- Collapse Import and Favorite into one “saved” relation — rejected.
- Runtime imports only use ImportItem→LibraryEntry **or** only `library_entries.import_id` — rejected; both are required and must agree.

## Open questions

- Live WeRead ingestion API shape and auth (1.2).
- How to re-fetch WeRead `createTime` / bookmark ids that were discarded by the historical SQL export path.
