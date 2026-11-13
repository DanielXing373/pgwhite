import { COPY_VERSION, type StudyMode } from '../../utils/ac1hs/constants'
import { readSessionCookie, writeSessionCookie } from '../../utils/ac1hs/cookie'
import { COPY } from '../../utils/ac1hs/copy'
import { clientIp, ac1Error, readStrictBody } from '../../utils/ac1hs/http'
import { createOrResumeSession } from '../../utils/ac1hs/service'

export default defineEventHandler(async event => {
  const body = await readStrictBody(event, ['consented', 'study_mode'])
  if (body.consented !== true) throw ac1Error(400, 'consent_required', '请先同意参与说明。')
  if (body.study_mode !== undefined && body.study_mode !== 'study' && body.study_mode !== 'test') {
    throw ac1Error(400, 'invalid_mode', '请求格式无效。')
  }
  const studyMode: StudyMode = body.study_mode === 'test' ? 'test' : 'study'

  const result = await createOrResumeSession({
    studyMode,
    clientIp: clientIp(event),
    cookie: readSessionCookie(event)
  })
  if (result.error === 'mode_disabled') throw ac1Error(403, 'mode_disabled', COPY.mode_disabled)
  if (result.error === 'needs_database') {
    throw ac1Error(503, 'study_requires_database', COPY.start_failed)
  }
  if (result.error === 'rate_limited') {
    setHeader(event, 'retry-after', result.retryAfterSeconds)
    throw ac1Error(429, 'rate_limited', COPY.rate_limited)
  }
  if (result.token) writeSessionCookie(event, result.session.session_public_id, result.token)
  return {
    ok: true,
    resumed: result.resumed,
    copy_version: COPY_VERSION,
    session: result.public
  }
})
