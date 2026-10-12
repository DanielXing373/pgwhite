# Retrieval route comparison — current development plan

This document replaces the earlier v1.42 runner plan. The active objective is to compare three quote-to-Theme routes on the same quote set and the same current Theme library:

1. Whole-quote direct retrieval.
2. Generate concepts, then map them to the Theme library.
3. Retrieve candidate Themes, then rerank them for the quote.

The active Theme library is `research/tag-library/data/library/atomic-tag-library.v1.43.json` (185 active Themes). A/B/C are text representation experiments from earlier research; they are not the current route comparison. Older taxonomy files and results are historical, not versions that current development needs to maintain or support.

The first and second reviewed quote batches are both inputs to one shared development comparison set. They are not randomly split into model-training and test sets. The pretrained models are not trained on these quotes. Every route must receive the same quote inputs and current Theme library. Compare Recall@3, Recall@5, Success@3, and per-quote / 1,000-quote processing time.

Current runner status: all three routes have been implemented and run on the same 58-quote development fixture. The first comparison is in [the run report](../../research/retrieval/runs/route-comparison-summary-20261012.md). It is a development comparison, not an independent accuracy estimate.

See [the current route comparison protocol](../../research/retrieval/docs/theme-workflow-comparison-protocol.v1.md) for the shared benchmark and metric definitions.
