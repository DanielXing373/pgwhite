/** Wizard of Oz：表面「发送到数据端」，不写 Railway。 */
export default defineEventHandler(async event => {
  const body = await readBody(event).catch(() => null)
  const count = Array.isArray((body as { sentences?: unknown[] } | null)?.sentences)
    ? (body as { sentences: unknown[] }).sentences.length
    : 0

  return {
    ok: true,
    stored: false,
    received: count,
    message: '演示提交成功，未写入数据库。'
  }
})
