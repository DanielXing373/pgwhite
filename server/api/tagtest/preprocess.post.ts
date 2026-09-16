import { TAGTEST_SENTENCES } from '~/data/tagtest/fixture'
import { quoteTextHash } from '~/utils/tagHash'

/** Wizard of Oz：按句子 id 返回写好的自动 tag，并模拟网络延迟。 */
export default defineEventHandler(async () => {
  await new Promise(resolve => setTimeout(resolve, 900))

  const items = TAGTEST_SENTENCES.map(s => ({
    id: s.id,
    autoTags: s.autoTags,
    textHash: quoteTextHash(s.text_zh)
  }))

  return {
    ok: true,
    provider: 'woz-script',
    items
  }
})
