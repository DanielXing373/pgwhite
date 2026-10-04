#!/usr/bin/env node
/**
 * READ-ONLY export of Annotation Workbench fixture v1 (~103 Quotes).
 *
 * - Reconstructs Import #3 annotations from import_items.raw_payload (no backfill)
 * - Selects 40 ZH legacy human-tagged (excludes EN-only twins)
 * - Selects 50 cold-start Personal Quotes
 * - Also writes taxonomy snapshot (Theme 时间 excluded from reconcile targets)
 *
 * ZERO DATABASE MUTATION.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const FIXTURE_VERSION = 'annotation-bench-v1.1'
const TAXONOMY_VERSION = 'taxonomy-theme-device-v1-excl-time'
const OUT_FIXTURE = path.resolve(__dirname, '../fixtures/benchmark.v1.json')
const OUT_TAX = path.resolve(__dirname, '../fixtures/taxonomy.v1.json')

const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE|CALL|LOAD\s+DATA)\b/i

function loadEnv() {
  const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
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

async function q(conn, sql, params = []) {
  if (FORBIDDEN.test(sql)) throw new Error(`BLOCKED non-read SQL: ${sql.slice(0, 80)}`)
  return conn.query(sql, params)
}

function lengthBucket(len) {
  if (len < 40) return 'short'
  if (len <= 120) return 'medium'
  return 'long'
}

function dialogueIsh(text) {
  return /[「」『』""]/.test(text)
}

function stableHash(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16)
}

function pickRoundRobin(groups, target, used) {
  const keys = [...groups.keys()].sort()
  const queues = new Map(keys.map((k) => [k, [...groups.get(k)].sort((a, b) => a.quoteId - b.quoteId)]))
  const out = []
  let guard = 0
  while (out.length < target && guard < 10000) {
    guard++
    let progressed = false
    for (const k of keys) {
      const queue = queues.get(k)
      while (queue.length) {
        const next = queue.shift()
        if (used.has(next.quoteId)) continue
        out.push(next)
        used.add(next.quoteId)
        progressed = true
        break
      }
      if (out.length >= target) break
    }
    if (!progressed) break
  }
  return out
}

async function loadLegacyZhTagged(conn) {
  const [fixed] = await q(
    conn,
    `
    SELECT q.id AS quoteId, q.book_id AS bookId, bt.title AS bookTitleZh,
      at.name AS authorNameZh, q.chapter_title AS chapterTitle,
      qt.content AS textZh, CHAR_LENGTH(qt.content) AS charLen
    FROM quotes q
    JOIN quote_translations qt ON qt.quote_id = q.id AND qt.language_code = 'zh'
    JOIN books b ON b.id = q.book_id
    LEFT JOIN book_translations bt ON bt.book_id = b.id AND bt.language_code = 'zh'
    LEFT JOIN author_translations at ON at.author_id = b.author_id AND at.language_code = 'zh'
    WHERE q.corpus_layer = 'community'
      AND EXISTS (SELECT 1 FROM quote_tags tg WHERE tg.quote_id = q.id)
    ORDER BY q.id
  `
  )

  const withTags = []
  for (const r of fixed) {
    const [tags] = await q(
      conn,
      `
      SELECT t.id, t.source_code AS sourceCode, tt.tag_name AS zh
      FROM quote_tags qtg
      JOIN tags t ON t.id = qtg.tag_id
      JOIN tag_translations tt ON tt.tag_id = t.id AND tt.language_code = 'zh'
      WHERE qtg.quote_id = ?
      ORDER BY t.source_code, t.id
    `,
      [r.quoteId]
    )
    withTags.push({
      quoteId: r.quoteId,
      bookId: r.bookId,
      bookTitleZh: r.bookTitleZh || `book#${r.bookId}`,
      authorNameZh: r.authorNameZh || null,
      chapterTitle: r.chapterTitle || null,
      textZh: r.textZh,
      charLen: r.charLen,
      lengthBucket: lengthBucket(r.charLen),
      dialogueIsh: dialogueIsh(r.textZh),
      legacyTags: tags.map((t) => ({
        id: t.id,
        dimension:
          t.sourceCode === 2 ? 'theme' : t.sourceCode === 3 ? 'device' : 'scene_time',
        zh: t.zh
      })),
      legacyTagIds: tags.map((t) => t.id),
      hasTheme: tags.some((t) => t.sourceCode === 2),
      hasDevice: tags.some((t) => t.sourceCode === 3)
    })
  }
  return withTags
}

function selectLegacy40(pool) {
  // Keep all non-dominant-book quotes; fill remainder from 撒旦探戈 (book 4) via strata.
  const TARGET = 40
  const used = new Set()
  const keepAll = pool.filter((q) => q.bookId !== 4)
  const satan = pool.filter((q) => q.bookId === 4)
  const selected = []

  for (const q of keepAll.sort((a, b) => a.quoteId - b.quoteId)) {
    selected.push(q)
    used.add(q.quoteId)
  }

  const need = TARGET - selected.length
  const strata = new Map()
  for (const q of satan) {
    const key = [
      q.lengthBucket,
      q.hasTheme ? 'theme' : 'no_theme',
      q.hasDevice ? 'device' : 'no_device',
      q.dialogueIsh ? 'dlg' : 'nar'
    ].join('|')
    const arr = strata.get(key) || []
    arr.push(q)
    strata.set(key, arr)
  }
  const picked = pickRoundRobin(strata, need, used)
  selected.push(...picked)

  // If still short (shouldn't happen), fill by ascending quote_id from satan.
  if (selected.length < TARGET) {
    for (const q of satan.sort((a, b) => a.quoteId - b.quoteId)) {
      if (used.has(q.quoteId)) continue
      selected.push(q)
      used.add(q.quoteId)
      if (selected.length >= TARGET) break
    }
  }

  return selected
    .sort((a, b) => a.quoteId - b.quoteId)
    .slice(0, TARGET)
    .map((q) => ({
      quoteId: q.quoteId,
      group: 'legacy_human_tagged',
      bookId: q.bookId,
      bookTitleZh: q.bookTitleZh,
      authorNameZh: q.authorNameZh,
      chapterTitle: q.chapterTitle,
      textZh: q.textZh,
      productionQuoteTextZh: q.textZh,
      lengthBucket: q.lengthBucket,
      charLen: q.charLen,
      dialogueIsh: q.dialogueIsh,
      legacyTagIds: q.legacyTagIds,
      legacyTags: q.legacyTags,
      personalAnnotation: null,
      notes:
        'Weak human reference tags only — NOT ground truth. EN-only twins excluded from pool.'
    }))
}

async function loadAnnotationRelevant(conn) {
  const [rows] = await q(
    conn,
    `
    SELECT ii.id AS importItemId, ii.external_id AS externalId,
      ii.library_entry_id AS libraryEntryId, le.quote_id AS quoteId,
      CAST(ii.raw_payload AS CHAR) AS payload,
      q.book_id AS bookId, bt.title AS bookTitleZh, at.name AS authorNameZh,
      q.chapter_title AS chapterTitle,
      qt.content AS productionQuoteTextZh
    FROM import_items ii
    JOIN library_entries le ON le.id = ii.library_entry_id
    JOIN quotes q ON q.id = le.quote_id
    JOIN books b ON b.id = q.book_id
    LEFT JOIN book_translations bt ON bt.book_id = b.id AND bt.language_code = 'zh'
    LEFT JOIN author_translations at ON at.author_id = b.author_id AND at.language_code = 'zh'
    LEFT JOIN quote_translations qt ON qt.quote_id = q.id AND qt.language_code = 'zh'
    WHERE ii.import_id = 3
      AND JSON_UNQUOTE(JSON_EXTRACT(ii.raw_payload, '$.kind')) = 'weread_review'
    ORDER BY ii.id
  `
  )

  const mapped = rows.map((r) => {
    const j = JSON.parse(r.payload)
    const item = j.item || {}
    const annContent = String(item.content || '').trim()
    const abstract = String(item.abstract || '').trim()
    const assocKey = j.associatedBookmarkKey
    const matched = assocKey != null && assocKey !== '' && assocKey !== 'null'
    const association = matched ? 'matched_highlight' : 'orphan_review_quote'

    // Research reconstruction: prefer literary mark text for free concepts.
    // Orphans: production Quote text IS the annotation (1.2 debt) — use abstract when present.
    let textZh
    let literarySource
    if (matched) {
      textZh = r.productionQuoteTextZh
      literarySource = 'production_quote_zh'
    } else if (abstract) {
      textZh = abstract
      literarySource = 'import_item_abstract'
    } else {
      // Invalid Quote+Annotation benchmark case (e.g. quote 1399). Exclude below.
      textZh = r.productionQuoteTextZh || annContent
      literarySource = 'orphan_quote_equals_annotation'
    }

    return {
      quoteId: r.quoteId,
      group: 'annotation_relevant',
      bookId: r.bookId,
      bookTitleZh: r.bookTitleZh || `book#${r.bookId}`,
      authorNameZh: r.authorNameZh || null,
      chapterTitle: r.chapterTitle || null,
      textZh,
      productionQuoteTextZh: r.productionQuoteTextZh,
      literarySource,
      lengthBucket: lengthBucket([...textZh].length),
      charLen: [...textZh].length,
      dialogueIsh: dialogueIsh(textZh),
      legacyTagIds: [],
      legacyTags: [],
      personalAnnotation: {
        content: annContent,
        source: matched ? 'import_item_review_matched' : 'import_item_review_orphan',
        importItemId: r.importItemId,
        externalId: r.externalId,
        libraryEntryId: r.libraryEntryId,
        association,
        // Deterministic provenance owned by fixture/input layer — not LLM echo.
        originalContent: annContent
      },
      notes:
        'Research-time reconstruction from import_items.raw_payload. No personal_annotations backfill. Production records untouched.'
    }
  })

  // Exclude historical 1.2 orphan debt where annotation itself is the only literary text.
  // Production quote rows are NOT deleted/modified.
  const excluded = mapped.filter((q) => q.literarySource === 'orphan_quote_equals_annotation')
  const kept = mapped.filter((q) => q.literarySource !== 'orphan_quote_equals_annotation')
  return { kept, excluded }
}

async function loadColdStart50(conn, excludeQuoteIds) {
  const exclude = [...excludeQuoteIds]
  const placeholders = exclude.map(() => '?').join(',') || 'NULL'

  // Prefer Import #3 bookmarks without a review item on the same library entry.
  const [imp3] = await q(
    conn,
    `
    SELECT q.id AS quoteId, q.book_id AS bookId, bt.title AS bookTitleZh,
      at.name AS authorNameZh, q.chapter_title AS chapterTitle,
      qt.content AS textZh, CHAR_LENGTH(qt.content) AS charLen,
      le.import_id AS importId
    FROM library_entries le
    JOIN import_items ii ON ii.library_entry_id = le.id
      AND JSON_UNQUOTE(JSON_EXTRACT(ii.raw_payload, '$.kind')) = 'weread_bookmark'
    JOIN quotes q ON q.id = le.quote_id
    JOIN books b ON b.id = q.book_id
    JOIN quote_translations qt ON qt.quote_id = q.id AND qt.language_code = 'zh'
    LEFT JOIN book_translations bt ON bt.book_id = b.id AND bt.language_code = 'zh'
    LEFT JOIN author_translations at ON at.author_id = b.author_id AND at.language_code = 'zh'
    WHERE le.import_id = 3
      AND q.corpus_layer = 'personal'
      AND NOT EXISTS (SELECT 1 FROM quote_tags tg WHERE tg.quote_id = q.id)
      AND NOT EXISTS (
        SELECT 1 FROM import_items r
        WHERE r.library_entry_id = le.id
          AND JSON_UNQUOTE(JSON_EXTRACT(r.raw_payload, '$.kind')) = 'weread_review'
      )
      AND q.id NOT IN (${placeholders})
      AND CHAR_LENGTH(qt.content) >= 8
    ORDER BY q.id
  `,
    exclude
  )

  const [imp2] = await q(
    conn,
    `
    SELECT q.id AS quoteId, q.book_id AS bookId, bt.title AS bookTitleZh,
      at.name AS authorNameZh, q.chapter_title AS chapterTitle,
      qt.content AS textZh, CHAR_LENGTH(qt.content) AS charLen,
      le.import_id AS importId
    FROM library_entries le
    JOIN quotes q ON q.id = le.quote_id
    JOIN books b ON b.id = q.book_id
    JOIN quote_translations qt ON qt.quote_id = q.id AND qt.language_code = 'zh'
    LEFT JOIN book_translations bt ON bt.book_id = b.id AND bt.language_code = 'zh'
    LEFT JOIN author_translations at ON at.author_id = b.author_id AND at.language_code = 'zh'
    WHERE le.import_id = 2
      AND q.corpus_layer = 'personal'
      AND NOT EXISTS (SELECT 1 FROM quote_tags tg WHERE tg.quote_id = q.id)
      AND q.id NOT IN (${placeholders})
      AND CHAR_LENGTH(qt.content) >= 8
    ORDER BY q.id
  `,
    exclude
  )

  const normalize = (r) => ({
    quoteId: r.quoteId,
    bookId: r.bookId,
    bookTitleZh: r.bookTitleZh || `book#${r.bookId}`,
    authorNameZh: r.authorNameZh || null,
    chapterTitle: r.chapterTitle || null,
    textZh: r.textZh,
    productionQuoteTextZh: r.textZh,
    lengthBucket: lengthBucket(r.charLen),
    charLen: r.charLen,
    dialogueIsh: dialogueIsh(r.textZh),
    importId: r.importId
  })

  const poolImp3 = imp3.map(normalize)
  const poolImp2 = imp2.map(normalize)
  const used = new Set(exclude)
  const TARGET = 50
  const selected = []

  // From Import #3: stratified by book × length × dialogue (cap ~30)
  const imp3Strata = new Map()
  for (const q of poolImp3) {
    const key = `${q.bookId}|${q.lengthBucket}|${q.dialogueIsh ? 'dlg' : 'nar'}`
    const arr = imp3Strata.get(key) || []
    arr.push(q)
    imp3Strata.set(key, arr)
  }
  selected.push(...pickRoundRobin(imp3Strata, 30, used))

  // Fill remaining from Import #2 for long + broader book diversity
  const need = TARGET - selected.length
  const imp2Strata = new Map()
  for (const q of poolImp2) {
    if (used.has(q.quoteId)) continue
    const key = `${q.lengthBucket}|${q.dialogueIsh ? 'dlg' : 'nar'}|${q.bookId}`
    const arr = imp2Strata.get(key) || []
    arr.push(q)
    imp2Strata.set(key, arr)
  }
  // Prefer long first for Imp2 fill
  const longFirst = new Map()
  for (const [k, arr] of [...imp2Strata.entries()].sort((a, b) => {
    const la = a[0].startsWith('long') ? 0 : a[0].startsWith('medium') ? 1 : 2
    const lb = b[0].startsWith('long') ? 0 : b[0].startsWith('medium') ? 1 : 2
    return la - lb || a[0].localeCompare(b[0])
  })) {
    longFirst.set(k, arr)
  }
  selected.push(...pickRoundRobin(longFirst, need, used))

  if (selected.length < TARGET) {
    for (const q of [...poolImp3, ...poolImp2].sort((a, b) => a.quoteId - b.quoteId)) {
      if (used.has(q.quoteId)) continue
      selected.push(q)
      used.add(q.quoteId)
      if (selected.length >= TARGET) break
    }
  }

  return selected
    .sort((a, b) => a.quoteId - b.quoteId)
    .slice(0, TARGET)
    .map((q) => ({
      quoteId: q.quoteId,
      group: 'cold_start',
      bookId: q.bookId,
      bookTitleZh: q.bookTitleZh,
      authorNameZh: q.authorNameZh,
      chapterTitle: q.chapterTitle,
      textZh: q.textZh,
      productionQuoteTextZh: q.textZh,
      lengthBucket: q.lengthBucket,
      charLen: q.charLen,
      dialogueIsh: q.dialogueIsh,
      legacyTagIds: [],
      legacyTags: [],
      personalAnnotation: null,
      importId: q.importId,
      notes: 'No useful tag/annotation context. Cold-start free→reconcile.'
    }))
}

async function loadTaxonomy(conn) {
  const [rows] = await q(
    conn,
    `
    SELECT t.id, t.source_code AS sourceCode, t.emoji,
      MAX(CASE WHEN tt.language_code='zh' THEN tt.tag_name END) zh,
      MAX(CASE WHEN tt.language_code='en' THEN tt.tag_name END) en,
      (SELECT COUNT(*) FROM quote_tags qt WHERE qt.tag_id = t.id) assignmentCount
    FROM tags t
    LEFT JOIN tag_translations tt ON tt.tag_id = t.id
    WHERE t.source_code IN (2, 3)
    GROUP BY t.id, t.source_code, t.emoji
    ORDER BY t.source_code, t.id
  `
  )

  const all = rows.map((r) => ({
    id: r.id,
    dimension: r.sourceCode === 2 ? 'theme' : 'device',
    zh: r.zh,
    en: r.en,
    emoji: r.emoji,
    assignmentCount: r.assignmentCount,
    sourceCode: r.sourceCode
  }))

  const excludedFromReconcile = all
    .filter((t) => t.dimension === 'theme' && t.zh === '时间')
    .map((t) => ({
      id: t.id,
      zh: t.zh,
      en: t.en,
      reason:
        'Semantic conflict with Scene/Time dimension under product reconsideration. Excluded from Workbench v1 Theme reconciliation targets. Production tag unmodified.'
    }))

  const excludedIds = new Set(excludedFromReconcile.map((t) => t.id))
  const reconcileTargets = all.filter((t) => !excludedIds.has(t.id))

  return {
    taxonomyVersion: TAXONOMY_VERSION,
    fixtureVersion: FIXTURE_VERSION,
    createdAt: new Date().toISOString(),
    activeDimensions: ['theme', 'device'],
    excludedDimensionsFromReconcile: ['scene_time'],
    exclusions: excludedFromReconcile,
    notes: [
      'Scene/Time tags (source_code=1) are never reconciliation candidates in Workbench v1.',
      'Theme 时间 (id=6) is present in production taxonomy but excluded from Workbench v1 reconcile targets.',
      'Do not assume 比喻→隐喻; inappropriate matches should remain New Personal Concepts.',
      'High Personal-Concept rate is not automatically a failure.'
    ],
    tags: all,
    reconcileTargets
  }
}

async function main() {
  console.log('PGWhite annotation workbench — RESEARCH ONLY — ZERO DATABASE MUTATION')
  console.log(`Exporting fixture ${FIXTURE_VERSION}`)

  const env = loadEnv()
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: +env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  })

  const taxonomy = await loadTaxonomy(conn)
  const legacyPool = await loadLegacyZhTagged(conn)
  if (legacyPool.length < 40) {
    throw new Error(`Expected ≥40 ZH tagged quotes, got ${legacyPool.length}`)
  }
  const legacy = selectLegacy40(legacyPool)
  const { kept: annotations, excluded: excludedAnnotations } =
    await loadAnnotationRelevant(conn)
  if (annotations.length !== 12) {
    throw new Error(
      `Expected 12 valid Import #3 annotation cases, got ${annotations.length} (excluded=${excludedAnnotations.map((q) => q.quoteId).join(',')})`
    )
  }
  if (!excludedAnnotations.some((q) => q.quoteId === 1399)) {
    throw new Error('Expected quote 1399 to be excluded as orphan_quote_equals_annotation')
  }

  const exclude = new Set([
    ...legacy.map((q) => q.quoteId),
    ...annotations.map((q) => q.quoteId),
    // Keep excluded orphans out of cold-start as well (invalid literary Quote cases).
    ...excludedAnnotations.map((q) => q.quoteId)
  ])
  const cold = await loadColdStart50(conn, exclude)
  if (cold.length !== 50) {
    throw new Error(`Expected 50 cold-start quotes, got ${cold.length}`)
  }

  const quotes = [...legacy, ...annotations, ...cold].sort((a, b) => a.quoteId - b.quoteId)
  const ids = quotes.map((q) => q.quoteId)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate quoteId across groups')
  }
  if (ids.includes(1399)) {
    throw new Error('quote 1399 must not appear in live benchmark fixture')
  }

  const selectionMethod = {
    legacy_human_tagged: {
      pool: 'community Quotes with zh translation AND quote_tags; EN-only twins excluded',
      poolSize: legacyPool.length,
      selected: legacy.length,
      algorithm:
        'Keep all ZH-tagged from books other than 撒旦探戈 (book 4). Fill remainder from book 4 via round-robin on strata lengthBucket×hasTheme×hasDevice×dialogueIsh, ascending quote_id within strata. Target 40. Tags are weak references, not ground truth.'
    },
    annotation_relevant: {
      pool: 'import_items import_id=3 kind=weread_review',
      selected: annotations.length,
      excludedQuoteIds: excludedAnnotations.map((q) => q.quoteId),
      algorithm:
        'Start from all 13 Import #3 reviews. Reconstruct Personal Annotation from raw_payload.item.content. Matched: literary text = production Quote. Orphan with abstract: literary text = item.abstract. EXCLUDE orphan_quote_equals_annotation cases (quote 1399) — invalid Quote+Annotation benchmark; production rows untouched; do not synthesize replacements. Expected kept = 12.'
    },
    cold_start: {
      selected: cold.length,
      algorithm:
        'Exclude quote_ids from legacy+annotation groups, excluded orphans, and review LEs. Prefer up to 30 Import #3 bookmarks without review on same LE, stratified by book×length×dialogue. Fill to 50 from Import #2 stratified preferring long, then medium, then short. Ascending quote_id within strata.'
    }
  }

  const summary = {
    total: quotes.length,
    byGroup: {
      legacy_human_tagged: legacy.length,
      annotation_relevant: annotations.length,
      cold_start: cold.length
    },
    lengthBuckets: {
      short: quotes.filter((q) => q.lengthBucket === 'short').length,
      medium: quotes.filter((q) => q.lengthBucket === 'medium').length,
      long: quotes.filter((q) => q.lengthBucket === 'long').length
    },
    dialogueIsh: quotes.filter((q) => q.dialogueIsh).length,
    books: [...new Set(quotes.map((q) => `${q.bookId}:${q.bookTitleZh}`))].sort()
  }

  const fixture = {
    fixtureVersion: FIXTURE_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    createdAt: new Date().toISOString(),
    researchOnly: true,
    notes: [
      'Chinese-first Workbench v1.1 fixture (102 Quotes).',
      'Legacy tags = weak human references, NOT ground truth / NOT accuracy labels.',
      'Import #3 annotations reconstructed for research only; production untouched.',
      'Excluded quote 1399 (orphan_quote_equals_annotation) from annotation_relevant; not replaced.',
      'Do not expand annotation group artificially to reach a round number.',
      'Theme 时间 excluded from reconcile targets — see taxonomy snapshot.'
    ],
    selectionMethod,
    summary,
    contentHash: '',
    quotes
  }
  fixture.contentHash = stableHash({
    fixtureVersion: FIXTURE_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    quoteIds: ids,
    selectionMethod
  })

  fs.mkdirSync(path.dirname(OUT_FIXTURE), { recursive: true })
  fs.writeFileSync(OUT_FIXTURE, JSON.stringify(fixture, null, 2))
  fs.writeFileSync(OUT_TAX, JSON.stringify(taxonomy, null, 2))

  console.log('Wrote', OUT_FIXTURE)
  console.log('Wrote', OUT_TAX)
  console.log(JSON.stringify({ ...summary, contentHash: fixture.contentHash }, null, 2))
  await conn.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
