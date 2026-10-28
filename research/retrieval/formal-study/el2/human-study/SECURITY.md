# EL2 questionnaire — security and abuse controls

Code: `server/utils/el2hs/policy.ts`, `rateLimit.ts`, `http.ts`, `service.ts`. Tests: `tests/unit/el2hs.test.ts`, `scripts/el2hs-smoke.mjs` (HTTP checks against a local build, memory store only).

None of the environment variables below are assumed to exist on Vercel. All have safe defaults when unset.

## 1. Where test and study mode are allowed

Enforced on the server for creating a session **and** for every later request with an existing cookie. The UI banner is cosmetic only.

Environment detection (`deployEnv`): `VERCEL_ENV=production` → production; `VERCEL_ENV=preview` → preview; `VERCEL_ENV=development` or no `NODE_ENV=production` → local; any other `NODE_ENV=production` build (e.g. `node .output/server/index.mjs`, a non-Vercel host) → production, so unknown hosts fail closed.

| Environment | Test mode (`?mode=test`) | Study mode |
| --- | --- | --- |
| Local development (`nuxi dev`) | Allowed. Uses MySQL with `study_mode='test'` if `DB_*` is set, else memory. | Allowed if MySQL is configured; otherwise 503. |
| Local production build | Only with `EL2_HS_ALLOW_TEST_MODE=1`; memory store only. | Allowed if MySQL is configured. |
| Vercel Preview | Only with `EL2_HS_ALLOW_TEST_MODE=1`; **memory store only**, so a preview that shares a database can never write test rows. Memory does not survive across serverless instances, so expect lost sessions. | **403 by default.** Only with `EL2_HS_ALLOW_PREVIEW_STUDY=1`, which an operator sets only after pointing the preview at a non-production database. |
| Vercel Production | **Never**, even with `EL2_HS_ALLOW_TEST_MODE=1` (403). | Allowed; requires MySQL. |

A test session created where test mode was allowed cannot be used where it is not (the cookie is treated as unknown → 401). Test and study sessions are separated by `study_mode` on every row; balancing counters and the export filter by mode.

## 2. Session-creation rate limiting

Protects `POST /api/el2test/session` only. GET session (recovery), draft, and submit are not limited.

- **Resume first.** If the request carries a valid cookie for an in-progress session of the same mode, that session is returned (`resumed: true`) and nothing is counted. Refresh, double-click, and returning to the welcome page do not consume quota.
- **Per-client limit:** `EL2_HS_RATE_LIMIT_PER_CLIENT` new sessions per window (default **20**). Generous because classrooms and offices share one public IP.
- **Global limit:** `EL2_HS_RATE_LIMIT_GLOBAL` new sessions per window across everyone (default **300**). Caps distributed floods that would fill in-flight counters and skew group/quote balancing.
- **Window:** `EL2_HS_RATE_LIMIT_WINDOW_SECONDS` (default **600**, fixed windows aligned to UTC).
- **Response:** HTTP 429, `Retry-After` seconds, `data.message` 「开始的次数过于频繁，请稍后再试。」 shown on the welcome page.

Adjust by setting the variables (integers; out-of-range values are clamped, invalid ones fall back to the default) and redeploying.

### Storage and privacy

- **MySQL (study, and local test with DB):** tables `el2_hs_rate_limit` and `el2_hs_rate_salt` (migration 0007). Shared by all serverless instances, so the limit holds on Vercel. Bucket key = HMAC-SHA256(random daily salt, client IP); no raw IP is stored. Each session creation deletes counter rows older than 24 h and salts from previous UTC days, after which old hashes cannot be linked to anything. Rate-limit rows are not linked to sessions.
- **Memory (local / preview test mode):** per-process Map with a per-process random salt. Not reliable across serverless instances; acceptable only because it guards test mode.
- **Client IP:** on Vercel (`VERCEL=1`) the first `X-Forwarded-For` entry, which Vercel's edge sets; elsewhere the socket address, so clients cannot choose their own bucket.

### Status

The MySQL limiter is implemented but **not yet run against a real database** (migration 0007 not executed). Until the DB integration batch passes, treat production rate limiting as **unverified**.

## 3. Request validation

`session`, `draft`, and `submit` accept only their listed fields (`consented`, `study_mode` / `answers`), and each answer only `position` and `choice`. Any other field — including contact details such as `followup_contact` or `email` — is rejected with HTTP 400 and never stored.

## 4. Export

`GET /api/el2test/export` requires header `x-el2-hs-export-token` equal to `EL2_HS_EXPORT_TOKEN`. The token must be at least 32 characters; shorter or missing tokens disable the export. Comparison is constant-time. Wrong/missing token → 404. Responses are `Cache-Control: no-store`. Export contains no contact, IP, or user-agent fields.

## 5. Not covered

- No CAPTCHA or bot challenge. A determined attacker rotating many IPs is bounded only by the global limit.
- No per-session flagging of excessive creation (sessions are deliberately not linked to IP hashes); see `QUALITY-REVIEW.md` for the aggregate approach.
