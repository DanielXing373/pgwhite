import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { INTERNAL_MASTER_REL, INTERNAL_MASTER_SHA256, MANIFEST_REL } from '../../server/utils/el2hs/constants'
import { DATASET_ENV, MANIFEST_ENV, loadInternalMaster } from '../../server/utils/el2hs/dataset'

const root = process.cwd()
const masterBytes = readFileSync(resolve(root, INTERNAL_MASTER_REL))
const manifestBytes = readFileSync(resolve(root, MANIFEST_REL))
const encode = (buf: Buffer | string) => gzipSync(Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8')).toString('base64')
const validEnv = () => ({ [DATASET_ENV]: encode(masterBytes), [MANIFEST_ENV]: encode(manifestBytes) })
const nowhere = resolve(root, 'does-not-exist-el2hs')

/** Errors must name the problem without echoing private dataset content. */
function assertFailsClosed(env: Record<string, string>, pattern: RegExp) {
  assert.throws(
    () => loadInternalMaster(root, env),
    (err: Error) => pattern.test(err.message) && err.message.length < 200 && !err.message.includes('text_zh')
  )
}

describe('EL2 dataset from gzip + Base64 environment variables', () => {
  it('loads the frozen master from env without touching local files', () => {
    const loaded = loadInternalMaster(nowhere, validEnv())
    assert.equal(loaded.origin, 'env')
    assert.equal(loaded.sha256, INTERNAL_MASTER_SHA256)
    assert.equal(loaded.master.quotes.length, 20)
    assert.deepEqual(loaded.master, JSON.parse(masterBytes.toString('utf8')))
  })

  it('tolerates line breaks in pasted Base64', () => {
    const env = validEnv()
    env[DATASET_ENV] = env[DATASET_ENV].replace(/(.{76})/g, '$1\n')
    assert.equal(loadInternalMaster(nowhere, env).sha256, INTERNAL_MASTER_SHA256)
  })

  it('refuses when only one variable is set, even though local files exist', () => {
    assertFailsClosed({ [DATASET_ENV]: validEnv()[DATASET_ENV] }, /set both/)
    assertFailsClosed({ [MANIFEST_ENV]: validEnv()[MANIFEST_ENV] }, /set both/)
    assertFailsClosed({ [DATASET_ENV]: validEnv()[DATASET_ENV], [MANIFEST_ENV]: '  ' }, /set both/)
  })

  it('refuses malformed Base64', () => {
    assertFailsClosed({ ...validEnv(), [DATASET_ENV]: 'not*base64!' }, new RegExp(`${DATASET_ENV} is not valid Base64`))
    assertFailsClosed({ ...validEnv(), [MANIFEST_ENV]: 'abc' }, new RegExp(`${MANIFEST_ENV} is not valid Base64`))
  })

  it('refuses Base64 that is not gzip', () => {
    assertFailsClosed(
      { ...validEnv(), [DATASET_ENV]: masterBytes.toString('base64') },
      new RegExp(`${DATASET_ENV} is not valid gzip`)
    )
    assertFailsClosed(
      { ...validEnv(), [MANIFEST_ENV]: gzipSync(manifestBytes).subarray(0, 40).toString('base64') },
      new RegExp(`${MANIFEST_ENV} is not valid gzip`)
    )
  })

  it('refuses a dataset whose bytes differ from the frozen hash', () => {
    const tampered = Buffer.concat([masterBytes, Buffer.from(' ')])
    assertFailsClosed({ ...validEnv(), [DATASET_ENV]: encode(tampered) }, /SHA-256 mismatch/)
  })

  it('refuses a manifest that does not pin the dataset hash', () => {
    const manifest = JSON.parse(manifestBytes.toString('utf8'))
    manifest.files.find((f: { role: string }) => f.role === 'internal_master').sha256 = '0'.repeat(64)
    assertFailsClosed({ ...validEnv(), [MANIFEST_ENV]: encode(JSON.stringify(manifest)) }, /manifest internal_master hash mismatch/)
  })

  it('refuses a manifest that is not JSON without echoing it', () => {
    assertFailsClosed({ ...validEnv(), [MANIFEST_ENV]: encode('{"private": "do-not-echo"') }, /manifest is not valid JSON/)
    assert.throws(
      () => loadInternalMaster(root, { ...validEnv(), [MANIFEST_ENV]: encode('{"private": "do-not-echo"') }),
      (err: Error) => !err.message.includes('do-not-echo')
    )
  })

  it('reads the local private files when neither variable is set', () => {
    for (const env of [{}, { [DATASET_ENV]: '', [MANIFEST_ENV]: '' }]) {
      const loaded = loadInternalMaster(root, env)
      assert.equal(loaded.origin, 'file')
      assert.equal(loaded.sha256, INTERNAL_MASTER_SHA256)
    }
  })

  it('without variables and without local files, fails rather than inventing data', () => {
    assert.throws(() => loadInternalMaster(nowhere, {}), /ENOENT/)
  })
})
