# EL2 Phase 2 architecture

Implemented locally on `research/el2-human-study-phase2`; database integration and deployment pending.

## Recommendation

Keep research data in the **existing MySQL** (Railway) as `el2_hs_*` tables. Reasons: one backup domain, `mysql2` already in the Nuxt server, no new vendor. Isolation is by table prefix and API, not by a second database, unless legal review later requires physical separation.

Do not put assignments in Postgres, KV, or the Git repo.

## Runtime split

```
Browser /el2test  (client-rendered; copy bundled from server/utils/el2hs/copy.ts, refreshed via GET /meta)
  → GET  /api/el2test/session          recover by HttpOnly cookie el2_hs_sid
  → POST /api/el2test/session  { consented, study_mode }      (no other fields accepted)
       policy.ts: is this mode allowed in this environment?   → 403
       resume in-progress session from cookie, if any          (not rate-limited)
       rateLimit.ts: per-client + global window                → 429
       server reads INTERNAL master from disk
       writes el2_hs_session + assignment items (assignment stays on server)
       returns: group, page instructions, page-2 notice (Disclosure only),
                questions: [{ quote_id, text_zh, author, book, options: [{key, themes:[{label_zh}]}] }]
                NO source_id, model_id, run_id, definitions
  → POST /api/el2test/draft  { answers[] }
  → POST /api/el2test/submit { answers[] }   idempotent; the ten answers are the whole submission
  → GET  /api/el2test/export                 token-protected; research rows + quality_flags
```

No contact, follow-up, or free-text input exists anywhere in the flow. Security details: `SECURITY.md`.

The participant-content JSON may be used as a **quote text catalog** in tests. Production serving of options must go through the internal master + stored permutation so A–D cannot be reverse-mapped from file order.

`theme_set_id` in the public catalog is `sha256(dataset_version|quote_id|source_id)[:16]`. Brute-forcing four known source ids is possible if that formula is public; therefore **do not send theme_set_id to the browser**. Send only `{ key: "A"|"B"|"C"|"D", themes: [...] }`.

## Paths

| File | Role | Client? |
| --- | --- | --- |
| `datasets/el2-hs-questions.internal.v1.json` | source mapping | **no** |
| `datasets/el2-hs-questions.participant-content.v1.json` | catalog / QA | no production bundle |
| gitignored `runs/EL2-*` | evidence | no |

Phase 2 `pages/el2test.vue` must not `import` the internal JSON, `constants.ts`, or anything holding source ids; it imports only `server/utils/el2hs/copy.ts`. The server loads the master with `fs` from the repo path and verifies its SHA-256.

**Open deployment question:** on Vercel the serverless bundle only includes files Nitro can trace. A runtime `readFileSync` of a repo path is not traced, so the master must be explicitly included (e.g. Nitro `serverAssets`) or the function will fail at startup. Not yet verified; see `PHASE2-LOCAL.md`.

## Existing API conventions to copy

- `server/utils/db.ts` pool (`getDbPool`)
- Runtime config `DB_*` from `nuxt.config.ts`
- JSON POST handlers under `server/api/`
- Read-only vs mutation: research routes are the only writers to `el2_hs_*`

Do not reuse `server/api/quotes.get.ts` for the questionnaire.
