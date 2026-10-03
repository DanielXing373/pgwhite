-- =====================================================
-- 0006_canonical_matching_and_personal_layer
--
-- PGWhite 1.3: Dedup = relationship + publication eligibility.
-- Does NOT merge/delete/overwrite Quotes.
-- Additive only.
-- =====================================================

-- Personal vs Community layer on Quote rows (coexistence; not merge).
ALTER TABLE quotes
  ADD COLUMN corpus_layer VARCHAR(32) NOT NULL DEFAULT 'personal'
    COMMENT 'personal | community — ownership/publication layer; not a merge key'
    AFTER book_id;

ALTER TABLE quotes
  ADD KEY idx_quotes_corpus_layer (corpus_layer);

-- WeRead / source chapter identity (NOT cross-edition canonical chapter id).
ALTER TABLE quotes
  ADD COLUMN source_chapter_uid VARCHAR(64) NULL DEFAULT NULL
    COMMENT 'Source chapter id (e.g. WeRead chapterUid); provenance/matching only'
    AFTER corpus_layer;

ALTER TABLE quotes
  ADD COLUMN chapter_title VARCHAR(255) NULL DEFAULT NULL
    COMMENT 'Human-readable chapter title when available (display metadata)'
    AFTER source_chapter_uid;

ALTER TABLE quotes
  ADD KEY idx_quotes_book_chapter (book_id, source_chapter_uid);

-- Publication eligibility derived from matcher (user consent still required later).
-- personal_only | publication_unresolved | publication_eligible
ALTER TABLE quotes
  ADD COLUMN publication_eligibility VARCHAR(32) NULL DEFAULT NULL
    COMMENT 'Matcher-derived eligibility; NOT user consent; NOT auto-publish'
    AFTER chapter_title;

-- Curated baseline corpus (quote ids 1–118) is Community layer.
UPDATE quotes
   SET corpus_layer = 'community'
 WHERE id BETWEEN 1 AND 118
   AND corpus_layer = 'personal';

-- Canonical relationship: Personal Quote ↔ related Community Quote.
-- Never implies row merge or text overwrite.
CREATE TABLE IF NOT EXISTS quote_match_relations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  source_quote_id INT NOT NULL COMMENT 'Personal Quote being matched',
  target_quote_id INT NOT NULL COMMENT 'Related Quote (typically Community)',
  relation_status VARCHAR(32) NOT NULL COMMENT 'matched | possible_match',
  publication_eligibility VARCHAR(32) NOT NULL
    COMMENT 'personal_only | publication_unresolved | publication_eligible',
  score_features JSON NULL,
  matcher_rule VARCHAR(128) NOT NULL,
  matcher_version VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quote_match_source_target (source_quote_id, target_quote_id),
  KEY idx_quote_match_source (source_quote_id),
  KEY idx_quote_match_target (target_quote_id),
  KEY idx_quote_match_status (relation_status),
  CONSTRAINT quote_match_relations_source_fk
    FOREIGN KEY (source_quote_id) REFERENCES quotes (id) ON DELETE CASCADE,
  CONSTRAINT quote_match_relations_target_fk
    FOREIGN KEY (target_quote_id) REFERENCES quotes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Personal annotations (e.g. WeRead review text) live on Library Entry, not Community Quote.
CREATE TABLE IF NOT EXISTS personal_annotations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  library_entry_id INT NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'weread_review',
  external_id VARCHAR(255) NULL,
  raw_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_personal_annotations_le_external (library_entry_id, external_id),
  KEY idx_personal_annotations_library_entry (library_entry_id),
  CONSTRAINT personal_annotations_library_entry_fk
    FOREIGN KEY (library_entry_id) REFERENCES library_entries (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Best-effort chapter backfill for runtime WeRead bookmark imports (additive; no text changes).
UPDATE quotes q
INNER JOIN library_entries le ON le.quote_id = q.id
INNER JOIN import_items ii ON ii.library_entry_id = le.id
SET
  q.source_chapter_uid = NULLIF(
    JSON_UNQUOTE(JSON_EXTRACT(ii.raw_payload, '$.item.chapterUid')),
    'null'
  )
WHERE ii.external_id LIKE 'weread:bookmark:%'
  AND q.source_chapter_uid IS NULL
  AND JSON_EXTRACT(ii.raw_payload, '$.item.chapterUid') IS NOT NULL;
