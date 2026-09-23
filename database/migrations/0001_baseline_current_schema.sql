-- =====================================================
-- 0001_baseline_current_schema
--
-- Captures the CURRENT pgwhite schema as of Sprint 0.
-- Safe for existing databases: CREATE TABLE IF NOT EXISTS only.
-- Does NOT DROP DATABASE / DROP TABLE / truncate data.
--
-- Authoritative history of schema evolution lives under
-- database/migrations/ from this point forward.
-- =====================================================

CREATE TABLE IF NOT EXISTS authors (
  id INT NOT NULL AUTO_INCREMENT,
  emoji VARCHAR(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS books (
  id INT NOT NULL AUTO_INCREMENT,
  author_id INT DEFAULT NULL,
  emoji VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (id),
  KEY author_id (author_id),
  CONSTRAINT books_ibfk_1 FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS characters (
  id INT NOT NULL AUTO_INCREMENT,
  book_id INT NOT NULL,
  emoji VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (id),
  KEY book_id (book_id),
  CONSTRAINT characters_ibfk_1 FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tags (
  id INT NOT NULL AUTO_INCREMENT,
  source_code INT DEFAULT NULL,
  emoji VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quotes (
  id INT NOT NULL AUTO_INCREMENT,
  book_id INT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY book_id (book_id),
  CONSTRAINT quotes_ibfk_1 FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS author_translations (
  author_id INT NOT NULL,
  language_code CHAR(2) NOT NULL,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (author_id, language_code),
  CONSTRAINT author_translations_ibfk_1 FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS book_translations (
  book_id INT NOT NULL,
  language_code CHAR(2) NOT NULL,
  title VARCHAR(255) NOT NULL,
  PRIMARY KEY (book_id, language_code),
  CONSTRAINT book_translations_ibfk_1 FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS character_translations (
  character_id INT NOT NULL,
  language_code CHAR(2) NOT NULL,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (character_id, language_code),
  CONSTRAINT character_translations_ibfk_1 FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tag_translations (
  tag_id INT NOT NULL,
  language_code CHAR(2) NOT NULL,
  tag_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (tag_id, language_code),
  CONSTRAINT tag_translations_ibfk_1 FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quote_translations (
  quote_id INT NOT NULL,
  language_code CHAR(2) NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (quote_id, language_code),
  CONSTRAINT quote_translations_ibfk_1 FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quote_characters (
  quote_id INT NOT NULL,
  character_id INT NOT NULL,
  PRIMARY KEY (quote_id, character_id),
  KEY character_id (character_id),
  CONSTRAINT quote_characters_ibfk_1 FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE,
  CONSTRAINT quote_characters_ibfk_2 FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quote_tags (
  quote_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (quote_id, tag_id),
  KEY tag_id (tag_id),
  CONSTRAINT quote_tags_ibfk_1 FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE,
  CONSTRAINT quote_tags_ibfk_2 FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
