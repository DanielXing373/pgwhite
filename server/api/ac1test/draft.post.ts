import { readSessionCookie } from '../../utils/ac1hs/cookie'
import { ac1Error, readStrictBody, rethrowBadRequest } from '../../utils/ac1hs/http'
import { saveDraft } from '../../utils/ac1hs/service'

export default defineEventHandler(async event => {
  const cookie = readSessionCookie(event)
  if (!cookie) throw ac1Error(401, 'no_session')
  const body = await readStrictBody(event, ['answers'])
  const result = await saveDraft(cookie.publicId, cookie.token, body.answers).catch(rethrowBadRequest)
  if (result.error === 'unauthorized') throw ac1Error(401, 'session_not_found')
  if (result.error === 'immutable') throw ac1Error(409, 'already_submitted')
  return { ok: true, session: result.public }
})
