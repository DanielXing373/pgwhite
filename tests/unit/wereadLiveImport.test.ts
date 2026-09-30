import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseNotebooksResponse } from '../../server/utils/weread/notebooks'
import {
  associationKey,
  parseBookmarkListResponse,
  parseReviewListMineResponse
} from '../../server/utils/weread/parseItems'
import { assertNoCredentialInObject } from '../../server/utils/weread/client'
import {
  deriveImportStatusFromItems,
  summarizeItemCounts
} from '../../server/utils/importStatuses'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const notebooksFx = JSON.parse(
  readFileSync(resolve(root, 'tests/fixtures/weread/notebooks.sample.json'), 'utf8')
)
const bookmarkFx = JSON.parse(
  readFileSync(resolve(root, 'tests/fixtures/weread/bookmarklist.sample.json'), 'utf8')
)
const reviewFx = JSON.parse(
  readFileSync(resolve(root, 'tests/fixtures/weread/reviews.sample.json'), 'utf8')
)

describe('WeRead notebooks parse (/user/notebooks)', () => {
  it('extracts cover, title, author, progress, noteCount', () => {
    const parsed = parseNotebooksResponse(notebooksFx)
    assert.equal(parsed.books.length, 2)
    assert.equal(parsed.books[0].bookId, '24953413')
    assert.equal(parsed.books[0].title, '如果在冬夜，一个旅人')
    assert.equal(parsed.books[0].author, '伊塔洛·卡尔维诺')
    assert.equal(parsed.books[0].translator, '萧天佑')
    assert.equal(parsed.books[0].readingProgress, 100)
    assert.equal(parsed.books[0].noteCount, 2)
    assert.ok(parsed.books[0].cover?.startsWith('https://'))
    assert.equal(parsed.books[1].cover, null)
  })
})

describe('WeRead bookmarklist parse', () => {
  it('preserves bookmarkId, range, markText, createTime', () => {
    const parsed = parseBookmarkListResponse(bookmarkFx)
    assert.equal(parsed.bookmarks.length, 2)
    assert.equal(parsed.bookmarks[0].bookmarkId, '24953413_1_10-20')
    assert.equal(parsed.bookmarks[0].range, '10-20')
    assert.ok(parsed.bookmarks[0].markText.includes('卡尔维诺'))
    assert.equal(parsed.bookmarks[0].createTime, 1700000000)
    assert.equal(parsed.bookmarks[0].raw.bookmarkId, '24953413_1_10-20')
  })
})

describe('WeRead review list parse + association', () => {
  it('parses reviewId/content/abstract/range', () => {
    const parsed = parseReviewListMineResponse(reviewFx)
    assert.equal(parsed.reviews.length, 2)
    assert.equal(parsed.reviews[0].reviewId, 'rev-associated-1')
    assert.ok(parsed.reviews[0].content.includes('读者'))
    assert.equal(parsed.reviews[0].range, '10-20')
  })

  it('associates review to bookmark by bookId|chapterUid|range', () => {
    const bookmarks = parseBookmarkListResponse(bookmarkFx).bookmarks
    const reviews = parseReviewListMineResponse(reviewFx).reviews
    const map = new Map()
    for (const bm of bookmarks) {
      const k = associationKey(bm.bookId, bm.chapterUid, bm.range)
      if (k) map.set(k, bm.bookmarkId)
    }
    const assoc = associationKey(
      reviews[0].bookId,
      reviews[0].chapterUid,
      reviews[0].range
    )
    assert.ok(assoc)
    assert.equal(map.get(assoc!), '24953413_1_10-20')
    const orphanKey = associationKey(
      reviews[1].bookId,
      reviews[1].chapterUid,
      reviews[1].range
    )
    assert.equal(orphanKey, null)
  })
})

describe('Import provenance / status accounting helpers', () => {
  it('external ids are namespaced for bookmarks and reviews', () => {
    assert.equal(
      `weread:bookmark:${bookmarkFx.updated[0].bookmarkId}`,
      'weread:bookmark:24953413_1_10-20'
    )
    assert.equal(
      `weread:review:${reviewFx.reviews[0].review.reviewId}`,
      'weread:review:rev-associated-1'
    )
  })

  it('partial failures yield completed_with_issues', () => {
    assert.equal(
      deriveImportStatusFromItems(['processed', 'failed', 'duplicate']),
      'completed_with_issues'
    )
    assert.deepEqual(summarizeItemCounts(['processed', 'failed', 'pending']), {
      total_items: 3,
      processed_items: 2,
      successful_items: 1,
      failed_items: 1
    })
  })
})

describe('Credential safety', () => {
  it('refuses credential-bearing objects', () => {
    assert.throws(() =>
      assertNoCredentialInObject({ Authorization: 'Bearer wrk-secret' })
    )
    assert.throws(() => assertNoCredentialInObject({ apiKey: 'wrk-secret' }))
    assert.doesNotThrow(() =>
      assertNoCredentialInObject({ kind: 'weread_bookmark', bookmarkId: 'x' })
    )
  })
})
