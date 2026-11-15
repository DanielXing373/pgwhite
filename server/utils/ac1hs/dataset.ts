import { createHash } from 'node:crypto'
import {
  DATASET_VERSION,
  DIMENSIONS,
  INTERNAL_MASTER_CONTENT_SHA256,
  POOL_SIZE,
  PROTOCOL_VERSION,
  SOURCE_IDS
} from './constants'
import { AC1_INTERNAL_MASTER } from './dataset.generated'
import type { InternalMaster, InternalQuote } from './types'

export function contentSha256(quotes: InternalQuote[]): string {
  return createHash('sha256').update(JSON.stringify(quotes), 'utf8').digest('hex')
}

/**
 * Unlike el2hs (which reads a JSON file under research/ at run time), the question set is a
 * generated module, so it is bundled with the server and available on serverless hosts.
 * Integrity is still checked on every cold start: the content hash must match the frozen constant.
 */
export function loadInternalMaster(master: InternalMaster = AC1_INTERNAL_MASTER): {
  master: InternalMaster
  sha256: string
  quotesById: Map<string, InternalQuote>
} {
  const sha256 = contentSha256(master.quotes)
  if (sha256 !== INTERNAL_MASTER_CONTENT_SHA256) {
    throw new Error(
      `STOP: internal master content SHA-256 mismatch. expected=${INTERNAL_MASTER_CONTENT_SHA256} actual=${sha256}`
    )
  }
  if (master.content_sha256 !== sha256) throw new Error('STOP: master content_sha256 field mismatch')
  if (master.dataset_version !== DATASET_VERSION) throw new Error('STOP: master dataset_version mismatch')
  if (master.protocol_version !== PROTOCOL_VERSION) throw new Error('STOP: master protocol_version mismatch')
  if (master.freeze_status !== 'frozen') throw new Error('STOP: dataset is not frozen')
  if (master.quotes.length !== POOL_SIZE) {
    throw new Error(`STOP: expected ${POOL_SIZE} quotes, got ${master.quotes.length}`)
  }
  const seenQuotes = new Set<string>()
  for (const quote of master.quotes) {
    if (seenQuotes.has(quote.quote_id)) throw new Error(`STOP: duplicate quote ${quote.quote_id}`)
    seenQuotes.add(quote.quote_id)
    if (!quote.text_zh) throw new Error(`STOP: empty text ${quote.quote_id}`)
    if (!quote.attribution?.author_name_zh || !quote.attribution?.book_title_zh) {
      throw new Error(`STOP: missing attribution ${quote.quote_id}`)
    }
    if (quote.tags.length === 0) throw new Error(`STOP: no tags ${quote.quote_id}`)
    const seenTags = new Set<string>()
    for (const tag of quote.tags) {
      if (seenTags.has(tag.tag_id)) throw new Error(`STOP: duplicate tag ${tag.tag_id} on ${quote.quote_id}`)
      seenTags.add(tag.tag_id)
      if (!tag.label_zh) throw new Error(`STOP: empty label ${tag.tag_id}`)
      if (!DIMENSIONS.includes(tag.dimension)) throw new Error(`STOP: bad dimension ${tag.tag_id}`)
      if (tag.sources.length === 0) throw new Error(`STOP: tag without a source ${tag.tag_id}`)
      for (const source of tag.sources) {
        if (!SOURCE_IDS.includes(source)) throw new Error(`STOP: unknown source ${source}`)
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
