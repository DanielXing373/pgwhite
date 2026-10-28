import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DATASET_VERSION,
  INTERNAL_MASTER_REL,
  INTERNAL_MASTER_SHA256,
  MANIFEST_REL,
  SOURCE_IDS
} from './constants'
import type { InternalMaster, InternalQuote } from './types'

export function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

export function loadInternalMaster(repoRoot = process.cwd()): {
  master: InternalMaster
  sha256: string
  quotesById: Map<string, InternalQuote>
} {
  const abs = resolve(repoRoot, INTERNAL_MASTER_REL)
  const buf = readFileSync(abs)
  const sha256 = sha256Buffer(buf)
  if (sha256 !== INTERNAL_MASTER_SHA256) {
    throw new Error(
      `STOP: internal master SHA-256 mismatch. expected=${INTERNAL_MASTER_SHA256} actual=${sha256}`
    )
  }
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, MANIFEST_REL), 'utf8')) as {
    freeze_status: string
    dataset_version: string
    files: Array<{ role: string; sha256: string }>
  }
  const listed = manifest.files.find(f => f.role === 'internal_master')
  if (manifest.dataset_version !== DATASET_VERSION) {
    throw new Error('STOP: manifest dataset_version mismatch')
  }
  if (manifest.freeze_status !== 'frozen') {
    throw new Error('STOP: dataset is not frozen')
  }
  if (listed?.sha256 !== sha256) {
    throw new Error('STOP: manifest internal_master hash mismatch')
  }
  const master = JSON.parse(buf.toString('utf8')) as InternalMaster
  if (master.dataset_version !== DATASET_VERSION) {
    throw new Error('STOP: master dataset_version mismatch')
  }
  if (master.quotes.length !== 20) {
    throw new Error(`STOP: expected 20 quotes, got ${master.quotes.length}`)
  }
  for (const quote of master.quotes) {
    if (!quote.text_zh) throw new Error(`STOP: empty text ${quote.quote_id}`)
    if (!quote.attribution?.author_name_zh || !quote.attribution?.book_title_zh) {
      throw new Error(`STOP: missing attribution ${quote.quote_id}`)
    }
    for (const sourceId of SOURCE_IDS) {
      const src = quote.sources[sourceId]
      if (!src) throw new Error(`STOP: missing source ${sourceId} on ${quote.quote_id}`)
      const ids = src.selected_theme_ids
      if (ids.length !== src.themes.length) {
        throw new Error(`STOP: theme order/count mismatch ${quote.quote_id} ${sourceId}`)
      }
      for (let i = 0; i < ids.length; i += 1) {
        const theme = src.themes[i]
        if (!theme || theme.theme_id !== ids[i]) {
          throw new Error(`STOP: theme order mutated ${quote.quote_id} ${sourceId}`)
        }
      }
    }
  }
  return {
    master,
    sha256,
    quotesById: new Map(master.quotes.map(q => [q.quote_id, q]))
  }
}

export function quoteIds(master: InternalMaster): string[] {
  return master.quotes.map(q => q.quote_id)
}
