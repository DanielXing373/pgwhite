# PGWhite Tag Library (research) — 1.41

Initial **Atomic Tag Library** for future local Qwen3 embedding retrieval experiments.

**Research only.** No production `tags` migration. No embeddings in this version.

## Layout

```text
research/tag-library/
  schemas/                 # JSON schemas
  scripts/
    ingest-lto.mjs         # LTO hierarchy extract (local clone)
    build-atomic-library.py
  src/representations.mjs       # A/B/C text representations
  data/
    lto/                   # LTO research extract + attribution
    sources/               # per-provenance extracts
    candidates/            # raw pool + cleanup log
    library/               # final library + representations
  tests/
```

## Commands

```bash
npm run research:taglib:ingest-lto -- --lto-dir /path/to/theming
npm run research:taglib:build
npm run research:taglib:test
```

## Philosophy (short)

A PGWhite Tag is a **semantically atomic, reusable retrieval component**, not a miniature literary analysis.

Prefer `记忆` / `童年` / `亲情` over `音乐唤醒记忆` / `复杂的父子关系`.

Canonical ≠ aliases ≠ related. Empty/unused Tags are acceptable.

See `docs/research/1.41-atomic-tag-library.md`.
