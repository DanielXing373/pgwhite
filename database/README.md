# Database migrations

From Sprint 0 onward, **`database/migrations/` is the authoritative history of schema evolution.**

Do **not** use the legacy local file `pgwhite DDL.sql` (gitignored, contains `DROP DATABASE`) against any shared or production database.

## Commands

```bash
# What is applied vs pending (uses DB_* from env / .env)
pnpm db:migrate:status

# Apply pending migrations (skipped if already recorded in schema_migrations)
pnpm db:migrate

# Record a migration as applied WITHOUT running its SQL
# (use when the schema already exists, e.g. long-lived Railway after baseline)
pnpm db:migrate:mark 0001

# Scaffold a new migration file
pnpm db:migrate:new add_something

# Seed R&D users only (idempotent via seed_key; not auth; no library_entries for legacy quotes)
pnpm db:seed:dev-users
```

## Safety

- Remote hosts (Railway / `*.rlwy.net` / `railway.app`):
  - `status` is read-only and allowed
  - `up` / `mark` / `db:seed:dev-users` require:

  ```bash
  MIGRATE_ALLOW_REMOTE=1 pnpm db:migrate
  MIGRATE_ALLOW_REMOTE=1 pnpm db:seed:dev-users
  ```

- Already-applied versions are never re-executed.
- Baseline / Sprint 1A migrations use additive `CREATE TABLE IF NOT EXISTS` only (no drops).

## Sprint 1A tables

- `users` — identity without credentials (`seed_key` for re-runnable R&D seeds)
- `library_entries` — personal library membership `(user_id, quote_id)` UNIQUE; **not Favorite**

## Sprint 1B tables

- `imports` — one ingestion event per user/source
- `import_items` — observed external items with `raw_payload` JSON; optional `library_entry_id`

Proof (remote needs `MIGRATE_ALLOW_REMOTE=1`):

```bash
pnpm db:proof:import
```

## Sprint 1C (legacy WeRead ownership)

- `0004` — `imports.provenance_type` / `reconstruction_key`; `library_entries.import_id` (batch-level provenance; `ON DELETE SET NULL`)
- `0005` — one reconstructed WeRead Import + 1169 Daniel library entries for quote ids 119–1287; **no** import_items; quotes 1–118 untouched

Idempotency: `reconstruction_key` UNIQUE + `(user_id, quote_id)` UNIQUE + `INSERT … ON DUPLICATE KEY UPDATE`.

## Environments

| Environment | How to point | Notes |
|-------------|--------------|--------|
| Production (Railway) | `DB_*` + `MIGRATE_ALLOW_REMOTE=1` | Prefer reviewing SQL first |
| Development | Local MySQL `DB_*` (not Railway) | Safe default for iterate |
| Tests | **No DB** | `pnpm test` is offline unit tests |

Never point automated tests at Railway.

## Tracking table

`schema_migrations (version PK, name, applied_at)` is created automatically by the runner.
