# ADR-001 — Canonical Content

- **Status:** Accepted
- **Date:** 2026-09-30
- **Milestone:** PGWhite 1.1 (Documentation Baseline)

## Context

PGWhite stores literary quotes that may arrive from curated corpora, WeRead imports, and (later) other sources. The same underlying passage may appear with superficial formatting differences, or as distinct translations / editions. The product needs a clear conceptual identity without claiming literary authority over “best” translations.

## Decision

1. Conceptual hierarchy is **Author → Book / Edition → Quote**.
2. Quote identity should eventually consider author, book, edition/translation context, and **normalized** quote text.
3. Superficial differences (punctuation, whitespace, formatting noise, attribution suffixes already represented structurally) should be candidates for normalization / matching.
4. Different translations or materially different editions may remain **distinct** Quotes.
5. PGWhite does **not** decide which literary translation is objectively best.
6. Exact canonical matching implementation remains **OPEN** (planned consideration in 1.3).

## Consequences

- Deduplication and “same quote” UX must wait on an explicit matching decision (1.3+).
- Admin/offline imports today create distinct MySQL `quotes` rows; historical WeRead rows were not merged with curated rows even when authors overlap.
- Future Global + My Library results must reason about canonical identity to avoid duplicate cards (see ADR-002).

## Alternatives considered

- Treat every imported string as permanently unique forever — rejected as product direction; progressive organization requires matching later.
- Force a single “canonical translation” per work — rejected; product explicitly avoids best-translation judgment.
- Immediate embedding-based semantic dedup as primary matcher — deferred; prefer deterministic matching first (roadmap 1.3).

## Open questions

- Exact normalization rules and identity key.
- How bilingual curated rows (separate zh/en quote rows in the 1–118 corpus) relate to future edition/translation identity.
- Whether WeRead-origin and curated-origin passages that are textually near-identical should ever merge, and under what provenance rules.
