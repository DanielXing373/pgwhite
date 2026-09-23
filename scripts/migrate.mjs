#!/usr/bin/env node
/**
 * Lightweight MySQL migration runner for pgWhite.
 *
 * Commands:
 *   pnpm db:migrate:status
 *   pnpm db:migrate
 *   pnpm db:migrate:mark <version>   # record only (no SQL) — for already-provisioned DBs
 *   pnpm db:migrate:new <slug>       # create empty migration file
 *
 * Safety:
 * - Refuses hosts that look like Railway/public remote unless MIGRATE_ALLOW_REMOTE=1
 * - Never silently re-runs applied migrations (tracked in schema_migrations)
 * - Does not DROP DATABASE
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MIGRATIONS_DIR = resolve(ROOT, 'database/migrations')

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

function resolveDbConfig() {
  const fileEnv = { ...loadEnvFile(resolve(ROOT, '.env')) }
  const host = env('DB_HOST', fileEnv.DB_HOST || '')
  const port = Number(env('DB_PORT', fileEnv.DB_PORT || '3306'))
  const user = env('DB_USER', fileEnv.DB_USER || '')
  const password = env('DB_PASSWORD', fileEnv.DB_PASSWORD || '')
  const database = env('DB_NAME', fileEnv.DB_NAME || '')
  if (!host || !user || !database) {
    throw new Error('Missing DB_HOST / DB_USER / DB_NAME (set in env or .env)')
  }
  return { host, port, user, password, database }
}

function isRemoteHost(host) {
  const h = host.toLowerCase()
  return (
    h.includes('.rlwy.net') ||
    h.includes('railway.app') ||
    h.includes('.proxy.') ||
    env('MIGRATE_FORCE_REMOTE_CHECK', '') === '1'
  )
}

function shouldUseSsl(host) {
  if (env('DB_SSL') === '1' || env('DB_SSL') === 'true') return true
  if (env('DB_SSL') === '0' || env('DB_SSL') === 'false') return false
  return isRemoteHost(host)
}

/** writing=false allows read-only status on remote; writing=true requires MIGRATE_ALLOW_REMOTE=1 */
function assertSafeTarget(cfg, { writing }) {
  if (!isRemoteHost(cfg.host)) return
  if (!writing) {
    console.warn(`[migrate] Remote target (read-only): ${cfg.host} / ${cfg.database}`)
    return
  }
  if (env('MIGRATE_ALLOW_REMOTE') === '1') {
    console.warn(`[migrate] REMOTE write allowed: ${cfg.host} / ${cfg.database}`)
    return
  }
  throw new Error(
    `[migrate] Refusing remote host "${cfg.host}".\n` +
      `Set MIGRATE_ALLOW_REMOTE=1 explicitly if you intend to migrate this database.\n` +
      `For local/dev, point DB_* at a local MySQL (not Railway).`
  )
}

function listMigrationFiles() {
  if (!existsSync(MIGRATIONS_DIR)) return []
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d+_.*\.sql$/i.test(f))
    .sort()
}

function versionFromFilename(filename) {
  const m = basename(filename).match(/^(\d+)/)
  return m ? m[1] : basename(filename)
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function appliedVersions(conn) {
  const [rows] = await conn.query('SELECT version, name, applied_at FROM schema_migrations ORDER BY version')
  return rows
}

async function connect({ writing }) {
  const cfg = resolveDbConfig()
  assertSafeTarget(cfg, { writing })
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    multipleStatements: true,
    connectTimeout: 20_000,
    ...(shouldUseSsl(cfg.host) ? { ssl: { rejectUnauthorized: false } } : {})
  })
  return { conn, cfg }
}

