# ADR-001 — Canonical Content

- **Status:** Accepted (updated 1.3)
- **Date:** 2026-09-30; updated 2026-10-03
- **Milestone:** PGWhite 1.1 baseline; matching rules closed in 1.3

## Context

PGWhite stores literary quotes from curated corpora and WeRead imports. The same underlying passage may appear with superficial formatting differences. Deduplication must not destroy Personal ownership or auto-publish to Community.

## Decision

1. Conceptual hierarchy is **Author → Book / Edition → Quote**.
2. **Dedup means relationship detection, not merge.** A MATCHED Personal Quote remains its own Quote row with its own text/tags/annotations/provenance.
3. Matcher outcomes: **MATCHED** | **POSSIBLE_MATCH** | **NO_MATCH**, with publication eligibility **personal_only** | **publication_unresolved** | **publication_eligible**.
4. Automatic MATCHED (v1) requires safe **normalized exact equality** within Book scope (and Chapter gate when both sides have source chapter ids). Similarity scores support candidate ranking / POSSIBLE_MATCH only — never sole auto-match.
5. Different Books → no match. Different source chapters (when both known) → no match. Textual score 1.0 cannot override structural gates.
6. Different translations or materially different editions may remain distinct Quotes.
7. PGWhite does **not** decide which literary translation is objectively best.
8. Matcher never publishes, never merges bidirectional content, and never represents user consent.

## Consequences

- Schema: `quote_match_relations`, `quotes.corpus_layer`, chapter source/display fields, `publication_eligibility`, `personal_annotations` (migration `0006`).
- Future Publish Quote vs Contribute are distinct actions; MATCHED blocks normal Publish Quote of a duplicate Community copy.
- Benchmark harness remains a regression asset; real cross-edition calibration is future work.

## Alternatives considered

- Merge/delete duplicate rows — rejected (destroys Personal history).
- Single global similarity threshold — rejected (benchmark FP risks: negation/entity swaps ~0.99).
- Immediate embedding-based semantic dedup — deferred.

## Open questions

- When to promote POSSIBLE_MATCH bands using real cross-edition WeRead pairs.
- How bilingual curated rows (1–118 zh/en pairs) relate to edition identity long-term.
- Exact Contribute review/moderation workflow (post-1.3).
