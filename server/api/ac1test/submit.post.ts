import { readSessionCookie } from '../../utils/ac1hs/cookie'
import { ac1Error, readStrictBody, rethrowBadRequest } from '../../utils/ac1hs/http'
import { COPY } from '../../utils/ac1hs/copy'
import { submitSession } from '../../utils/ac1hs/service'

export default defineEventHandler(async event => {
  const cookie = readSessionCookie(event)
  if (!cookie) throw ac1Error(401, 'no_session')
  const body = await readStrictBody(event, ['answers'])
  const result = await submitSession(cookie.publicId, cookie.token, body.answers).catch(rethrowBadRequest)
  if (result.error === 'unauthorized') throw ac1Error(401, 'session_not_found')
  if (result.error === 'incomplete') {
    throw ac1Error(400, 'incomplete', COPY.submit_incomplete)
  }
  return { ok: true, already: result.already, session: result.public }
})
