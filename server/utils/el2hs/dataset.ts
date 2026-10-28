import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import {
  DATASET_VERSION,
  INTERNAL_MASTER_REL,
  INTERNAL_MASTER_SHA256,
  MANIFEST_REL,
  SOURCE_IDS
} from './constants'
import type { InternalMaster, InternalQuote } from './types'

/** gzip + Base64 of the frozen internal master and its manifest, for hosts without the private files (Vercel). */
export const DATASET_ENV = 'EL2_HS_DATASET_BASE64'
export const MANIFEST_ENV = 'EL2_HS_MANIFEST_BASE64'

type Env = Record<string, string | undefined>

export function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function decodeGzipBase64(name: string, raw: string): Buffer {
  const b64 = raw.replace(/\s+/g, '')
  if (!b64 || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw new Error(`STOP: ${name} is not valid Base64`)
  }
  try {
    return gunzipSync(Buffer.from(b64, 'base64'))
  } catch {
    throw new Error(`STOP: ${name} is not valid gzip`)
  }
}

/** Parse errors can quote the input, so never let them through into logs. */
function parseJson<T>(buf: Buffer, label: string): T {
  try {
    return JSON.parse(buf.toString('utf8')) as T
  } catch {
    throw new Error(`STOP: ${label} is not valid JSON`)
  }
}

/**
 * Both env vars set: use them and nothing else (any failure throws; local files are not consulted).
 * Neither set: read the local private files. Exactly one set: refuse.
 */
function readDatasetBytes(repoRoot: string, env: Env) {
  const dataset = env[DATASET_ENV]?.trim()
  const manifest = env[MANIFEST_ENV]?.trim()
  if (dataset || manifest) {
    if (!dataset || !manifest) {
      throw new Error(`STOP: set both ${DATASET_ENV} and ${MANIFEST_ENV}, or neither`)
    }
    return {
      origin: 'env' as const,
      masterBuf: decodeGzipBase64(DATASET_ENV, dataset),
      manifestBuf: decodeGzipBase64(MANIFEST_ENV, manifest)
    }
  }
  return {
    origin: 'file' as const,
    masterBuf: readFileSync(resolve(repoRoot, INTERNAL_MASTER_REL)),
    manifestBuf: readFileSync(resolve(repoRoot, MANIFEST_REL))
  }
}

export function validateDataset(masterBuf: Buffer, manifestBuf: Buffer): {
  master: InternalMaster
  sha256: string
  quotesById: Map<string, InternalQuote>
} {
  const sha256 = sha256Buffer(masterBuf)
  if (sha256 !== INTERNAL_MASTER_SHA256) {
    throw new Error(
      `STOP: internal master SHA-256 mismatch. expected=${INTERNAL_MASTER_SHA256} actual=${sha256}`
    )
  }
  const manifest = parseJson<{
    freeze_status: string
    dataset_version: string
    files: Array<{ role: string; sha256: string }>
  }>(manifestBuf, 'manifest')
  const listed = manifest.files?.find(f => f.role === 'internal_master')
  if (manifest.dataset_version !== DATASET_VERSION) {
    throw new Error('STOP: manifest dataset_version mismatch')
  }
  if (manifest.freeze_status !== 'frozen') {
    throw new Error('STOP: dataset is not frozen')
  }
  if (listed?.sha256 !== sha256) {
    throw new Error('STOP: manifest internal_master hash mismatch')
  }
  const master = parseJson<InternalMaster>(masterBuf, 'internal master')
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

export function loadInternalMaster(repoRoot = process.cwd(), env: Env = process.env) {
  const { origin, masterBuf, manifestBuf } = readDatasetBytes(repoRoot, env)
  return { ...validateDataset(masterBuf, manifestBuf), origin }
}

export function quoteIds(master: InternalMaster): string[] {
  return master.quotes.map(q => q.quote_id)
}
