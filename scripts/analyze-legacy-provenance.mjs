#!/usr/bin/env node
/**
 * READ-ONLY provenance reconstruction for production quotes.
 * Writes analysis/legacy-provenance-reconstruction.json
 * Does not mutate the database.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'analysis')
const OUT_JSON = resolve(OUT_DIR, 'legacy-provenance-reconstruction.json')
const OUT_SUMMARY = resolve(OUT_DIR, 'legacy-provenance-summary.md')
const OUT_SLUG_MAP = resolve(OUT_DIR, 'legacy-slug-to-mysql-map.json')

function loadEnv() {
  const p = resolve(ROOT, '.env')
  if (!existsSync(p)) return {}
  return Object.fromEntries(
    readFileSync(p, 'utf8')
      .split('\n')
      .filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(l => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
}

function hashContent(s) {
  return createHash('sha256').update(String(s), 'utf8').digest('hex').slice(0, 16)
}

function normalizeText(s) {
  return String(s)
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function unescapeMysqlString(body) {
  return body.replace(/''/g, "'").replace(/\\'/g, "'")
}

/**
 * Parse INSERT pairs: quotes(id, book_id) + quote_translations content (any language).
 * Handles MySQL '' escaping. Legacy corpus stores zh and en as separate quote rows.
 */
