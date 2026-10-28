import { createError, getRequestIP, readBody, type H3Event } from 'h3'
import { BadRequestError, assertBodyKeys } from './service'

/**
 * Only trust X-Forwarded-For on Vercel, whose edge overwrites it with the real client
 * address. Elsewhere use the socket address so a client cannot pick its own bucket.
 */
export function clientIp(event: H3Event): string {
  const trustProxy = process.env.VERCEL === '1'
  return getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'unknown'
}

/** statusMessage stays ASCII (it becomes an HTTP header); the Chinese text goes in data.message. */
export function el2Error(statusCode: number, code: string, message?: string) {
  return createError({ statusCode, statusMessage: code, data: { code, message: message ?? code } })
}

export async function readStrictBody(event: H3Event, allowed: readonly string[]) {
  const raw = await readBody(event).catch(() => null)
  try {
    return assertBodyKeys(raw, allowed)
  } catch (err) {
    if (err instanceof BadRequestError) throw el2Error(400, 'unexpected_field', '请求包含不接受的字段。')
    throw err
  }
}

export function rethrowBadRequest(err: unknown): never {
  if (err instanceof BadRequestError) throw el2Error(400, 'invalid_request', '请求格式无效。')
  throw err
}
