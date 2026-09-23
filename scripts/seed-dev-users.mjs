#!/usr/bin/env node
/**
 * Seed development/R&D users (Sprint 1A).
 * Not authentication. No passwords. Idempotent via seed_key.
 *
 * Usage:
 *   pnpm db:seed:dev-users
 *   MIGRATE_ALLOW_REMOTE=1 pnpm db:seed:dev-users   # if DB_* points at Railway
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const DEV_USERS = [
  { seed_key: 'dev_daniel', display_name: 'Daniel' },
  { seed_key: 'dev_test_user_a', display_name: 'Test User A' },
  { seed_key: 'dev_test_user_b', display_name: 'Test User B' }
]

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

function env(name, fallback = '') {
  return process.env[name] ?? fallback
}

function isRemoteHost(host) {
  const h = host.toLowerCase()
  return h.includes('.rlwy.net') || h.includes('railway.app') || h.includes('.proxy.')
}

async function main() {
  const fileEnv = loadEnvFile(resolve(ROOT, '.env'))
  const host = env('DB_HOST', fileEnv.DB_HOST || '')
  const port = Number(env('DB_PORT', fileEnv.DB_PORT || '3306'))
  const user = env('DB_USER', fileEnv.DB_USER || '')
  const password = env('DB_PASSWORD', fileEnv.DB_PASSWORD || '')
  const database = env('DB_NAME', fileEnv.DB_NAME || '')
  if (!host || !user || !database) throw new Error('Missing DB_HOST / DB_USER / DB_NAME')

  if (isRemoteHost(host) && env('MIGRATE_ALLOW_REMOTE') !== '1') {
    throw new Error(
      `Refusing remote host "${host}". Set MIGRATE_ALLOW_REMOTE=1 to seed Railway.`
    )
  }

  const ssl =
    env('DB_SSL') === '1' ||
    env('DB_SSL') === 'true' ||
    isRemoteHost(host)
      ? { rejectUnauthorized: false }
      : undefined

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    ssl,
    connectTimeout: 20_000
  })

  try {
    // Ensure table exists (migration must have been applied)
    await conn.query('SELECT 1 FROM users LIMIT 1')

    for (const u of DEV_USERS) {
      await conn.query(
        `INSERT INTO users (display_name, seed_key)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
        [u.display_name, u.seed_key]
      )
    }

    const [rows] = await conn.query(
      `SELECT id, display_name, seed_key, created_at
       FROM users
       WHERE seed_key IS NOT NULL
       ORDER BY id`
    )
    console.log('Seeded development users (not auth accounts):')
    for (const r of rows) {
      console.log(`  id=${r.id}  seed_key=${r.seed_key}  display_name=${r.display_name}`)
    }
    console.log('No library_entries created for legacy quotes (Sprint 1C deferred).')
  } finally {
    await conn.end()
  }
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
