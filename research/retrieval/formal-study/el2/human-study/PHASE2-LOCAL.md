# EL2 Phase 2 local implementation notes

**Branch:** `research/el2-human-study-phase2`  
**Base:** `069bd51`. The branch was created from a dirty research tree; Phase 1, Phase 2, and batch-1 hardening are committed separately, unrelated research changes stay uncommitted.  
**Do not run migrations, merge, push, or deploy until approved.**

## Frozen dataset

Server loads only:

`research/retrieval/formal-study/el2/human-study/datasets/el2-hs-questions.internal.v1.json`

SHA-256 must equal `1e3b6d1f61974de3f8d24600fe7b51f5e3f53dd9c734d89c2ba725713fc2a4d8`.

The Vite/Nuxt client never imports this file. Participant APIs return Theme labels only (no definitions, no source ids).

## Assignment algorithm (`el2-assignment.v1`)

Implemented in `server/utils/el2hs/assign.ts`, matching `RANDOMIZATION.md`:

1. Group = argmin(completed + inflight); ties → CSPRNG bit.
2. Greedy 10-sample: score(q) = total exposure + |group exposure − group mean|; ties → CSPRNG.
3. Place five quotes in section 1 minimizing historical section1−section2 gap; shuffle both sections.
4. Independent A–D permutation of the four sources; E is always `none`.
5. Persist assignment in the same transaction as the session (MySQL: `el2_hs_assign_lock` `SELECT … FOR UPDATE`). Never rewrite an existing assignment.

Tradeoff: abandoned `in_progress` sessions occupy inflight counters for 24h so bursts cannot pin the same ten quotes. They do not count as completed.

Simulation (memory store, 2 000 synthetic sessions, 10% unsubmitted): group split among completed < 5%, quote-exposure CV < 0.15, section-1 rate per quote in [0.40, 0.60].

## MySQL (not executed)

This checkout has **no `.env`**. Database host is unknown. Do not assume Railway.

Migration `0007` is additive `el2_hs_*` only. It does not alter Library tables.

After you confirm a **development** database that you are willing to alter:

```powershell
# 1. Point DB_* at a confirmed development MySQL (local or otherwise).
# 2. Inspect the target (do not skip this):
pnpm db:migrate:status

# 3. If status prints the intended host/database AND that database is not production:
pnpm db:migrate
```

`scripts/migrate.mjs` refuses Railway-like hosts unless `MIGRATE_ALLOW_REMOTE=1`.

If MySQL is not installed locally, install/start it yourself, create an empty **dev** schema, set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, then re-run status. Do not run SQL until you approve.

## Local questionnaire

- Study mode (`/el2test`): **requires MySQL** after 0007. Returns 503 otherwise.
- Test mode (`/el2test?mode=test`): allowed under `nuxi dev`; a local production build (`node .output/server/index.mjs`) needs `EL2_HS_ALLOW_TEST_MODE=1`. Never on Vercel Production. Full matrix: `SECURITY.md`.
- HTTP smoke test (memory only, after `nuxi build`): `node scripts/el2hs-smoke.mjs`.

Export (protected):

```
GET /api/el2test/export?format=json&mode=test
Header: x-el2-hs-export-token: <EL2_HS_EXPORT_TOKEN>
```

Missing/wrong token → 404. CSV via `?format=csv`.

## Cookie

`el2_hs_sid` = `{64-hex-public-id}.{64-hex-secret}`. HttpOnly, SameSite=Lax, Secure in production. Public id alone cannot load answers. Token stored as SHA-256.

## Tests run locally (no live database)

- `tests/unit/el2hs.test.ts` (28): dataset SHA, assignment, cookie, leak, 2000-session sim, no contact fields (page, copy, migration, export), body-field rejection, environment policy, rate limiter, resume without quota, anonymous submit, Control/Disclosure notice, no definitions, quality flags.
- `research/retrieval/tests/el2-human-study.test.mjs`: frozen dataset integrity. Reads `el2/baselines/*` and gitignored `runs/EL2-*`, so it only passes on a machine that has them.
- `scripts/el2hs-smoke.mjs`: 19 HTTP checks against the built server.
- `npx nuxi typecheck`, `npx nuxi build`: pass.

MySQL integration, browser E2E on real devices, and deployment were **not** run.

## Not implemented

- CAPTCHA / bot challenge.
- Verified Vercel bundling of the internal master.
- Production Vercel deploy, merge to `main`, git push.
- Automatic migration execution.

## Copy v3, anonymity, hardening (2026-10-27)

- Participant copy `el2-hs-copy.v3`; change record `COPY-REVISIONS.md`.
- The v2 optional contact field was removed everywhere before deployment. No contact table, no follow-up export.
- Environment policy, rate limiting, request validation, export token rules: `SECURITY.md`.
- Suspicious-session flags: `QUALITY-REVIEW.md`.

