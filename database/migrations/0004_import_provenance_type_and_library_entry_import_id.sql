-- =====================================================
-- 0004_import_provenance_type_and_library_entry_import_id
--
-- Sprint 1C: Schema for reconstructed historical Import provenance
-- and batch-level Library Entry → Import linkage.
-- Additive only. No quote content / tag changes. No ownership DML here.
-- =====================================================

-- Machine-readable Import origin:
--   runtime       — created by an actual ingestion run
--   reconstructed — forensic/historical provenance (not an original runtime row)
ALTER TABLE imports
  ADD COLUMN provenance_type VARCHAR(32) NOT NULL DEFAULT 'runtime'
    COMMENT 'runtime | reconstructed'
    AFTER source;

-- Stable idempotency key for reconstructed Imports only (NULL for runtime).
-- Example: legacy_weread_batch_2026-07-26
ALTER TABLE imports
  ADD COLUMN reconstruction_key VARCHAR(64) NULL DEFAULT NULL
    COMMENT 'Unique key for reconstructed Imports; NULL for runtime'
    AFTER provenance_type;

ALTER TABLE imports
  ADD UNIQUE KEY uq_imports_reconstruction_key (reconstruction_key);

ALTER TABLE imports
  ADD KEY idx_imports_provenance_type (provenance_type);

-- Batch-level provenance: Library Entry may reference Import directly
-- when item-level ImportItem evidence is unavailable (historical reconstruction).
-- Future runtime path remains: Import → ImportItem → LibraryEntry.
--
-- ON DELETE SET NULL: deleting an Import clears the provenance pointer but
-- keeps the user's Library membership (membership ≠ provenance record).
-- Contrast: import_items.import_id stays ON DELETE RESTRICT (items cannot
-- outlive their Import batch).
ALTER TABLE library_entries
  ADD COLUMN import_id INT NULL DEFAULT NULL
    COMMENT 'Optional originating Import batch (batch-level provenance)'
    AFTER quote_id;

ALTER TABLE library_entries
  ADD KEY idx_library_entries_import_id (import_id);

ALTER TABLE library_entries
  ADD CONSTRAINT library_entries_import_fk
    FOREIGN KEY (import_id) REFERENCES imports (id) ON DELETE SET NULL;
