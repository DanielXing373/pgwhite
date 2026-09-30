# ADR-002 — Personal and Global Layers

- **Status:** Accepted
- **Date:** 2026-09-30
- **Milestone:** PGWhite 1.1 (Documentation Baseline)

## Context

PGWhite serves both personal reading libraries and a shared literary knowledge base. Users must be able to organize privately without immediately rewriting shared state, while the homepage retrieval experience should eventually span both layers without duplicate cards.

## Decision

1. A canonical Quote may participate in both **Personal** (My Library) and **Global** (community) layers.
2. **My interpretation** and **Global interpretation** may differ.
3. Changing personal tags must not directly modify Global.
4. Homepage remains **Tag / Filter → Result** (already shipping in 1.0); it must not be replaced by a dashboard / Import / My Library landing page.
5. Future default result scope is **Global + My Library**, with filters for Global-only and My Library-only.
6. The same canonical quote in both scopes must **not** produce duplicate result cards; UI may expose both contexts (exact UI **OPEN**).
7. Global is **community knowledge**, not objective literary truth.
8. Minority interpretations may remain visible; low support ≠ automatic deletion or “incorrect.”

## Consequences

- Schema and APIs for personal vs global interpretation sets are future work (post–1.5 community features remain unversioned).
- Current Result APIs search the shared quote corpus without Library scope filters — a known gap vs future Product Model (report as conflict until 1.5).
- Daniel’s 1169 WeRead Library Entries (Sprint 1C) are personal membership only; they do not change Global Result behavior today.

## Alternatives considered

- Homepage becomes My Library-first — rejected for 1.x product direction.
- Global overwrites personal on conflict — rejected.
- Majority-wins single Global interpretation — rejected; multiple interpretations may coexist.

## Open questions

- Exact dual-context Result UI and scope control UX.
- Aggregation / voting / ranking for community support.
- How Favorite (future) interacts with Import membership for Result scoping.
