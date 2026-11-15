-- =====================================================
-- 0008_ac1_human_study
--
-- Isolated AC1 human tag-review questionnaire tables (/ac1test).
-- Additive only. Does NOT touch quotes, authors, books, library_entries,
-- imports, quote_tags, or the el2_hs_* tables of the earlier questionnaire.
-- Anonymous by design: no contact details, names, raw IPs, or user agents.
--
-- Same layout as 0007_el2_human_study with two differences:
--   * ac1_hs_assignment_item has no option_*_source columns (an excerpt shows
--     one pooled tag list, not four source-specific options);
--   * ac1_hs_response stores the ticked tag ids instead of a letter A–E.
-- Safe to run more than once.
-- =====================================================

CREATE TABLE IF NOT EXISTS ac1_hs_protocol (
  protocol_version VARCHAR(64) NOT NULL,
  dataset_version VARCHAR(64) NOT NULL,
  randomization_version VARCHAR(64) NOT NULL,
  copy_version VARCHAR(64) NOT NULL,
  internal_master_sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (protocol_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ac1_hs_session (
  id BIGINT NOT NULL AUTO_INCREMENT,
  session_public_id CHAR(64) NOT NULL,
  session_token_hash CHAR(64) NOT NULL,
  study_mode ENUM('study', 'test') NOT NULL DEFAULT 'study',
  experimental_group ENUM('control', 'disclosure') NOT NULL,
  protocol_version VARCHAR(64) NOT NULL,
  dataset_version VARCHAR(64) NOT NULL,
  randomization_version VARCHAR(64) NOT NULL,
  copy_version VARCHAR(64) NOT NULL,
  assignment_json JSON NOT NULL,
  consented TINYINT(1) NOT NULL DEFAULT 0,
  consented_at TIMESTAMP NULL DEFAULT NULL,
  completion_status ENUM('in_progress', 'completed', 'abandoned') NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ac1_hs_session_public_id (session_public_id),
  KEY idx_ac1_hs_session_status_seen (completion_status, last_seen_at),
  KEY idx_ac1_hs_session_mode_group (study_mode, experimental_group),
  CONSTRAINT ac1_hs_session_protocol_fk
    FOREIGN KEY (protocol_version) REFERENCES ac1_hs_protocol (protocol_version)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ac1_hs_assignment_item (
  id BIGINT NOT NULL AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  position TINYINT NOT NULL,
  section TINYINT NOT NULL,
  quote_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ac1_hs_assignment_position (session_id, position),
  UNIQUE KEY uq_ac1_hs_assignment_quote (session_id, quote_id),
  KEY idx_ac1_hs_assignment_quote (quote_id),
  CONSTRAINT ac1_hs_assignment_session_fk
    FOREIGN KEY (session_id) REFERENCES ac1_hs_session (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per answered excerpt. Exactly one of the two holds (enforced by the app):
--   selected_tag_ids is a non-empty JSON array of ticked tag ids and none_selected = 0, or
--   selected_tag_ids is [] and none_selected = 1 (the participant chose 「都不合适」).
-- A tag of the excerpt that is not in selected_tag_ids was judged 不合适.
CREATE TABLE IF NOT EXISTS ac1_hs_response (
  id BIGINT NOT NULL AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  position TINYINT NOT NULL,
  quote_id VARCHAR(64) NOT NULL,
  selected_tag_ids JSON NOT NULL,
  none_selected TINYINT(1) NOT NULL DEFAULT 0,
  answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ac1_hs_response_position (session_id, position),
  CONSTRAINT ac1_hs_response_session_fk
    FOREIGN KEY (session_id) REFERENCES ac1_hs_session (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ac1_hs_submit_lock (
  session_id BIGINT NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id),
  CONSTRAINT ac1_hs_submit_lock_session_fk
    FOREIGN KEY (session_id) REFERENCES ac1_hs_session (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session-creation rate limiting, shared across serverless instances.
-- No raw IPs: bucket_hash = HMAC-SHA256(daily random salt, client IP) or 'global'.
-- Rows are not linked to sessions. The app deletes counters older than one day
-- and salts older than the current UTC day on every session creation.
CREATE TABLE IF NOT EXISTS ac1_hs_rate_salt (
  salt_day DATE NOT NULL,
  salt CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (salt_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ac1_hs_rate_limit (
  bucket_hash CHAR(64) NOT NULL,
  window_start DATETIME NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_hash, window_start),
  KEY idx_ac1_hs_rate_limit_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Single-row lock for concurrent assignment (SELECT … FOR UPDATE).
CREATE TABLE IF NOT EXISTS ac1_hs_assign_lock (
  study_mode ENUM('study', 'test') NOT NULL,
  lock_note VARCHAR(64) NOT NULL DEFAULT 'assign',
  PRIMARY KEY (study_mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO ac1_hs_assign_lock (study_mode, lock_note) VALUES
  ('study', 'assign'),
  ('test', 'assign');

-- Must match server/utils/ac1hs/constants.ts. internal_master_sha256 is the content hash
-- (SHA-256 of JSON.stringify(quotes)) of the frozen question set ac1-hs-questions.v1.
INSERT IGNORE INTO ac1_hs_protocol (
  protocol_version,
  dataset_version,
  randomization_version,
  copy_version,
  internal_master_sha256
) VALUES (
  'ac1-human-tag-review.protocol.v1',
  'ac1-hs-questions.v1',
  'ac1-assignment.v1',
  'ac1-hs-copy.v1',
  '300a53ab8e3202c17bfe909d032bfd1f575751907047a3fb92431f8debc87f36'
);
