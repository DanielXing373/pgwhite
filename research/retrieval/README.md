# PGWhite 1.42 — Retrieval research tree

Portable **Existing-Tag Retrieval Benchmark** for Qwen3-Embedding experiments.

Base: accepted **PGWhite 1.41** (`v1.41`).

## Layout

```text
research/retrieval/
  README.md, docs/setup.md
  config/                      # including exp0.1-qwen06b.retrieval.v1.json
  schemas/
  benchmark/fixtures/          # smoke, exp0.1 exploratory, calib-zh-themes scaffold
  docs/calibration-rules.md    # manual GT rules for A/B/C Recall@K
  runner/src/                  # loaders, match, providers, rank, eval
  runner/python/               # Sentence Transformers Qwen3 worker
  runner/scripts/              # CLI
  runs/                        # immutable experiment outputs
  tests/
```

Authoritative Tag Library (do not duplicate):

`research/tag-library/data/library/atomic-tag-library.v1.json`

## Commands

```bash
# Infrastructure smoke (fake provider)
npm run research:retrieval:run -- --representation A --run-id local-smoke-fake-A

# Experiment 0.1 on CUDA machine (see docs/setup.md)
npm run research:retrieval:run -- --config research/retrieval/config/exp0.1-qwen06b.retrieval.v1.json --provider qwen3 --representation A --run-id exp0.1-qwen06b-A
npm run research:retrieval:run -- --config research/retrieval/config/exp0.1-qwen06b.retrieval.v1.json --provider qwen3 --representation B --run-id exp0.1-qwen06b-B
npm run research:retrieval:run -- --config research/retrieval/config/exp0.1-qwen06b.retrieval.v1.json --provider qwen3 --representation C --run-id exp0.1-qwen06b-C

# Validate calibration fixture (draft empty quotes → warning OK)
npm run research:retrieval:validate-calib

npm run research:retrieval:test
```

Calibration ground truth is populated **manually** into `benchmark/fixtures/calib-zh-themes.v1.json` (see `docs/calibration-rules.md`). Do not invent expected Themes in Cursor.

Completed runs refuse overwrite. Use a new `--run-id` for material config changes.

## Providers

| id | Role |
|----|------|
| `fake` | Deterministic plumbing tests only (default in unit tests) |
| `qwen3` | Local `Qwen/Qwen3-Embedding-0.6B` via Sentence Transformers + CUDA (`require_cuda=true` by default) |

## Representations (1.41 semantics)

- **A** label only  
- **B** `label：definition`  
- **C** `label：definition｜别名：…` (related excluded)

## Deterministic evidence vs semantic ranking

Exact substring hits for canonical/alias forms are recorded separately from cosine ranking. They do **not** boost similarity scores.
