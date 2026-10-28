import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { SESSION_COOKIE } from './constants'

export type CookieParts = { publicId: string; token: string }

export function parseSessionCookie(raw: string | undefined): CookieParts | null {
  if (!raw) return null
  const i = raw.indexOf('.')
  if (i <= 0) return null
  const publicId = raw.slice(0, i)
  const token = raw.slice(i + 1)
  if (!/^[a-f0-9]{64}$/.test(publicId) || !/^[a-f0-9]{64}$/.test(token)) return null
  return { publicId, token }
}

export function formatSessionCookie(publicId: string, token: string): string {
  return `${publicId}.${token}`
}

export function readSessionCookie(event: H3Event): CookieParts | null {
  return parseSessionCookie(getCookie(event, SESSION_COOKIE))
}

export function writeSessionCookie(event: H3Event, publicId: string, token: string) {
  const secure = process.env.NODE_ENV === 'production'
  setCookie(event, SESSION_COOKIE, formatSessionCookie(publicId, token), {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 14
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
