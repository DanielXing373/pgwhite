# Git and deployment plan (no actions taken)

## Current checkout (Phase 1 audit)

- Repo: `C:\Workspace\Projects\pgwhite`
- Branch: `research/1.42-qwen-retrieval` tracking `origin/research/1.42-qwen-retrieval`
- Other locals: `main`, `feat/tagtest-one-at-a-time`
- Remotes include `research/1.4-ai-annotation-workbench` and feature/1.2–1.3 lines
- Single worktree
- `.gitignore` keeps `research/retrieval/formal-study/runs/*` and `archives/*` on disk only
- App deploy surface: Nuxt (`nuxt.config.ts`), Vercel analytics, MySQL via `DB_*` / Railway SSL in `server/utils/db.ts`. No `vercel.json` in-repo.

Do not merge `research/1.42-qwen-retrieval` straight into `main`. That branch mixes retrieval research, untracked EL2 configs, and a dirty tree.

## Recommended workflow

1. Keep immutable EL2 `run.json` gitignored. Copy the `runs/EL2-GPT6LUNA`, `runs/EL2-DSFLASH`, `runs/EL2-EMBED-TOP2`, and `runs/formal-p1-c-task-20261021` directories to any machine that must rebuild datasets. Do not commit them.
2. Land Phase 1 docs + candidate datasets on a **dedicated research branch** cut from the current research line when the working tree is ready (e.g. `research/el2-human-study-phase1`). Review as research, not as a product PR.
3. Phase 2 UI/API: **new branch from `main`** (or from a release tag), cherry-pick only `human-study` protocol files and a **server-side** copy of the internal master placed via deploy secret / non-bundled path. Do not import `el2-hs-questions.internal.v1.json` from `pages/`.
4. Product PR to `main` should contain: `/el2test` page, `el2_hs_*` migration, session APIs, public copy. It must **not** contain Luna/Flash run artifacts or source-labeled masters in the client bundle.
5. Never force-push `main`. Never rebase shared research history in this pass (not authorized).

## Packaging the question dataset for deploy

| Artifact | Git | Deploy |
| --- | --- | --- |
| Internal master | optional research git (private mapping) | server disk / secret; not Vite client |
| Participant-content | research git | QA only |
| EL2 runs | gitignore | rebuild machine only |
| Responses | gitignore `human-study/responses/` | MySQL only |

If the internal master is in git, treat the GitHub repo as confidential research. Do not copy it into a public marketing site repo.

## Environment

*Updated 2026-10-27 (Phase 2 batch 1).* The earlier ideas `EL2_HS_INTERNAL_MASTER` and `EL2_HS_DEFAULT_MODE` were never implemented; ignore them.

Phase 2 reads:

| Variable | Needed | Purpose |
| --- | --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | study mode | existing PGWhite MySQL config |
| `EL2_HS_EXPORT_TOKEN` | export only | ≥ 32 chars; unset disables export |
| `EL2_HS_ALLOW_TEST_MODE` | optional | `1` allows memory-only test mode on Preview / non-Vercel production builds; ignored on Vercel Production |
| `EL2_HS_ALLOW_PREVIEW_STUDY` | optional | `1` allows study mode on Preview; set only with a non-production preview DB |
| `EL2_HS_RATE_LIMIT_PER_CLIENT`, `EL2_HS_RATE_LIMIT_GLOBAL`, `EL2_HS_RATE_LIMIT_WINDOW_SECONDS` | optional | defaults 20 / 300 / 600 s |

None are assumed to be configured on Vercel today. Behaviour per environment: `SECURITY.md`.

The internal master is read from the repo path at runtime; bundling it into the Vercel function is unverified (see `ARCHITECTURE.md`).
