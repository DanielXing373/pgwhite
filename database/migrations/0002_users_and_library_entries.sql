-- =====================================================
-- 0002_users_and_library_entries
--
-- Sprint 1A: Users + personal library membership (not Favorite).
-- Additive only. Does not assign existing quotes to any user.
-- =====================================================

-- Identity for R&D / future accounts. No credentials.
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  display_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Stable key for optionally re-runnable seed scripts; NULL for future auth users.
  seed_key VARCHAR(64) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_seed_key (seed_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Personal Library Entry: this Quote is in this User's PGWhite personal corpus.
-- Not a Favorite relationship. Future Import provenance may attach here (deferred).
CREATE TABLE IF NOT EXISTS library_entries (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  quote_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_library_entries_user_quote (user_id, quote_id),
  KEY idx_library_entries_quote_id (quote_id),
  CONSTRAINT library_entries_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT library_entries_quote_fk
    FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
