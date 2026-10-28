import { readSessionCookie } from '../../utils/el2hs/cookie'
import { loadAuthenticated } from '../../utils/el2hs/service'

export default defineEventHandler(async event => {
  const cookie = readSessionCookie(event)
  if (!cookie) {
    throw createError({ statusCode: 401, statusMessage: 'No study session.' })
  }
  const auth = await loadAuthenticated(cookie.publicId, cookie.token)
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Session not found.' })
  }
  return { ok: true, session: auth.public }
})
