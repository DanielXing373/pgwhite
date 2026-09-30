// =====================================================
// WeRead Agent Gateway client (PGWhite 1.2)
// Credential is request-scoped; never log or persist the API key.
// =====================================================

export const WEREAD_GATEWAY = 'https://i.weread.qq.com/api/agent/gateway'
export const WEREAD_SKILL_VERSION = '1.0.4'

export type WereadGatewayError = {
  errcode: number
  errmsg: string
}

export async function wereadGatewayPost<T = Record<string, unknown>>(
  apiKey: string,
  body: Record<string, unknown>
): Promise<T> {
  const key = String(apiKey || '').trim()
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey required' })
  }
  if (!key.startsWith('wrk-')) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey format invalid' })
  }

  const res = await fetch(WEREAD_GATEWAY, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...body, skill_version: WEREAD_SKILL_VERSION })
  })

  let data: Record<string, unknown>
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'WeRead gateway returned non-JSON'
    })
  }

  if (data.upgrade_info) {
    throw createError({
      statusCode: 426,
      statusMessage: 'WeRead skill upgrade required'
    })
  }

  const errcode = data.errcode
  if (errcode != null && Number(errcode) !== 0) {
    throw createError({
      statusCode: 502,
      statusMessage: `WeRead error ${errcode}: ${String(data.errmsg || 'unknown')}`
    })
  }

  return data as T
}

/** Strip secrets before any accidental persistence of request wrappers */
export function assertNoCredentialInObject(obj: unknown): void {
  const s = JSON.stringify(obj)
  if (/Bearer\s+wrk-/i.test(s) || /"apiKey"\s*:\s*"wrk-/i.test(s)) {
    throw new Error('Refusing to persist credential-bearing payload')
  }
}
