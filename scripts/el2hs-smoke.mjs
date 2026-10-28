// EL2 human-study HTTP smoke test against the built server (`nuxi build` first).
// Memory store only: DB_* is stripped, so nothing touches MySQL.
// Usage: node scripts/el2hs-smoke.mjs
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' | ' + detail : ''}`)

async function withServer(port, env, fn) {
  const clean = { ...process.env }
  for (const k of Object.keys(clean)) {
    if (k.startsWith('DB_') || k.startsWith('EL2_HS_') || k === 'VERCEL_ENV' || k === 'VERCEL') delete clean[k]
  }
  const child = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: ROOT,
    env: { ...clean, PORT: String(port), NODE_ENV: 'production', ...env },
    stdio: 'ignore'
  })
  const base = `http://127.0.0.1:${port}`
  for (let i = 0; i < 50; i += 1) {
    try {
      await fetch(base + '/api/el2test/meta')
      break
    } catch {
      await sleep(200)
    }
  }
  try {
    await fn(base)
  } finally {
    child.kill()
  }
}

async function post(base, path, body, cookie) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body)
  })
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, json, setCookie: res.headers.get('set-cookie'), retry: res.headers.get('retry-after') }
}

const start = { consented: true, study_mode: 'test' }

await withServer(3131, {}, async base => {
  const r = await post(base, '/api/el2test/session', start)
  check('production build without flag rejects test mode', r.status === 403, `status ${r.status}`)
  const s = await post(base, '/api/el2test/session', { consented: true, study_mode: 'study' })
  check('study mode without database returns 503', s.status === 503, `status ${s.status}`)
})

await withServer(3132, { VERCEL_ENV: 'production', VERCEL: '1', EL2_HS_ALLOW_TEST_MODE: '1' }, async base => {
  const r = await post(base, '/api/el2test/session', start)
  check('Vercel production rejects test mode even with flag', r.status === 403, `status ${r.status}`)
})

await withServer(3133, { VERCEL_ENV: 'preview', VERCEL: '1' }, async base => {
  const r = await post(base, '/api/el2test/session', { consented: true, study_mode: 'study' })
  check('Vercel preview rejects study mode by default', r.status === 403, `status ${r.status}`)
  const t = await post(base, '/api/el2test/session', start)
  check('Vercel preview rejects test mode by default', t.status === 403, `status ${t.status}`)
})

await withServer(3134, { EL2_HS_ALLOW_TEST_MODE: '1', EL2_HS_RATE_LIMIT_PER_CLIENT: '3' }, async base => {
  const extra = await post(base, '/api/el2test/session', { ...start, email: 'a@b.cn' })
  check('session rejects unexpected field', extra.status === 400, `status ${extra.status}`)

  const first = await post(base, '/api/el2test/session', start)
  check('flagged local production build allows test session', first.status === 200, `status ${first.status}`)
  const cookie = (first.setCookie || '').split(';')[0]
  const resumed = await post(base, '/api/el2test/session', start, cookie)
  check('repeat start with cookie resumes same session', resumed.json?.resumed === true && !resumed.setCookie)
  const rec = await fetch(base + '/api/el2test/session', { headers: { cookie } })
  check('GET session recovers', rec.status === 200)

  const answers = first.json.session.questions.map(q => ({ position: q.position, choice: 'C' }))
  const contact = await post(base, '/api/el2test/submit', { answers, followup_contact: 'a@b.cn' }, cookie)
  check('submit rejects followup_contact', contact.status === 400, `status ${contact.status}`)
  const rowExtra = await post(base, '/api/el2test/submit', { answers: answers.map(a => ({ ...a, contact: 'x' })) }, cookie)
  check('submit rejects extra field inside answers', rowExtra.status === 400, `status ${rowExtra.status}`)
  const ok = await post(base, '/api/el2test/submit', { answers }, cookie)
  check('ten answers alone complete the submission', ok.status === 200 && ok.json?.session?.completion_status === 'completed')
  const body = JSON.stringify(first.json) + JSON.stringify(ok.json)
  check('public payload hides model ids and definitions', !/human-gold|embedding-top2|gpt-6-luna|deepseek-flash|definition_zh/.test(body))

  const statuses = []
  let last
  for (let i = 0; i < 4; i += 1) {
    last = await post(base, '/api/el2test/session', start)
    statuses.push(last.status)
  }
  check('rate limit returns 429 with Retry-After', statuses.at(-1) === 429 && Number(last.retry) > 0, statuses.join(','))
  check('rate-limit message is user-facing Chinese', /稍后再试/.test(last.json?.data?.message ?? ''), JSON.stringify(last.json))

  const exp = await fetch(base + '/api/el2test/export')
  check('export without token is 404', exp.status === 404)
})

const TOKEN = 'x'.repeat(40)
await withServer(3135, { EL2_HS_ALLOW_TEST_MODE: '1', EL2_HS_EXPORT_TOKEN: TOKEN }, async base => {
  const first = await post(base, '/api/el2test/session', start)
  const cookie = (first.setCookie || '').split(';')[0]
  const answers = first.json.session.questions.map(q => ({ position: q.position, choice: 'A' }))
  await post(base, '/api/el2test/submit', { answers }, cookie)
  const wrong = await fetch(base + '/api/el2test/export', { headers: { 'x-el2-hs-export-token': 'y'.repeat(40) } })
  check('export with wrong token is 404', wrong.status === 404)
  const csv = await (
    await fetch(base + '/api/el2test/export?format=csv&mode=test', { headers: { 'x-el2-hs-export-token': TOKEN } })
  ).text()
  const header = csv.split('\n')[0]
  check(
    'CSV export has 10 rows and no contact columns',
    csv.trim().split('\n').length === 11 && !/contact|email|wechat|ip|user_agent/i.test(header)
  )
  const old = await (await fetch(base + '/api/el2test/export?dataset=followup', { headers: { 'x-el2-hs-export-token': TOKEN } })).json()
  check('former followup export no longer exists', old.dataset !== 'followup_contacts' && !('contact' in (old.rows?.[0] ?? {})))
})

console.log(results.join('\n'))
process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0)
