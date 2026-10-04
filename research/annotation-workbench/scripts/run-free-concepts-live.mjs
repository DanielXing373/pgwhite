#!/usr/bin/env node
/**
 * Live free-concept stage only.
 *
 * 102 Quotes → zh-literary-rich-v1 → one LLM → validated free concepts → freeze artifact
 *
 * Does NOT run embeddings, reconciliation, or production DB writes.
 * Does NOT overwrite mock-dry-run-v1.
 *
 * Credentials: OPENAI_API_KEY from environment only. Never written to artifacts.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOpenAiLlmAdapter } from '../src/adapters/llm.ts'
import { buildPromptMessages } from '../src/adapters/llm.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const REPO = path.resolve(__dirname, '../../..')
const FIXTURE = path.join(ROOT, 'fixtures/benchmark.v1.json')
const RUN_ID = process.env.ANNOTATION_RUN_ID || 'free-concepts-openai-v1'
const OUT_DIR = path.join(ROOT, 'runs', RUN_ID)

function loadDotEnv({ override = true } = {}) {
  const envPath = path.join(REPO, '.env')
  if (!fs.existsSync(envPath)) return
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    const k = line.slice(0, i).trim()
    const v = line.slice(i + 1).trim()
    // Research harness intentionally prefers local .env over a stale shell export.
    if (override || !(k in process.env)) process.env[k] = v
  }
}

function redact(s) {
  return String(s || '').replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]')
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  loadDotEnv()
  console.log('PGWhite annotation workbench — LIVE FREE-CONCEPT STAGE ONLY')
  console.log('NO embeddings · NO reconcile · NO production DB writes')

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('STOP: OPENAI_API_KEY is not configured in the environment.')
    console.error('Detected provider option currently supported by this harness: OpenAI Chat Completions.')
    console.error('Set OPENAI_API_KEY (and optionally OPENAI_MODEL / ANNOTATION_LLM_MODEL).')
    process.exit(2)
  }

  const model =
    process.env.ANNOTATION_LLM_MODEL ||
    process.env.OPENAI_MODEL ||
    'gpt-5.4'

  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))
  if (fixture.fixtureVersion !== 'annotation-bench-v1.1') {
    throw new Error(
      `Expected fixture annotation-bench-v1.1, got ${fixture.fixtureVersion}. Re-export first.`
    )
  }
  if (fixture.summary?.total !== 102) {
    throw new Error(`Expected 102 quotes, got ${fixture.summary?.total}`)
  }
  if (fixture.quotes.some((q) => q.quoteId === 1399)) {
    throw new Error('quote 1399 must not be in fixture')
  }

  const promptVersion =
    process.env.ANNOTATION_PROMPT_VERSION || 'zh-literary-rich-v1'

  const quoteIdFilter = process.env.ANNOTATION_QUOTE_IDS
    ? process.env.ANNOTATION_QUOTE_IDS.split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n))
    : null

  let quotes = fixture.quotes
  if (quoteIdFilter?.length) {
    const want = new Set(quoteIdFilter)
    quotes = fixture.quotes.filter((q) => want.has(q.quoteId))
    const found = new Set(quotes.map((q) => q.quoteId))
    const missing = quoteIdFilter.filter((id) => !found.has(id))
    if (missing.length) {
      throw new Error(`ANNOTATION_QUOTE_IDS not in fixture: ${missing.join(',')}`)
    }
    // Preserve requested order
    quotes = quoteIdFilter.map((id) => quotes.find((q) => q.quoteId === id))
  } else if (process.env.ANNOTATION_LIMIT) {
    quotes = fixture.quotes.slice(0, Number(process.env.ANNOTATION_LIMIT))
  }

  const adapter = createOpenAiLlmAdapter({
    apiKey,
    model,
    maxRetries: Number(process.env.ANNOTATION_MAX_RETRIES || 2),
    temperature: Number(process.env.ANNOTATION_TEMPERATURE || 0.4)
  })

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const partialPath = path.join(OUT_DIR, 'partial.jsonl')
  const progressPath = path.join(OUT_DIR, 'progress.json')
  // Resume support: skip already-successful quote_ids in partial.jsonl
  const done = new Map()
  if (fs.existsSync(partialPath)) {
    for (const line of fs.readFileSync(partialPath, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const row = JSON.parse(line)
        if (row.validation_status === 'ok') done.set(row.quote_id, row)
      } catch {
        /* ignore bad partial line */
      }
    }
  }

  const results = []
  const failures = []
  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0
  let retries = 0

  const startedAt = new Date().toISOString()
  console.log(
    JSON.stringify({
      run_id: RUN_ID,
      fixture: fixture.fixtureVersion,
      hash: fixture.contentHash,
      model,
      provider: 'openai',
      prompt_version: promptVersion,
      quotes: quotes.length,
      quote_ids: quotes.map((q) => q.quoteId),
      resume_ok: done.size
    })
  )

  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i]
    if (done.has(q.quoteId)) {
      results.push(done.get(q.quoteId))
      process.stdout.write(`skip ${q.quoteId} (${i + 1}/${quotes.length})\n`)
      continue
    }

    const promptPreview = buildPromptMessages(q, promptVersion)
    // Ensure credentials never appear in stored prompt previews
    if (/sk-[a-zA-Z0-9_-]+/.test(promptPreview.system + promptPreview.user)) {
      throw new Error('Credential leak detected in prompt preview — aborting')
    }

    let row
    try {
      const { value, meta } = await adapter.proposeConceptsWithMeta({
        quoteText: q.textZh,
        bookTitleZh: q.bookTitleZh,
        authorNameZh: q.authorNameZh,
        chapterTitle: q.chapterTitle,
        personalAnnotation: q.personalAnnotation?.content ?? null,
        promptVersion,
        quote: q
      })
      retries += Math.max(0, meta.attempts.length - 1)
      for (const a of meta.attempts) {
        if (a.usage?.prompt_tokens) promptTokens += a.usage.prompt_tokens
        if (a.usage?.completion_tokens) completionTokens += a.usage.completion_tokens
        if (a.usage?.total_tokens) totalTokens += a.usage.total_tokens
      }

      row = {
        quote_id: q.quoteId,
        group: q.group,
        book_id: q.bookId,
        book_title_zh: q.bookTitleZh,
        author_name_zh: q.authorNameZh || null,
        chapter_title: q.chapterTitle || null,
        source_quote: q.textZh,
        // Authoritative Personal Annotation from fixture/input — NOT LLM echo.
        personal_annotation: q.personalAnnotation
          ? {
              content: q.personalAnnotation.content,
              original_content: q.personalAnnotation.originalContent || q.personalAnnotation.content,
              source: q.personalAnnotation.source,
              import_item_id: q.personalAnnotation.importItemId ?? null,
              association: q.personalAnnotation.association ?? null
            }
          : null,
        themes: value.themes,
        devices: value.devices,
        annotation_interpretation: value.annotation_interpretation,
        llm_notes: value.notes || '',
        validation_status: 'ok',
        failures: [],
        retries: meta.attempts.filter((a) => !a.ok).length,
        call_meta: {
          provider: meta.provider,
          model: meta.model,
          attempts: meta.attempts.map((a) => ({
            attempt: a.attempt,
            ok: a.ok,
            httpStatus: a.httpStatus ?? null,
            error: a.error ? redact(a.error) : null,
            validationErrors: a.validationErrors || null,
            latencyMs: a.latencyMs,
            usage: a.usage || null
          }))
        },
        prompt_version: promptVersion,
        output_schema_version: 'llm-free-concepts.v1',
        processed_at: new Date().toISOString()
      }
      results.push(row)
      fs.appendFileSync(partialPath, JSON.stringify(row) + '\n')
      process.stdout.write(
        `ok ${q.quoteId} themes=${value.themes.length} devices=${value.devices.length} (${i + 1}/${quotes.length})\n`
      )
    } catch (err) {
      const msg = redact(err instanceof Error ? err.message : String(err))
      row = {
        quote_id: q.quoteId,
        group: q.group,
        book_id: q.bookId,
        book_title_zh: q.bookTitleZh,
        author_name_zh: q.authorNameZh || null,
        chapter_title: q.chapterTitle || null,
        source_quote: q.textZh,
        personal_annotation: q.personalAnnotation
          ? {
              content: q.personalAnnotation.content,
              original_content: q.personalAnnotation.originalContent || q.personalAnnotation.content,
              source: q.personalAnnotation.source,
              import_item_id: q.personalAnnotation.importItemId ?? null,
              association: q.personalAnnotation.association ?? null
            }
          : null,
        themes: [],
        devices: [],
        annotation_interpretation: null,
        llm_notes: '',
        validation_status: 'failed',
        failures: [msg],
        retries: Number(process.env.ANNOTATION_MAX_RETRIES || 2),
        call_meta: adapter.lastCallMeta
          ? {
              provider: adapter.lastCallMeta.provider,
              model: adapter.lastCallMeta.model,
              attempts: adapter.lastCallMeta.attempts.map((a) => ({
                attempt: a.attempt,
                ok: a.ok,
                httpStatus: a.httpStatus ?? null,
                error: a.error ? redact(a.error) : null,
                validationErrors: a.validationErrors || null,
                latencyMs: a.latencyMs,
                usage: a.usage || null
              }))
            }
          : null,
        prompt_version: promptVersion,
        output_schema_version: 'llm-free-concepts.v1',
        processed_at: new Date().toISOString()
      }
      failures.push({ quote_id: q.quoteId, error: msg })
      results.push(row)
      fs.appendFileSync(partialPath, JSON.stringify(row) + '\n')
      process.stdout.write(`FAIL ${q.quoteId}: ${msg}\n`)
    }

    fs.writeFileSync(
      progressPath,
      JSON.stringify(
        {
          run_id: RUN_ID,
          processed: i + 1,
          total: quotes.length,
          ok: results.filter((r) => r.validation_status === 'ok').length,
          failed: failures.length,
          updated_at: new Date().toISOString()
        },
        null,
        2
      )
    )

    // Gentle pacing to reduce rate-limit risk.
    const delay = Number(process.env.ANNOTATION_DELAY_MS || 200)
    if (delay > 0) await sleep(delay)
  }

  const okRows = results.filter((r) => r.validation_status === 'ok')
  const themeCounts = okRows.map((r) => r.themes.length)
  const deviceCounts = okRows.map((r) => r.devices.length)
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const patternDist = {}
  for (const r of okRows) {
    const p = r.annotation_interpretation?.pattern
    if (!p) continue
    patternDist[p] = (patternDist[p] || 0) + 1
  }
  const labelFreq = new Map()
  for (const r of okRows) {
    for (const t of r.themes) labelFreq.set(`theme:${t.label}`, (labelFreq.get(`theme:${t.label}`) || 0) + 1)
    for (const d of r.devices) labelFreq.set(`device:${d.label}`, (labelFreq.get(`device:${d.label}`) || 0) + 1)
  }
  const recurring = [...labelFreq.entries()]
    .map(([k, count]) => ({ key: k, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'zh'))
    .slice(0, 40)

  // Approximate OpenAI gpt-4o list price (USD / 1M tokens) — update if model differs.
  // Input $2.50 / Output $10.00 as of common public pricing; research estimate only.
  const estCostUsd =
    (promptTokens / 1e6) * 2.5 + (completionTokens / 1e6) * 10.0

  const artifact = {
    schema_version: 'free-concepts-run.v1',
    run_id: RUN_ID,
    stage: 'free_concepts_only',
    research_only: true,
    created_at: startedAt,
    completed_at: new Date().toISOString(),
    fixture_version: fixture.fixtureVersion,
    fixture_content_hash: fixture.contentHash,
    prompt_version: promptVersion,
    output_schema_version: 'llm-free-concepts.v1',
    annotation_schema_version: 'annotation-interpretation.v1',
    llm: {
      provider: 'openai',
      adapter_id: `openai:${model}`,
      model,
      // No API keys here — intentionally omitted.
      temperature: Number(process.env.ANNOTATION_TEMPERATURE || 0.4)
    },
    pipeline: {
      free_concepts_first: true,
      embedding: null,
      reconcile: null,
      active_dimensions: ['theme', 'device']
    },
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost_usd_gpt4o_public_rates: Number(estCostUsd.toFixed(4)),
      note: 'Cost estimate uses public gpt-4o-ish rates if model is gpt-4o; verify for other models.'
    },
    summary: {
      expected_quotes: fixture.summary.total,
      processed_quotes: results.length,
      ok: okRows.length,
      failed: failures.length,
      retries_total: retries,
      mean_themes_per_quote: Number(mean(themeCounts).toFixed(4)),
      mean_devices_per_quote: Number(mean(deviceCounts).toFixed(4)),
      zero_device_n: deviceCounts.filter((n) => n === 0).length,
      zero_device_pct: okRows.length
        ? Number(((deviceCounts.filter((n) => n === 0).length / okRows.length) * 100).toFixed(2))
        : 0,
      annotation_pattern_distribution: patternDist,
      recurring_free_concepts: recurring,
      failures
    },
    results
  }

  const outFile = path.join(OUT_DIR, 'free-concepts.json')
  fs.writeFileSync(outFile, JSON.stringify(artifact, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(artifact.summary, null, 2))

  // Compact review pack for the static UI (includes source quote + annotation).
  fs.writeFileSync(
    path.join(OUT_DIR, 'review-pack.json'),
    JSON.stringify(
      {
        run_id: RUN_ID,
        fixture_version: fixture.fixtureVersion,
        prompt_version: promptVersion,
        llm: artifact.llm,
        summary: artifact.summary,
        quotes: results.map((r) => ({
          quote_id: r.quote_id,
          group: r.group,
          book_title_zh: r.book_title_zh,
          author_name_zh: r.author_name_zh,
          source_quote: r.source_quote,
          personal_annotation: r.personal_annotation,
          themes: r.themes,
          devices: r.devices,
          annotation_interpretation: r.annotation_interpretation,
          validation_status: r.validation_status,
          failures: r.failures
        }))
      },
      null,
      2
    )
  )

  console.log('Wrote', outFile)
  console.log(JSON.stringify(artifact.summary, null, 2))
  console.log(
    JSON.stringify(
      {
        usage: artifact.usage,
        review: path.join(OUT_DIR, 'review-pack.json'),
        ui: 'research/annotation-workbench/review/index.html (load review-pack.json or free-concepts.json)'
      },
      null,
      2
    )
  )

  if (failures.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(redact(e instanceof Error ? e.message : String(e)))
  process.exit(1)
})
