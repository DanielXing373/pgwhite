#!/usr/bin/env node
/**
 * Sprint 1B proof: Import provenance foundation (dev/R&D only).
 * Creates Import for Daniel + successful item + failed item with raw JSON retained.
 *
 * Usage:
 *   MIGRATE_ALLOW_REMOTE=1 pnpm db:proof:import
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import {
  deriveImportStatusFromItems,
  summarizeItemCounts
} from '../server/utils/importStatuses.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

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
  if (!host || !user || !database) throw new Error('Missing DB_*')

  if (isRemoteHost(host) && env('MIGRATE_ALLOW_REMOTE') !== '1') {
    throw new Error(`Refusing remote host. Set MIGRATE_ALLOW_REMOTE=1`)
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    ssl: isRemoteHost(host) ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 20_000
  })

  try {
    const [[daniel]] = await conn.query(
      `SELECT id FROM users WHERE seed_key = 'dev_daniel' LIMIT 1`
    )
    if (!daniel) throw new Error('Seed Daniel first: pnpm db:seed:dev-users')

    // Ensure quote 1 exists for successful library entry path
    const [[q1]] = await conn.query(`SELECT id FROM quotes WHERE id = 1`)
    if (!q1) throw new Error('Quote id=1 missing; cannot prove successful link')

    await conn.query(
      `INSERT INTO library_entries (user_id, quote_id)
       VALUES (?, 1)
       ON DUPLICATE KEY UPDATE id = id`,
      [daniel.id]
    )
    const [[le]] = await conn.query(
      `SELECT id FROM library_entries WHERE user_id = ? AND quote_id = 1`,
      [daniel.id]
    )

    const [impRes] = await conn.query(
      `INSERT INTO imports (user_id, source, status, started_at)
       VALUES (?, 'weread', 'processing', CURRENT_TIMESTAMP)`,
      [daniel.id]
    )
    const importId = impRes.insertId

    const successPayload = {
      source: 'weread',
      bookId: '24953413',
      markText: '证明用：成功归一化的划线',
      chapterUid: 3,
      createTime: 1710000000,
      unusedFieldWeDoNotModelYet: { style: 'underline', color: 1 }
    }
    const failedPayload = {
      source: 'weread',
      bookId: 'unknown-book',
      markText: '证明用：无法归一化但仍保留 raw',
      createTime: 1710001000,
      mystery: ['a', 'b']
    }

    await conn.query(
      `INSERT INTO import_items
         (import_id, external_id, raw_payload, status, library_entry_id, error_message, processed_at)
       VALUES (?, ?, CAST(? AS JSON), 'processed', ?, NULL, CURRENT_TIMESTAMP)`,
      [importId, 'weread-proof-success-1', JSON.stringify(successPayload), le.id]
    )

    await conn.query(
      `INSERT INTO import_items
         (import_id, external_id, raw_payload, status, library_entry_id, error_message, processed_at)
       VALUES (?, ?, CAST(? AS JSON), 'failed', NULL, ?, CURRENT_TIMESTAMP)`,
      [
        importId,
        'weread-proof-failed-1',
        JSON.stringify(failedPayload),
        'Could not resolve book metadata (proof)'
      ]
    )

    const statuses = ['processed', 'failed']
    const derived = deriveImportStatusFromItems(statuses)
    const counts = summarizeItemCounts(statuses)
    await conn.query(
      `UPDATE imports SET status=?, completed_at=CURRENT_TIMESTAMP,
         total_items=?, processed_items=?, successful_items=?, failed_items=?
       WHERE id=?`,
      [
        derived,
        counts.total_items,
        counts.processed_items,
        counts.successful_items,
        counts.failed_items,
        importId
      ]
    )

    const [[imp]] = await conn.query(`SELECT * FROM imports WHERE id = ?`, [importId])
    const [items] = await conn.query(
      `SELECT id, external_id, status, library_entry_id, error_message, raw_payload
       FROM import_items WHERE import_id = ? ORDER BY id`,
      [importId]
    )
    const [[qc]] = await conn.query(`SELECT COUNT(*) AS n FROM quotes`)
    const [[lec]] = await conn.query(`SELECT COUNT(*) AS n FROM library_entries`)

    console.log(
      JSON.stringify(
        {
          quotes: qc.n,
          library_entries_total: lec.n,
          import: {
            id: imp.id,
            user_id: imp.user_id,
            source: imp.source,
            status: imp.status,
            counts: {
              total: imp.total_items,
              processed: imp.processed_items,
              successful: imp.successful_items,
              failed: imp.failed_items
            }
          },
          items: items.map(it => ({
            id: it.id,
            external_id: it.external_id,
            status: it.status,
            library_entry_id: it.library_entry_id,
            error_message: it.error_message,
            raw_payload: typeof it.raw_payload === 'string' ? JSON.parse(it.raw_payload) : it.raw_payload
          }))
        },
        null,
        2
      )
    )
  } finally {
    await conn.end()
  }
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
