import { COPY_VERSION, type StudyMode } from '../../utils/el2hs/constants'
import { readSessionCookie, writeSessionCookie } from '../../utils/el2hs/cookie'
import { COPY } from '../../utils/el2hs/copy'
import { clientIp, el2Error, readStrictBody } from '../../utils/el2hs/http'
import { createOrResumeSession } from '../../utils/el2hs/service'

export default defineEventHandler(async event => {
  const body = await readStrictBody(event, ['consented', 'study_mode'])
  if (body.consented !== true) throw el2Error(400, 'consent_required', '请先同意参与说明。')
  if (body.study_mode !== undefined && body.study_mode !== 'study' && body.study_mode !== 'test') {
    throw el2Error(400, 'invalid_mode', '请求格式无效。')
  }
  const studyMode: StudyMode = body.study_mode === 'test' ? 'test' : 'study'

  const result = await createOrResumeSession({
    studyMode,
    clientIp: clientIp(event),
    cookie: readSessionCookie(event)
  })
  if (result.error === 'mode_disabled') throw el2Error(403, 'mode_disabled', COPY.mode_disabled)
  if (result.error === 'needs_database') {
    throw el2Error(503, 'study_requires_database', COPY.start_failed)
  }
  if (result.error === 'rate_limited') {
    setHeader(event, 'retry-after', result.retryAfterSeconds)
    throw el2Error(429, 'rate_limited', COPY.rate_limited)
  }
  if (result.token) writeSessionCookie(event, result.session.session_public_id, result.token)
  return {
    ok: true,
    resumed: result.resumed,
    copy_version: COPY_VERSION,
    session: result.public
  }
})