function parseQuoteInserts(sql) {
  const byId = new Map()
  const quoteRe =
    /INSERT INTO quotes \(id, book_id\) VALUES \((\d+),\s*(\d+)\);/g
  let m
  while ((m = quoteRe.exec(sql))) {
    byId.set(Number(m[1]), {
      quote_id: Number(m[1]),
      book_id: Number(m[2]),
      language_code: null,
      content: null
    })
  }
  const startRe =
    /INSERT INTO quote_translations \(quote_id, language_code, content\) VALUES \((\d+),\s*'(zh|en)',\s*'/g
  while ((m = startRe.exec(sql))) {
    const id = Number(m[1])
    const language_code = m[2]
    let i = m.index + m[0].length
    let body = ''
    while (i < sql.length) {
      const ch = sql[i]
      if (ch === "'" && sql[i + 1] === "'") {
        body += "''"
        i += 2
        continue
      }
      if (ch === "'") break
      body += ch
      i++
    }
    const content = unescapeMysqlString(body)
    const row = byId.get(id)
    if (row) {
      row.language_code = language_code
      row.content = content
    } else {
      byId.set(id, {
        quote_id: id,
        book_id: null,
        language_code,
        content
      })
    }
  }
  return byId
}

function parseWereadMeta(sql) {
  const books = []
  const lines = sql.split('\n')
  for (const line of lines) {
    const pick = line.match(
      /-- pick #(\d+) · weread bookId=(\d+) · (.+?) · (\d+) 条划线/
    )
    if (pick) {
      books.push({
        pick: Number(pick[1]),
        weread_book_id: pick[2],
        title_zh: pick[3],
        highlight_count_claimed: Number(pick[4])
      })
    }
    const reuse = line.match(/-- 复用已有作者 id=(\d+)/)
    if (reuse && books.length) {
      books[books.length - 1].reuse_author_id = Number(reuse[1])
    }
  }
  // Header metadata
  const header = {
    batch_line: null,
    selection_line: null,
    content_scope_line: null,
    start_quote_note: null
  }
  for (const line of lines.slice(0, 30)) {
    if (line.includes('批次:')) header.batch_line = line.slice(3).trim()
    if (line.includes('本次选择')) header.selection_line = line.slice(3).trim()
    if (line.includes('内容范围')) header.content_scope_line = line.slice(3).trim()
    if (line.includes('START_QUOTE') || line.includes('MAX(quotes.id)')) {
      header.start_quote_note = line.slice(3).trim()
    }
  }
  return { header, books }
}

async function main() {
  const env = loadEnv()
  const testingPath = resolve(ROOT, 'pgwhite_testing_data.sql')
  const wereadPath = resolve(ROOT, 'pgwhite_weread_import.sql')
  const sentencesPath = resolve(ROOT, 'data/sentences.json')

  if (!existsSync(testingPath)) throw new Error('missing pgwhite_testing_data.sql')
  if (!existsSync(wereadPath)) throw new Error('missing pgwhite_weread_import.sql')

  const testingSql = readFileSync(testingPath, 'utf8')
  const wereadSql = readFileSync(wereadPath, 'utf8')
  const sentences = JSON.parse(readFileSync(sentencesPath, 'utf8'))

  const testingMap = parseQuoteInserts(testingSql)
  const wereadMap = parseQuoteInserts(wereadSql)
  const wereadMeta = parseWereadMeta(wereadSql)

  const jsonByNorm = new Map()
  for (const s of sentences) {
    const norm = normalizeText(s.text)
    if (!jsonByNorm.has(norm)) jsonByNorm.set(norm, [])
    jsonByNorm.get(norm).push({
      slug: s.id,
      language: s.language,
      bookId: s.bookId,
      authorId: s.authorId
    })
  }

  const idMapNotes = []
  for (const line of testingSql.split('\n')) {
    if (line.startsWith('-- author ') || line.startsWith('-- book ')) {
      idMapNotes.push(line.slice(3).trim())
    }
  }

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl:
      String(env.DB_HOST || '').includes('rlwy.net') ||
      String(env.DB_HOST || '').includes('railway')
        ? { rejectUnauthorized: false }
        : undefined,
    connectTimeout: 30_000
  })

  let production
  let proofCounts
  let schemaMigrations
  try {
    const [rows] = await conn.query(`
      SELECT
        q.id AS quote_id,
        q.book_id,
        b.author_id,
        qt.language_code AS content_language,
        qt.content AS content,
        bt.title AS book_title_zh,
        at.name AS author_name_zh
      FROM quotes q
      LEFT JOIN quote_translations qt ON qt.quote_id = q.id
      LEFT JOIN books b ON b.id = q.book_id
      LEFT JOIN book_translations bt
        ON bt.book_id = b.id AND bt.language_code = 'zh'
      LEFT JOIN authors a ON a.id = b.author_id
      LEFT JOIN author_translations at
        ON at.author_id = a.id AND at.language_code = 'zh'
      ORDER BY q.id, qt.language_code
    `)
    const byQuote = new Map()
    for (const r of rows) {
      const id = Number(r.quote_id)
      const prev = byQuote.get(id)
      if (!prev) {
        byQuote.set(id, r)
        continue
      }
      if (prev.content_language !== 'zh' && r.content_language === 'zh') {
        byQuote.set(id, r)
      }
    }
    production = [...byQuote.values()].sort(
      (a, b) => Number(a.quote_id) - Number(b.quote_id)
    )

    const [[c]] = await conn.query(`
      SELECT
        (SELECT COUNT(*) FROM quotes) AS quotes,
        (SELECT COUNT(*) FROM quote_translations) AS quote_translations,
        (SELECT COUNT(*) FROM imports) AS imports,
        (SELECT COUNT(*) FROM import_items) AS import_items,
        (SELECT COUNT(*) FROM library_entries) AS library_entries,
        (SELECT COUNT(*) FROM quote_tags) AS quote_tags,
        (SELECT COUNT(*) FROM users) AS users
    `)
    proofCounts = c
    const [migs] = await conn.query(
      'SELECT version FROM schema_migrations ORDER BY version'
    )
    schemaMigrations = migs.map(r => r.version)
  } finally {
    await conn.end()
  }

  const classifications = []
  const conflicts = []

  for (const row of production) {
    const id = Number(row.quote_id)
    const content = row.content == null ? null : String(row.content)
    const content_language = row.content_language || null
    const norm = content == null ? null : normalizeText(content)
    const content_hash = content == null ? null : hashContent(content)

    const inTesting = testingMap.has(id)
    const inWeread = wereadMap.has(id)
    const testingRow = inTesting ? testingMap.get(id) : null
    const wereadRow = inWeread ? wereadMap.get(id) : null
    const testingContent = testingRow?.content ?? null
    const wereadContent = wereadRow?.content ?? null

    const matchTesting =
      inTesting &&
      testingContent != null &&
      content != null &&
      normalizeText(testingContent) === norm
    const matchWeread =
      inWeread &&
      wereadContent != null &&
      content != null &&
      normalizeText(wereadContent) === norm

    const jsonHits = norm && jsonByNorm.has(norm) ? jsonByNorm.get(norm) : []

    let provenance_class = 'unknown'
    let confidence = 'LOW'
    const evidence = []

    if (matchWeread && !matchTesting) {
      provenance_class = 'weread_import'
      confidence = 'HIGH'
      evidence.push({
        type: 'exact_id_and_content_in_pgwhite_weread_import.sql',
        quote_id: id,
        file: 'pgwhite_weread_import.sql'
      })
    } else if (matchTesting && !matchWeread) {
      provenance_class = 'legacy_curated'
      confidence = 'HIGH'
      evidence.push({
        type: 'exact_id_and_content_in_pgwhite_testing_data.sql',
        quote_id: id,
        language_code: testingRow?.language_code || content_language,
        file: 'pgwhite_testing_data.sql'
      })
      if (jsonHits.length) {
        evidence.push({
          type: 'exact_content_match_data_sentences_json',
          slug_ids: jsonHits.map(h => h.slug),
          file: 'data/sentences.json'
        })
      }
    } else if (matchWeread && matchTesting) {
      provenance_class = 'unknown'
      confidence = 'LOW'
      conflicts.push({
        quote_id: id,
        issue: 'id_present_in_both_sql_files_with_matching_content'
      })
      evidence.push({
        type: 'conflict_both_sources',
        files: ['pgwhite_testing_data.sql', 'pgwhite_weread_import.sql']
      })
    } else if (inWeread && !matchWeread) {
      provenance_class = 'unknown'
      confidence = 'MEDIUM'
      evidence.push({
        type: 'id_in_weread_sql_but_content_mismatch_or_missing',
        file: 'pgwhite_weread_import.sql',
        prod_hash: content_hash,
        sql_hash: wereadContent ? hashContent(wereadContent) : null
      })
      conflicts.push({ quote_id: id, issue: 'weread_id_content_mismatch' })
    } else if (inTesting && !matchTesting) {
      provenance_class = 'unknown'
      confidence = 'MEDIUM'
      evidence.push({
        type: 'id_in_testing_sql_but_content_mismatch_or_missing',
        file: 'pgwhite_testing_data.sql',
        prod_language: content_language,
        sql_language: testingRow?.language_code || null
      })
      conflicts.push({ quote_id: id, issue: 'testing_id_content_mismatch' })
    } else if (jsonHits.length && !inWeread && !inTesting) {
      provenance_class = 'legacy_curated'
      confidence = 'MEDIUM'
      evidence.push({
        type: 'content_only_match_json_no_sql_id',
        slug_ids: jsonHits.map(h => h.slug)
      })
    } else {
      provenance_class = 'unknown'
      confidence = 'LOW'
      evidence.push({ type: 'no_matching_source_file_row' })
    }

    if (id >= 119 && id <= 1287 && provenance_class === 'weread_import') {
      evidence.push({ type: 'id_in_documented_weread_range_119_1287' })
    }
    if (id >= 1 && id <= 118 && provenance_class === 'legacy_curated') {
      evidence.push({ type: 'id_in_documented_testing_range_1_118' })
    }

    classifications.push({
      quote_id: id,
      book_id: row.book_id == null ? null : Number(row.book_id),
      author_id: row.author_id == null ? null : Number(row.author_id),
      book_title_zh: row.book_title_zh || null,
      author_name_zh: row.author_name_zh || null,
      content_language,
      content_hash,
      content_preview: content ? content.slice(0, 80) : null,
      provenance_class,
      confidence,
      evidence,
      historical_source_reference:
        provenance_class === 'weread_import'
          ? 'pgwhite_weread_import.sql'
          : provenance_class === 'legacy_curated'
            ? 'pgwhite_testing_data.sql (+ data/sentences.json)'
            : null,
      legacy_json_slug_ids: jsonHits.map(h => h.slug)
    })
  }

  const agg = {
    weread_import: { total: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    legacy_curated: { total: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    other_known: { total: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    unknown: { total: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  }
  for (const c of classifications) {
    agg[c.provenance_class].total++
    agg[c.provenance_class][c.confidence]++
  }

  const prodById = new Map(production.map(r => [Number(r.quote_id), r]))
  let wereadInProdExact = 0
  let wereadInProdIdOnly = 0
  let wereadMissingFromProd = 0
  const wereadMissingIds = []
  for (const [id, w] of wereadMap) {
    const p = prodById.get(id)
    if (!p) {
      wereadMissingFromProd++
      wereadMissingIds.push(id)
      continue
    }
    wereadInProdIdOnly++
    if (
      p.content &&
      w.content &&
      normalizeText(p.content) === normalizeText(w.content)
    ) {
      wereadInProdExact++
    }
  }

  const prodIds = new Set(production.map(r => Number(r.quote_id)))
  const prodNotInWereadOrTesting = production
    .map(r => Number(r.quote_id))
    .filter(id => !wereadMap.has(id) && !testingMap.has(id))

  let testingExact = 0
  for (const [id, t] of testingMap) {
    const p = prodById.get(id)
    if (
      p?.content &&
      t.content &&
      normalizeText(p.content) === normalizeText(t.content)
    ) {
      testingExact++
    }
  }

  const dupMap = new Map()
  for (const row of production) {
    if (row.content == null) continue
    const n = normalizeText(row.content)
    if (!dupMap.has(n)) dupMap.set(n, [])
    dupMap.get(n).push(Number(row.quote_id))
  }
  const duplicateGroups = [...dupMap.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([text, ids]) => {
      const members = ids.map(qid => classifications.find(c => c.quote_id === qid))
      return {
        size: ids.length,
        quote_ids: ids,
        content_preview: text.slice(0, 120),
        content_hash: hashContent(text),
        provenances: members.map(m => ({
          quote_id: m.quote_id,
          provenance_class: m.provenance_class,
          confidence: m.confidence,
          book_id: m.book_id,
          book_title_zh: m.book_title_zh,
          content_language: m.content_language
        }))
      }
    })
    .sort((a, b) => b.size - a.size || a.quote_ids[0] - b.quote_ids[0])

  // Slug → MySQL mapping via exact content (all languages)
  let jsonTestingAlign = 0
  let jsonTestingMisalign = 0
  const slugToMysql = []
  for (const s of sentences) {
    const norm = normalizeText(s.text)
    let mysqlId = null
    let mysqlLang = null
    for (const [id, t] of testingMap) {
      if (t.content && normalizeText(t.content) === norm) {
        mysqlId = id
        mysqlLang = t.language_code
        break
      }
    }
    if (mysqlId != null) {
      jsonTestingAlign++
      slugToMysql.push({
        slug: s.id,
        language: s.language,
        book_slug: s.bookId,
        author_slug: s.authorId,
        mysql_quote_id: mysqlId,
        mysql_language_code: mysqlLang
      })
    } else {
      jsonTestingMisalign++
    }
  }

  // Cross-book content duplicates between WeRead and legacy (if any)
  const crossProvenanceDups = duplicateGroups.filter(g => {
    const classes = new Set(g.provenances.map(p => p.provenance_class))
    return classes.size > 1
  })

  // WeRead books/authors from production for ids 119-1287
  const wereadProd = classifications.filter(c => c.provenance_class === 'weread_import')
  const wereadBooks = new Map()
  const wereadAuthors = new Map()
  for (const c of wereadProd) {
    if (c.book_id != null) {
      wereadBooks.set(c.book_id, {
        book_id: c.book_id,
        title_zh: c.book_title_zh,
        count: (wereadBooks.get(c.book_id)?.count || 0) + 1
      })
    }
    if (c.author_id != null) {
      wereadAuthors.set(c.author_id, {
        author_id: c.author_id,
        name_zh: c.author_name_zh,
        count: (wereadAuthors.get(c.author_id)?.count || 0) + 1
      })
    }
  }

  const legacyProd = classifications.filter(c => c.provenance_class === 'legacy_curated')
  const legacyByLang = { zh: 0, en: 0, other: 0 }
  for (const c of legacyProd) {
    if (c.content_language === 'zh') legacyByLang.zh++
    else if (c.content_language === 'en') legacyByLang.en++
    else legacyByLang.other++
  }

  const artifact = {
    generated_at: new Date().toISOString(),
    purpose: 'READ-ONLY provenance reconstruction for PM/R&D (not runtime)',
    production_quote_count: production.length,
    post_cleanup_counts: proofCounts,
    schema_migrations: schemaMigrations,
    aggregate: agg,
    sources: {
      testing_sql_quotes: testingMap.size,
      testing_sql_zh: [...testingMap.values()].filter(r => r.language_code === 'zh').length,
      testing_sql_en: [...testingMap.values()].filter(r => r.language_code === 'en').length,
      weread_sql_quotes: wereadMap.size,
      sentences_json_total: sentences.length,
      sentences_json_zh: sentences.filter(s => s.language === 'zh').length,
      sentences_json_en: sentences.filter(s => s.language === 'en').length,
      testing_id_map_notes: idMapNotes,
      weread_sql_header: wereadMeta.header,
      weread_book_meta_from_comments: wereadMeta.books
    },
    weread_coverage: {
      sql_quote_count: wereadMap.size,
      sql_id_min: Math.min(...wereadMap.keys()),
      sql_id_max: Math.max(...wereadMap.keys()),
      exact_content_match_in_production: wereadInProdExact,
      id_present_in_production: wereadInProdIdOnly,
      missing_from_production: wereadMissingFromProd,
      missing_ids_sample: wereadMissingIds.slice(0, 20),
      production_ids_not_in_weread_or_testing: prodNotInWereadOrTesting,
      production_books: [...wereadBooks.values()].sort((a, b) => a.book_id - b.book_id),
      production_authors: [...wereadAuthors.values()].sort(
        (a, b) => a.author_id - b.author_id
      )
    },
    legacy_coverage: {
      testing_sql_quotes: testingMap.size,
      testing_exact_content_match_in_production: testingExact,
      sql_id_min: Math.min(...testingMap.keys()),
      sql_id_max: Math.max(...testingMap.keys()),
      classified_legacy_curated: legacyProd.length,
      classified_by_language: legacyByLang,
      json_sentences_total: sentences.length,
      json_content_aligned_to_testing_sql: jsonTestingAlign,
      json_content_not_in_testing_sql: jsonTestingMisalign,
      slug_to_mysql_count: slugToMysql.length
    },
    duplicates: {
      group_count: duplicateGroups.length,
      quotes_involved: duplicateGroups.reduce((n, g) => n + g.size, 0),
      cross_provenance_group_count: crossProvenanceDups.length,
      groups: duplicateGroups
    },
    conflicts,
    quotes: classifications
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_JSON, JSON.stringify(artifact, null, 2), 'utf8')
  writeFileSync(
    OUT_SLUG_MAP,
    JSON.stringify(
      {
        generated_at: artifact.generated_at,
        note: 'Deterministic content-based mapping: data/sentences.json slug → MySQL quote id',
        mappings: slugToMysql
      },
      null,
      2
    ),
    'utf8'
  )

  const summary = `# Legacy provenance reconstruction summary

Generated: ${artifact.generated_at}

Production quotes: **${production.length}**

| Provenance | Count | High | Medium | Low |
|------------|------:|-----:|-------:|----:|
| WeRead Import | ${agg.weread_import.total} | ${agg.weread_import.HIGH} | ${agg.weread_import.MEDIUM} | ${agg.weread_import.LOW} |
| Legacy curated | ${agg.legacy_curated.total} | ${agg.legacy_curated.HIGH} | ${agg.legacy_curated.MEDIUM} | ${agg.legacy_curated.LOW} |
| Other known | ${agg.other_known.total} | ${agg.other_known.HIGH} | ${agg.other_known.MEDIUM} | ${agg.other_known.LOW} |
| Unknown | ${agg.unknown.total} | ${agg.unknown.HIGH} | ${agg.unknown.MEDIUM} | ${agg.unknown.LOW} |
| **TOTAL** | **${production.length}** | | | |

Post-cleanup: quotes=${proofCounts.quotes} imports=${proofCounts.imports} import_items=${proofCounts.import_items} library_entries=${proofCounts.library_entries} quote_tags=${proofCounts.quote_tags}
schema_migrations: ${schemaMigrations.join(', ')}

WeRead SQL rows: ${wereadMap.size} (ids ${artifact.weread_coverage.sql_id_min}–${artifact.weread_coverage.sql_id_max}); exact match: ${wereadInProdExact}
Testing SQL rows: ${testingMap.size} (ids ${artifact.legacy_coverage.sql_id_min}–${artifact.legacy_coverage.sql_id_max}); exact match: ${testingExact}
JSON↔SQL slug alignments: ${jsonTestingAlign}/${sentences.length}
Duplicate content groups: ${duplicateGroups.length}

Artifacts:
- \`analysis/legacy-provenance-reconstruction.json\`
- \`analysis/legacy-slug-to-mysql-map.json\`
`
  writeFileSync(OUT_SUMMARY, summary, 'utf8')

  console.log(summary)
  console.log(
    JSON.stringify(
      {
        total: production.length,
        aggregate: agg,
        weread_exact: wereadInProdExact,
        testing_exact: testingExact,
        dup_groups: duplicateGroups.length,
        conflicts: conflicts.length,
        slug_map: slugToMysql.length,
        prod_not_in_sources: prodNotInWereadOrTesting.length,
        proofCounts,
        schemaMigrations
      },
      null,
      2
    )
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
