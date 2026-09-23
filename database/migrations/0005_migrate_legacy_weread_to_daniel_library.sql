-- =====================================================
-- 0005_migrate_legacy_weread_to_daniel_library
--
-- Sprint 1C: Attach HIGH-confidence historical WeRead Quotes (ids 119–1287)
-- to Daniel's personal Library, with one reconstructed Import batch.
--
-- Evidence: analysis/legacy-provenance-reconstruction.json (Sprint 1C.0)
--   weread_import HIGH = 1169, ids 119–1287 contiguous, exact content match.
--
-- Creates:
--   * 1 reconstructed Import (provenance_type=reconstructed)
--   * 1169 library_entries for quote_id 119..1287
--   * 0 import_items (no synthetic per-highlight payloads)
--
-- Does NOT:
--   * assign quotes 1–118 to Daniel
--   * modify quotes / translations / tags / characters
--   * invent WeRead account ids, bookmark ids, or runtime timestamps
--
-- Idempotent: reconstruction_key UNIQUE + library_entries (user_id, quote_id) UNIQUE
-- =====================================================

-- Assert helpers: scalar subquery returning 2 rows aborts the migration.
-- (mysql2 multipleStatements does not support DELIMITER / SIGNAL procedures cleanly.)

-- Exactly one Daniel (seed_key)
SET @__assert = (
  SELECT IF(
    (SELECT COUNT(*) FROM users WHERE seed_key = 'dev_daniel') = 1,
    1,
    (SELECT 1 UNION SELECT 2)
  )
);

-- Exactly 1169 quotes in validated WeRead range
SET @__assert = (
  SELECT IF(
    (SELECT COUNT(*) FROM quotes WHERE id BETWEEN 119 AND 1287) = 1169,
    1,
    (SELECT 1 UNION SELECT 2)
  )
);

-- 1) Reconstructed historical Import for the 2026-07-26 WeRead batch.
--    Timestamps left NULL: calendar batch date is encoded in reconstruction_key;
--    we do not invent original runtime start/end instants.
INSERT INTO imports (
  user_id,
  source,
  provenance_type,
  reconstruction_key,
  status,
  started_at,
  completed_at,
  total_items,
  processed_items,
  successful_items,
  failed_items
)
SELECT
  u.id,
  'weread',
  'reconstructed',
  'legacy_weread_batch_2026-07-26',
  'completed',
  NULL,
  NULL,
  1169,
  1169,
  1169,
  0
FROM users u
WHERE u.seed_key = 'dev_daniel'
  AND NOT EXISTS (
    SELECT 1 FROM imports i
    WHERE i.reconstruction_key = 'legacy_weread_batch_2026-07-26'
  );

SET @__assert = (
  SELECT IF(
    (SELECT COUNT(*) FROM imports WHERE reconstruction_key = 'legacy_weread_batch_2026-07-26') = 1,
    1,
    (SELECT 1 UNION SELECT 2)
  )
);

SET @__assert = (
  SELECT IF(
    (
      SELECT provenance_type FROM imports
      WHERE reconstruction_key = 'legacy_weread_batch_2026-07-26'
    ) = 'reconstructed',
    1,
    (SELECT 1 UNION SELECT 2)
  )
);

-- 2) Daniel Library Entries for every WeRead-origin quote (119–1287).
--    import_id = reconstructed batch (batch-level provenance; no ImportItems).
INSERT INTO library_entries (user_id, quote_id, import_id)
SELECT
  u.id,
  q.id,
  i.id
FROM quotes q
INNER JOIN users u ON u.seed_key = 'dev_daniel'
INNER JOIN imports i ON i.reconstruction_key = 'legacy_weread_batch_2026-07-26'
WHERE q.id BETWEEN 119 AND 1287
ON DUPLICATE KEY UPDATE
  import_id = IF(
    library_entries.import_id IS NULL,
    VALUES(import_id),
    library_entries.import_id
  );

-- 3) Post conditions
SET @__assert = (
  SELECT IF(
    (
      SELECT COUNT(*) FROM library_entries le
      INNER JOIN users u ON u.id = le.user_id AND u.seed_key = 'dev_daniel'
    ) = 1169,
    1,
    (SELECT 1 UNION SELECT 2)
  )
);

SET @__assert = (
  SELECT IF(
    (
      SELECT COUNT(*) FROM library_entries le
      INNER JOIN users u ON u.id = le.user_id AND u.seed_key = 'dev_daniel'
      WHERE le.quote_id BETWEEN 1 AND 118
    ) = 0,
    1,
    (SELECT 1 UNION SELECT 2)
  )
);

SET @__assert = (
  SELECT IF(
    (
      SELECT COUNT(*) FROM library_entries le
      INNER JOIN users u ON u.id = le.user_id AND u.seed_key = 'dev_daniel'
      INNER JOIN imports i ON i.id = le.import_id
        AND i.reconstruction_key = 'legacy_weread_batch_2026-07-26'
        AND i.provenance_type = 'reconstructed'
      WHERE le.quote_id BETWEEN 119 AND 1287
    ) = 1169,
    1,
    (SELECT 1 UNION SELECT 2)
  )
);

SET @__assert = (
  SELECT IF(
    (
      SELECT COUNT(*) FROM import_items ii
      INNER JOIN imports i ON i.id = ii.import_id
      WHERE i.reconstruction_key = 'legacy_weread_batch_2026-07-26'
    ) = 0,
    1,
    (SELECT 1 UNION SELECT 2)
  )
);
