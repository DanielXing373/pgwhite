# Calibration rules — PGWhite 1.42 Theme retrieval

Purpose: manually curated frozen Quotes with expected active Themes, used to compare Representations **A / B / C** via **Recall@5 / @10 / @20**.

This is a **retrieval benchmark**, not a training dataset.

Fixture scaffold:

- `research/retrieval/benchmark/fixtures/calib-zh-themes.v1.json`
- Config (for later runs): `research/retrieval/config/calib-zh-themes.retrieval.v1.json`

Authoritative Theme universe:

- `research/tag-library/data/library/atomic-tag-library.v1.json`
- Only `dimension=theme` and `status=active_candidate` (**217** Themes)

## Ground-truth authorship

1. **Choose expected Themes before looking at retrieval results** for that Quote (including A/B/C rankings and Experiment 0.1 outputs used as inspiration only).
2. Expected Themes must already exist in the active 217-Theme library.
3. **Do not create new Themes** during calibration.
4. **Do not change expected answers after seeing A/B/C results** merely to improve metrics.
5. Prefer recording both `expected_theme_ids` and matching `expected_theme_labels` (canonical Chinese).
6. Do **not** use GPT/model-generated labels as ground truth.

## What to record separately (do not silently mutate GT)

| Situation | Action |
|-----------|--------|
| Important concept missing from the 217 Themes | Record a **taxonomy gap** (`ambiguity_flags`: `taxonomy_gap` and/or `taxonomy_gap:<label>`); leave that label out of `expected_theme_*`; do not invent or substitute a nearby Theme |
| Manual marker `无` (no Theme applies) | Empty `expected_theme_*` with `ambiguity_flags: ["zero_theme"]` |
| Expected Theme itself is debatable / abstraction unclear | Set `ambiguity_flags` and notes; keep GT honest |
| Retrieval ranks expected Theme poorly | Leave as **retrieval failure** evidence |

Frozen fixtures may include empty-expected Quotes **only** when `zero_theme` and/or `taxonomy_gap` metadata is present.

Use `analysis.json` on runs (or Quote `notes` / `ambiguity_flags`) for post-hoc classification. Do not rewrite the frozen fixture to chase scores.

## Coverage targets (when populating)

Aim for roughly **20–30** Chinese literary-style Quotes spanning:

- **Lexical / explicit** — surface forms close to canonical or alias
- **Implicit / semantic** — Theme present without obvious keyword
- **Multi-theme** — several expected Themes per Quote
- **Nearby / confusable** — concepts that embeddings may mix (e.g. 悲伤 vs 遗憾)
- **Taxonomy stress** — cases that pressure abstraction boundaries

Suggested `test_purpose` values:

- `lexical_explicit`
- `semantic_implicit`
- `multi_theme`
- `confusable`
- `taxonomy_stress`

`category` may remain `calib` (or similar).

## Lifecycle

| `status` | Meaning |
|----------|---------|
| `draft` | Scaffold or work-in-progress; quotes may be empty |
| `frozen` | Manual GT locked for A/B/C comparison; do not edit to improve metrics |

Validate:

```bash
npm run research:retrieval:validate-calib
```

## Running (after population)

Use the existing retrieval runner (fake for plumbing; `qwen3` on the CUDA machine). Do not overwrite Experiment 0.1 run IDs.

Example (after quotes are populated and status → `frozen`):

```bash
npm run research:retrieval:run -- --config research/retrieval/config/calib-zh-themes.retrieval.v1.json --provider fake --representation A --run-id calib-smoke-fake-A
```

## Explicit non-goals

- Not Experiment 0.1 exploratory ranking
- Not production Tag assignment
- Not training / fine-tuning data
- Not automatic Theme invention
