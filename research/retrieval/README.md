# PGWhite 1.42 — Retrieval research tree

Portable **Existing-Tag Retrieval Benchmark** foundation for Qwen3-Embedding experiments.

Base: accepted **PGWhite 1.41** (`v1.41`).

This tree does **not** download models. Default provider is a deterministic **fake** embedder for infrastructure tests.

## Layout

```text
research/retrieval/
  README.md
  docs/setup.md
  config/default.retrieval.v1.json
  schemas/
  benchmark/fixtures/          # versioned inputs (synthetic smoke only for now)
  runner/src/                  # loaders, match, providers, rank, eval
  runner/scripts/              # CLI
  runs/                        # immutable experiment outputs (gitkeep + committed small runs)
  tests/
```

Authoritative Tag Library (do not duplicate):

`research/tag-library/data/library/atomic-tag-library.v1.json`

## Commands

```bash
# Infrastructure smoke (fake provider; writes a run)
npm run research:retrieval:run -- --representation A --run-id local-smoke-fake-A

npm run research:retrieval:run -- --representation B --run-id local-smoke-fake-B
npm run research:retrieval:run -- --representation C --run-id local-smoke-fake-C

# Dry-run (no artifact write)
npm run research:retrieval:run -- --representation A --run-id tmp --dry-run

# Tests
npm run research:retrieval:test
```

Completed runs refuse overwrite. Use a new `--run-id` for material config changes.

## Representations (1.41 semantics)

- **A** label only  
- **B** `label：definition`  
- **C** `label：definition｜别名：…` (related excluded)

## Deterministic evidence vs semantic ranking

Exact substring hits for canonical/alias forms are recorded separately from cosine ranking. They do **not** boost similarity scores.

## Future Qwen (experiment machine)

See `docs/setup.md`. Provider id `qwen3` is reserved and currently fails loudly until implemented on the RTX machine workflow.
