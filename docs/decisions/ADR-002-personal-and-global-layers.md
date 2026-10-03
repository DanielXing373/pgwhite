# ADR-002 — Personal and Global Layers

- **Status:** Accepted (updated 1.3)
- **Date:** 2026-09-30; updated 2026-10-03
- **Milestone:** PGWhite 1.1 baseline; coexistence clarified in 1.3

## Context

PGWhite serves both personal reading libraries and a shared literary knowledge base. Users must be able to organize privately without immediately rewriting shared state, while the homepage retrieval experience should eventually span both layers without duplicate cards.

## Decision

1. A literary passage may exist as **both** a Personal Quote artifact and a Community Quote artifact related by canonical matching — they **coexist** and are not merged.
2. **My interpretation** and **Community interpretation** may differ and must not auto-sync.
3. Changing personal tags/annotations must not directly modify Community.
4. Homepage remains **Tag / Filter → Result** (already shipping in 1.0); it must not be replaced by a dashboard / Import / My Library landing page.
5. Future default result scope is **Community + My Library**, with filters for Community-only and My Library-only.
6. **1.3 clarification (overrides earlier “no duplicate cards” reading):** when Personal and Community both have related Quotes, future Result may show **both** cards (Personal text/tags/annotations vs Community interpretation). Prefer extra relevant results over missing personal history. Exact dual-context UI remains **OPEN** (not in 1.3).
7. Community is **community knowledge**, not objective literary truth.
8. Minority interpretations may remain visible; low support ≠ automatic deletion or “incorrect.”
9. My Library is permanent ownership, not temporary staging. Publication rejection never damages Personal data.

## Consequences

- Schema and APIs for personal vs global interpretation sets are future work (post–1.5 community features remain unversioned).
- Current Result APIs search the shared quote corpus without Library scope filters — a known gap vs future Product Model (report as conflict until 1.5).
- Daniel’s 1169 WeRead Library Entries (Sprint 1C) are personal membership only; they do not change Global Result behavior today.

## Alternatives considered

- Homepage becomes My Library-first — rejected for 1.x product direction.
- Global overwrites personal on conflict — rejected.
- Majority-wins single Global interpretation — rejected; multiple interpretations may coexist.

## Open questions

- Exact dual-context Result UI (including future Personal vs Community visual distinction) and scope control UX.
- Aggregation / voting / ranking for community support.
- How Favorite (future) interacts with Import membership for Result scoping.
- Contribute-to-existing-Community-Quote workflow after MATCHED.
