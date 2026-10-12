# PGWhite Tag Library — current working library

The current Theme source of truth for development and retrieval-route comparisons is:

`research/tag-library/data/library/atomic-tag-library.v1.43.json`

It currently contains 185 active Themes. All three route experiments use this same library and its canonical labels, definitions, and aliases. Update the current library forward as the taxonomy improves; do not spend development time preserving older library variants or adding backward-compatibility behavior. Older files and runs may remain as source-control history, but they are not active targets.

The current library was assembled from the user's reviewed Theme cleanup and second quote batch. Those quote annotations informed the library, so the batch is useful for development comparisons, not an independent accuracy claim.

## Layout

```text
research/tag-library/
  schemas/                 # JSON schemas
  scripts/                 # source ingestion and library build utilities
  src/                     # Theme document representations
  data/
    lto/                   # LTO research extract and attribution
    sources/               # provenance extracts
    candidates/            # raw candidate pool and cleanup log
    library/               # current working library and representations
  tests/
```

## Commands

```powershell
pnpm run research:taglib:test
```

The retrieval route comparison and its shared quote set are documented in `research/retrieval/docs/theme-workflow-comparison-protocol.v1.md`.

## Design principle

A PGWhite Theme is a semantically atomic, reusable retrieval component, not a miniature literary analysis. Prefer `记忆` / `童年` / `亲情` over quote-specific phrases such as `音乐唤醒记忆` / `复杂的父子关系`. Canonical labels, aliases, and related concepts remain distinct fields.
