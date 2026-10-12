# PGWhite Retrieval Route Comparison

## Current goal

Compare three technical routes for suggesting Theme tags after quote import. This is a route comparison, not an A/B/C text-representation experiment.

The only active Theme library is `research/tag-library/data/library/atomic-tag-library.v1.43.json` (185 active Themes). All routes in a comparison use this same library and its current canonical label, definition, and alias text. We do not maintain old libraries for compatibility or spend current benchmark samples comparing taxonomy versions. Previous runs and files are historical records, not active development targets.

## The three routes

1. **Direct retrieval**: encode the whole quote, retrieve and rank Themes from the active library.
2. **Generate concepts, then map**: ask a chat model to name concepts expressed in the quote, then map those concepts to Themes in the same active library.
3. **Retrieve, then rerank**: retrieve a candidate pool from the active library, then rerank quote/Theme pairs with a reranker.

Each route receives the same quote text, searches the same Theme library, and returns up to five ordered Theme suggestions. Do not compare the routes on separate quote batches.

## Shared quote set

The first and second user-reviewed batches each contain 29 quotes; there is no quote overlap. They are input sources, not training/test splits. The second batch informed the current library's edits, so results on these 58 quotes are useful for choosing a route during development, but should not be presented as an independent accuracy estimate.

For a route comparison, combine both batches into one shared fixture and resolve all expected labels against the current active library. Run every route on that exact fixture. Keep the three empty-expected quotes for separate inspection of unwanted suggestions; they are not included in positive-label Recall or Success denominators. The quote examples are not used to train these pretrained models.

## What to report

- **Recall@3**, **Recall@5**, and **Success@3** for the manually selected expected Themes.
- Per-quote tagging time and the average time per quote.
- One-time provider/model startup and Theme-index preparation time.
- Estimated time for 1,000 quotes: one-time preparation + mean per-quote time × 1,000.

For each route, timing must cover the complete route for one quote: model inference and its mapping/ranking/reranking steps. The 1,000-quote estimate assumes the runner's current sequential processing and excludes human review and unrelated import/network delays.

## Current implementation status

The retrieval runner implements all three routes and records Recall@3, Recall@5, Success@3, per-quote latency, provider/model preparation, and the estimated sequential time for 1,000 quotes. Existing A/B/C representation configs are historical experiments; they are not the three routes under comparison.

The first completed comparison is recorded in [the 2026-10-12 route comparison report](runs/route-comparison-summary-20261012.md). In that development run, route 3 led on Recall@5 and Success@3, while route 2 was slightly faster. The shared development set informed the current Theme library and is too small to be treated as an independent accuracy estimate.

Local model requirements for the current implementations:

- Route 2 uses a local Ollama chat model (`qwen3.5:4b`) to generate temporary concepts, then the Qwen3-Embedding-0.6B model to map them to Themes. Set `PGWHITE_OLLAMA_MODEL` if using a different Ollama model.
- Route 3 uses Qwen3-Embedding-0.6B for the candidate pool and the local `Qwen/Qwen3-Reranker-0.6B` model for reranking. Set `PGWHITE_RERANKER_MODEL` to its local model directory and `PGWHITE_PYTHON` to the Python executable that has `torch`, `transformers`, and `sentence-transformers` installed. CUDA is required by the current reranker worker.

## Commands

```powershell
# Retrieval plumbing and metric tests (fake provider; no Qwen inference)
pnpm run research:retrieval:test

# Full repository test suite
pnpm test
```

Use new run IDs for new runs so completed reports remain unchanged. The active library path above is the one to use for all current route work.
