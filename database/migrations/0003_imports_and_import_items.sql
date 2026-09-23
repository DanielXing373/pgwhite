-- =====================================================
-- 0003_imports_and_import_items
--
-- Sprint 1B: Import provenance foundation (not Favorite).
-- Additive only. Does not touch quotes content or assign legacy corpus.
-- =====================================================

-- One ingestion event for a user from an external/manual source.
CREATE TABLE IF NOT EXISTS imports (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  -- Free-form source id for now: weread | manual | kindle | csv | api | ...
  source VARCHAR(64) NOT NULL,
  -- pending | processing | completed | completed_with_issues | failed
  status VARCHAR(32) NOT NULL,
  started_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Convenience counters (denormalized; can be recomputed from import_items)
  total_items INT NOT NULL DEFAULT 0,
  processed_items INT NOT NULL DEFAULT 0,
  successful_items INT NOT NULL DEFAULT 0,
  failed_items INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_imports_user_id (user_id),
  KEY idx_imports_source_status (source, status),
  CONSTRAINT imports_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One external item observed during an Import. May exist without a Library Entry / Quote.
CREATE TABLE IF NOT EXISTS import_items (
  id INT NOT NULL AUTO_INCREMENT,
  import_id INT NOT NULL,
  -- Optional external stable id when the source provides one (nullable; many NULLs allowed).
  external_id VARCHAR(255) NULL,
  raw_payload JSON NOT NULL,
  -- pending | processed | duplicate | partial | failed
  status VARCHAR(32) NOT NULL,
  library_entry_id INT NULL DEFAULT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_import_items_import_id (import_id),
  KEY idx_import_items_library_entry_id (library_entry_id),
  KEY idx_import_items_status (status),
  -- Within one Import, the same external_id should not appear twice when present.
  UNIQUE KEY uq_import_items_import_external (import_id, external_id),
  CONSTRAINT import_items_import_fk
    FOREIGN KEY (import_id) REFERENCES imports (id) ON DELETE RESTRICT,
  CONSTRAINT import_items_library_entry_fk
    FOREIGN KEY (library_entry_id) REFERENCES library_entries (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
