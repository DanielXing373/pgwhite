import { readSessionCookie } from '../../utils/el2hs/cookie'
import { el2Error, readStrictBody, rethrowBadRequest } from '../../utils/el2hs/http'
import { submitSession } from '../../utils/el2hs/service'

export default defineEventHandler(async event => {
  const cookie = readSessionCookie(event)
  if (!cookie) throw el2Error(401, 'no_session')
  const body = await readStrictBody(event, ['answers'])
  const result = await submitSession(cookie.publicId, cookie.token, body.answers).catch(rethrowBadRequest)
  if (result.error === 'unauthorized') throw el2Error(401, 'session_not_found')
  if (result.error === 'incomplete') {
    throw el2Error(400, 'incomplete', '请先为全部 10 段摘录做出选择。')
  }
  return { ok: true, already: result.already, session: result.public }
})
