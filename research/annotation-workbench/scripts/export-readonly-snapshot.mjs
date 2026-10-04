#!/usr/bin/env node
/**
 * Read-only audit snapshot for 1.4 Annotation Workbench.
 * Does NOT freeze the benchmark fixture. Does NOT mutate the database.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../..')

function loadEnv() {
  const envPath = path.join(root, '.env')
  const text = fs.readFileSync(envPath, 'utf8')
  return Object.fromEntries(
    text
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
}

const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE|CALL|LOAD\s+DATA)\b/i

async function q(conn, sql, params = []) {
  if (FORBIDDEN.test(sql)) throw new Error(`BLOCKED non-read SQL: ${sql.slice(0, 80)}`)
  return conn.query(sql, params)
}

async function main() {
  console.log('PGWhite annotation workbench — RESEARCH ONLY — ZERO DATABASE MUTATION')
  const env = loadEnv()
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: +env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  })

  const dim = async (code) => {
    const [rows] = await q(
      conn,
      `
      SELECT t.id,
        MAX(CASE WHEN tt.language_code='zh' THEN tt.tag_name END) zh,
        MAX(CASE WHEN tt.language_code='en' THEN tt.tag_name END) en,
        (SELECT COUNT(*) FROM quote_tags qt WHERE qt.tag_id=t.id) assignments
      FROM tags t
      LEFT JOIN tag_translations tt ON tt.tag_id=t.id
      WHERE t.source_code=?
      GROUP BY t.id
      ORDER BY assignments DESC, t.id
    `,
      [code]
    )
    return rows
  }

  const themes = await dim(2)
  const devices = await dim(3)
  const [[pa]] = await q(conn, `SELECT COUNT(*) n FROM personal_annotations`)
  const [[tagged]] = await q(
    conn,
    `
    SELECT COUNT(DISTINCT q.id) tagged,
      COUNT(DISTINCT CASE WHEN qt.language_code='zh' THEN q.id END) tagged_zh
    FROM quotes q
    JOIN quote_tags tg ON tg.quote_id=q.id
    LEFT JOIN quote_translations qt ON qt.quote_id=q.id
  `
  )
  const [[reviews]] = await q(
    conn,
    `
    SELECT COUNT(*) n FROM import_items
    WHERE import_id=3
      AND JSON_UNQUOTE(JSON_EXTRACT(raw_payload,'$.kind'))='weread_review'
  `
  )
  const [[personal]] = await q(
    conn,
    `SELECT SUM(corpus_layer='personal') personal, SUM(corpus_layer='community') community FROM quotes`
  )

  const snapshot = {
    exportedAt: new Date().toISOString(),
    note: 'Read-only snapshot. Fixture NOT finalized. See docs/research/1.4-ai-annotation-audit.md',
    themes,
    devices,
    personal_annotations_count: pa.n,
    import3_review_items: reviews.n,
    tagged_quotes: tagged.tagged,
    tagged_quotes_zh: tagged.tagged_zh,
    corpus: personal
  }

  const outDir = path.join(root, 'research/annotation-workbench/fixtures')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'audit-snapshot.json')
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2))
  console.log('Wrote', outPath)
  console.log(
    JSON.stringify(
      {
        themes: themes.length,
        devices: devices.length,
        personal_annotations: pa.n,
        import3_reviews: reviews.n,
        tagged_zh: tagged.tagged_zh
      },
      null,
      2
    )
  )
  await conn.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
