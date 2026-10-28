# EL2 human-study data dictionary

**Schema:** migration `database/migrations/0007_el2_human_study.sql` (**not executed**).  
Existing PGWhite MySQL instance, **separate tables** prefixed `el2_hs_`. No writes to `quotes`, `authors`, `library_entries`, or import tables.

The study is anonymous. No table stores names, emails, phone numbers, WeChat IDs, other contact details, raw IP addresses, user agents, or PGWhite `users.id`.

## Tables

### `el2_hs_protocol`

| Column | Type | Notes |
| --- | --- | --- |
| protocol_version | VARCHAR(64) PK | `el2-human-preference.protocol.v1` |
| dataset_version | VARCHAR(64) NOT NULL | `el2-hs-questions.v1` |
| randomization_version | VARCHAR(64) NOT NULL | `el2-assignment.v1` |
| copy_version | VARCHAR(64) NOT NULL | `el2-hs-copy.v3` (seed) |
| internal_master_sha256 | CHAR(64) NOT NULL | `1e3b6d1f…fc2a4d8` |
| created_at | TIMESTAMP | |

### `el2_hs_session`

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK AI | internal only |
| session_public_id | CHAR(64) UNIQUE NOT NULL | CSPRNG hex; not sequential |
| session_token_hash | CHAR(64) NOT NULL | SHA-256 of the cookie secret |
| study_mode | ENUM('study','test') NOT NULL | |
| experimental_group | ENUM('control','disclosure') NOT NULL | |
| protocol_version / dataset_version / randomization_version / copy_version | VARCHAR(64) NOT NULL | copy_version is `el2-hs-copy.v3` for all sessions created by current code |
| assignment_json | JSON NOT NULL | quote ids, order, A–D source map; **server only** |
| consented / consented_at | TINYINT / TIMESTAMP | |
| completion_status | ENUM('in_progress','completed','abandoned') | |
| created_at / last_seen_at / submitted_at | TIMESTAMP | |

### `el2_hs_assignment_item`

Denormalized rows for SQL analysis (same data as `assignment_json`).

| Column | Type |
| --- | --- |
| session_id FK | |
| position | TINYINT 1–10 |
| section | TINYINT 1–2 |
| quote_id | VARCHAR(64) |
| option_a_source … option_d_source | VARCHAR(32) |

E is always `none`. UNIQUE(session_id, position), UNIQUE(session_id, quote_id).

### `el2_hs_response`

| Column | Type |
| --- | --- |
| session_id FK | |
| position | TINYINT |
| quote_id | VARCHAR(64) |
| choice | ENUM('A','B','C','D','E') |
| answered_at | TIMESTAMP |

UNIQUE(session_id, position). Reconstruct source: join assignment_item for A–D; E → none.

### `el2_hs_submit_lock`

session_id PK. Inserted in the submit transaction to prevent double submit.

### `el2_hs_assign_lock`

One row per study_mode; `SELECT … FOR UPDATE` serializes assignment.

### `el2_hs_rate_salt` / `el2_hs_rate_limit` (abuse control, not research data)

| Table | Columns | Notes |
| --- | --- | --- |
| `el2_hs_rate_salt` | salt_day DATE PK, salt CHAR(64), created_at | random per UTC day; earlier days deleted on use |
| `el2_hs_rate_limit` | bucket_hash CHAR(64), window_start DATETIME, hits INT; PK(bucket_hash, window_start) | bucket = HMAC(salt, client IP) or `global`; rows > 24 h deleted on use |

Not linked to sessions and never exported. See `SECURITY.md`.

## Transactions

**Assign:** lock `el2_hs_assign_lock` row; compute counters; INSERT session + 10 assignment_items. One transaction.

**Draft save:** UPSERT responses; does not set completed.

**Submit:** lock session row; if already completed, return stored payload (idempotent); else require exactly 10 positions with choices in {A–E} matching the assignment; INSERT submit_lock; UPSERT responses; set completed, submitted_at. The request body may contain only `answers`; any other field is rejected (400).

## Access control

Participant APIs: `GET /api/el2test/meta`, `GET|POST /api/el2test/session`, `POST /api/el2test/draft`, `POST /api/el2test/submit`. None return source ids. Export: `GET /api/el2test/export` behind `EL2_HS_EXPORT_TOKEN` (≥ 32 chars); see `SECURITY.md`.

## Export columns

`session_public_id, study_mode, experimental_group, dataset_version, protocol_version, randomization_version, copy_version, completion_status, created_at, submitted_at, quality_flags, position, section, quote_id, option_a_source, option_b_source, option_c_source, option_d_source, choice, mapped_source, answered_at`

One row per completed session × position. `quality_flags` is computed at export time (`QUALITY-REVIEW.md`). No contact, IP, or user-agent columns.

## Retention

Keep completed study rows ≥ 24 months or until the paper is archived. Rate-limit rows and salts self-delete within a day. Test-mode rows deletable after 30 days. Git never stores `el2_hs_response` dumps or exports (`human-study/responses/` is gitignored).

## Backup

Use the same MySQL backup as PGWhite. Restore is table-level; do not restore into `quotes`. Exports generated on a locked workstation.

## Reconstruction

`mapped_source = assignment.option_{choice}_source` if choice in A–D else `none`, using `dataset_version` to load the matching internal master for Theme IDs actually shown.
