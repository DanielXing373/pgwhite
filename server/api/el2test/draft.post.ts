import { readSessionCookie } from '../../utils/el2hs/cookie'
import { el2Error, readStrictBody, rethrowBadRequest } from '../../utils/el2hs/http'
import { saveDraft } from '../../utils/el2hs/service'

export default defineEventHandler(async event => {
  const cookie = readSessionCookie(event)
  if (!cookie) throw el2Error(401, 'no_session')
  const body = await readStrictBody(event, ['answers'])
  const result = await saveDraft(cookie.publicId, cookie.token, body.answers).catch(rethrowBadRequest)
  if (result.error === 'unauthorized') throw el2Error(401, 'session_not_found')
  if (result.error === 'immutable') throw el2Error(409, 'already_submitted')
  return { ok: true, session: result.public }
})
