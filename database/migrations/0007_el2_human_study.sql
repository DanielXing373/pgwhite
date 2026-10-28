-- =====================================================
-- 0007_el2_human_study
--
-- Isolated EL2 human-preference research tables.
-- Additive only. Does NOT touch quotes, authors, books,
-- library_entries, imports, or other Library tables.
-- Anonymous by design: no contact details, names, raw IPs, or user agents.
-- =====================================================

CREATE TABLE IF NOT EXISTS el2_hs_protocol (
  protocol_version VARCHAR(64) NOT NULL,
  dataset_version VARCHAR(64) NOT NULL,
  randomization_version VARCHAR(64) NOT NULL,
  copy_version VARCHAR(64) NOT NULL,
  internal_master_sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (protocol_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS el2_hs_session (
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
  UNIQUE KEY uq_el2_hs_session_public_id (session_public_id),
  KEY idx_el2_hs_session_status_seen (completion_status, last_seen_at),
  KEY idx_el2_hs_session_mode_group (study_mode, experimental_group),
  CONSTRAINT el2_hs_session_protocol_fk
    FOREIGN KEY (protocol_version) REFERENCES el2_hs_protocol (protocol_version)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS el2_hs_assignment_item (
  id BIGINT NOT NULL AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  position TINYINT NOT NULL,
  section TINYINT NOT NULL,
  quote_id VARCHAR(64) NOT NULL,
  option_a_source VARCHAR(32) NOT NULL,
  option_b_source VARCHAR(32) NOT NULL,
  option_c_source VARCHAR(32) NOT NULL,
  option_d_source VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_el2_hs_assignment_position (session_id, position),
  UNIQUE KEY uq_el2_hs_assignment_quote (session_id, quote_id),
  KEY idx_el2_hs_assignment_quote (quote_id),
  CONSTRAINT el2_hs_assignment_session_fk
    FOREIGN KEY (session_id) REFERENCES el2_hs_session (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS el2_hs_response (
  id BIGINT NOT NULL AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  position TINYINT NOT NULL,
  quote_id VARCHAR(64) NOT NULL,
  choice ENUM('A', 'B', 'C', 'D', 'E') NOT NULL,
  answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_el2_hs_response_position (session_id, position),
  CONSTRAINT el2_hs_response_session_fk
    FOREIGN KEY (session_id) REFERENCES el2_hs_session (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS el2_hs_submit_lock (
  session_id BIGINT NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id),
  CONSTRAINT el2_hs_submit_lock_session_fk
    FOREIGN KEY (session_id) REFERENCES el2_hs_session (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session-creation rate limiting, shared across serverless instances.
-- No raw IPs: bucket_hash = HMAC-SHA256(daily random salt, client IP) or 'global'.
-- Rows are not linked to sessions. The app deletes counters older than one day
-- and salts older than the current UTC day on every session creation.
CREATE TABLE IF NOT EXISTS el2_hs_rate_salt (
  salt_day DATE NOT NULL,
  salt CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (salt_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS el2_hs_rate_limit (
  bucket_hash CHAR(64) NOT NULL,
  window_start DATETIME NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_hash, window_start),
  KEY idx_el2_hs_rate_limit_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Single-row lock for concurrent assignment (SELECT … FOR UPDATE).
CREATE TABLE IF NOT EXISTS el2_hs_assign_lock (
  study_mode ENUM('study', 'test') NOT NULL,
  lock_note VARCHAR(64) NOT NULL DEFAULT 'assign',
  PRIMARY KEY (study_mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO el2_hs_assign_lock (study_mode, lock_note) VALUES
  ('study', 'assign'),
  ('test', 'assign');

INSERT IGNORE INTO el2_hs_protocol (
  protocol_version,
  dataset_version,
  randomization_version,
  copy_version,
  internal_master_sha256
) VALUES (
  'el2-human-preference.protocol.v1',
  'el2-hs-questions.v1',
  'el2-assignment.v1',
  'el2-hs-copy.v3',
  '1e3b6d1f61974de3f8d24600fe7b51f5e3f53dd9c734d89c2ba725713fc2a4d8'
);