async function cmdStatus() {
  const { conn, cfg } = await connect({ writing: false })
  try {
    let applied = []
    try {
      applied = await appliedVersions(conn)
    } catch {
      console.log('Note: schema_migrations not found yet (run pnpm db:migrate to create).')
    }
    const appliedSet = new Set(applied.map(r => r.version))
    const files = listMigrationFiles()
    console.log(`Target: ${cfg.host}:${cfg.port}/${cfg.database}`)
    console.log(`Migrations dir: ${MIGRATIONS_DIR}`)
    console.log('')
    for (const f of files) {
      const v = versionFromFilename(f)
      const mark = appliedSet.has(v) ? 'applied' : 'pending'
      console.log(`  [${mark}] ${f}`)
    }
    const pending = files.filter(f => !appliedSet.has(versionFromFilename(f)))
    console.log('')
    console.log(`Applied: ${applied.length}  Pending: ${pending.length}`)
  } finally {
    await conn.end()
  }
}

async function cmdUp() {
  const { conn, cfg } = await connect({ writing: true })
  try {
    await ensureMigrationsTable(conn)
    const applied = await appliedVersions(conn)
    const appliedSet = new Set(applied.map(r => r.version))
    const files = listMigrationFiles()
    const pending = files.filter(f => !appliedSet.has(versionFromFilename(f)))
    if (pending.length === 0) {
      console.log(`No pending migrations (${cfg.host}/${cfg.database}).`)
      return
    }
    for (const f of pending) {
      const version = versionFromFilename(f)
      const name = basename(f)
      const sql = readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8')
      console.log(`Applying ${name} ...`)
      await conn.beginTransaction()
      try {
        await conn.query(sql)
        await conn.query('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [version, name])
        await conn.commit()
        console.log(`  ok ${name}`)
      } catch (err) {
        await conn.rollback()
        throw err
      }
    }
    console.log(`Done. Applied ${pending.length} migration(s).`)
  } finally {
    await conn.end()
  }
}

async function cmdMark(versionArg) {
  if (!versionArg) throw new Error('Usage: pnpm db:migrate:mark <version>  (e.g. 0001)')
  const files = listMigrationFiles()
  const match = files.find(f => versionFromFilename(f) === versionArg || f.startsWith(versionArg))
  if (!match) throw new Error(`No migration file matching version "${versionArg}"`)
  const version = versionFromFilename(match)
  const name = basename(match)
  const { conn, cfg } = await connect({ writing: true })
  try {
    await ensureMigrationsTable(conn)
    const [rows] = await conn.query('SELECT version FROM schema_migrations WHERE version = ?', [version])
    if (rows.length) {
      console.log(`Already marked applied: ${name} (${cfg.database})`)
      return
    }
    await conn.query('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [version, name])
    console.log(`Marked applied (no SQL run): ${name} on ${cfg.host}/${cfg.database}`)
  } finally {
    await conn.end()
  }
}

function cmdNew(slug) {
  if (!slug) throw new Error('Usage: pnpm db:migrate:new <slug>')
  const safe = String(slug)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!safe) throw new Error('Invalid slug')
  const files = listMigrationFiles()
  let next = 1
  if (files.length) {
    const last = versionFromFilename(files[files.length - 1])
    next = Number(last) + 1
  }
  const version = String(next).padStart(4, '0')
  const filename = `${version}_${safe}.sql`
  const path = resolve(MIGRATIONS_DIR, filename)
  const stub = `-- ${filename}\n-- Write forward-only DDL here. Do not DROP DATABASE.\n\n`
  writeFileSync(path, stub, 'utf8')
  console.log(`Created ${path}`)
}

async function main() {
  const [cmd, arg] = process.argv.slice(2)
  switch (cmd) {
    case 'status':
      await cmdStatus()
      break
    case 'up':
      await cmdUp()
      break
    case 'mark':
      await cmdMark(arg)
      break
    case 'new':
      cmdNew(arg)
      break
    default:
      console.log(`Usage:
  node scripts/migrate.mjs status
  node scripts/migrate.mjs up
  node scripts/migrate.mjs mark <version>
  node scripts/migrate.mjs new <slug>`)
      process.exit(cmd ? 1 : 0)
  }
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
