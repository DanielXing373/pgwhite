# Phase 2 checklist

## Blockers from Phase 1

- [x] Author/book for `batch2-batch2-004` and `-007` → 索拉里斯星 / 莱姆; `-013` → 荒原狼 / 黑塞 (`human-attribution-overrides.v1.json`)
- [x] Dataset `freeze_status=frozen` (question content).
- [ ] Ethical/copyright review for showing author/book on a public link
- [ ] Confirm `/el2test` may go on the production Nuxt host without Library navigation

## Implementation (local)

- [x] Branch `research/el2-human-study-phase2` (not cut from `main`; see `PHASE2-LOCAL.md` for commit layout)
- [x] Session assigner `el2-assignment.v1` with tests + 2000-session simulation
- [x] Server loads internal master; client never sees `source_id` or definitions
- [x] Copy `el2-hs-copy.v3` (`CONSENT.md`, `COPY-REVISIONS.md`) — UI and wording approved by researcher
- [x] UI per `UI-SPEC.md`
- [x] Idempotent submit; ten answers are the whole submission
- [x] No contact-information collection; unexpected request fields rejected
- [x] Test mode restricted server-side per environment (`SECURITY.md`)
- [x] Session-creation rate limiting (MySQL-backed; **unverified against a real DB**)
- [x] Suspicious-session flags at export (`QUALITY-REVIEW.md`)
- [ ] Migration 0007 on a **non-production** database (needs approval)
- [ ] MySQL integration tests: concurrent assignment, idempotent submit, draft, 24 h expiry, rate limiter, export
- [ ] Confirm the internal master is bundled into the Vercel serverless function
- [ ] Vercel Preview with `EL2_HS_ALLOW_TEST_MODE=1` (memory) or a separate preview DB + `EL2_HS_ALLOW_PREVIEW_STUDY=1`

## Launch

- [ ] Production migration (approval)
- [ ] `EL2_HS_EXPORT_TOKEN` (≥ 32 chars) set in Production only
- [ ] Pilot with 5–10 real readers
- [ ] Shared link only
- [ ] Backup verified
- [ ] Export on a locked workstation

## Explicitly out of scope until authorized

Paid model reruns, repairing Flash invalid IDs, merging into `main`, pushing, deploying, executing SQL.
