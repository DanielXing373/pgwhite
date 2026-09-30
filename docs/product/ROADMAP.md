# PGWhite Roadmap

**Versioning:** numeric milestones only (`1.0`, `1.1`, `1.2`, …).  
Do **not** use alphabetic suffixes (`1.2A`, Phase A, `1.3D`).

Patch versions (`1.5.1`) are reserved for fixes or small revisions to an already completed milestone.

Do not assign version numbers far into the future unless those milestones have been agreed.

**Current:** 1.2 — Live User Ingestion (accepted on `feature/1.2-live-user-ingestion`; tag after merge)  
**Baseline tags:** `v1.0` (create `v1.1` / `v1.2` on main after review)

---

## 1.0 — Working Baseline — COMPLETE

Existing **admin-operated** upload/import and **Tag / Filter → Result** retrieval.

Also includes the completed identity / provenance foundation required for future user-level Library functionality (Users, Library Entries, Imports, Import Items, migrations `0001`–`0005`, reconstructed historical WeRead membership for Daniel).

Snapshot: [releases/1.0-baseline.md](../releases/1.0-baseline.md)

---

## 1.1 — Documentation Baseline — COMPLETE

Establish repository source of truth:

- Product Model
- ADRs
- release history
- versioning rules
- AI / developer handoff rules

Snapshot: [releases/1.1-documentation-baseline.md](../releases/1.1-documentation-baseline.md)

---

## 1.2 — Live User Ingestion — COMPLETE (acceptance Import #3)

**Goal:** Turn the current offline / admin-oriented WeRead ingestion path into an application-level **user import** path.

Do not overbuild.

**Shipped (R&D Daniel):** `/import` UI + `POST /api/weread/notebooks` + `POST /api/weread/import`. Ephemeral API key. Runtime dual provenance. Highlights + reviews with exact `bookId|chapterUid|range` association. Deterministic Author/Book reuse. Visibility via existing Result `/?books=`. No AI / no canonical matching / no legacy 1169 replacement / no Global–My scoping.

**Validated:** Import #3 — 123 ImportItems (123 successful) → 120 Quotes on two books (27 + 93); difference explained by 3 matched reviews sharing highlight Quotes.

Snapshot: [releases/1.2-live-user-ingestion.md](../releases/1.2-live-user-ingestion.md)

---

## 1.3 — Normalize + Canonical Matching

**Goal:** Normalize imported quote data and classify approximately:

- matched existing canonical quote
- new quote
- ambiguous / possible match

Prefer deterministic / reliable matching before overbuilding semantic deduplication.

Canonical matching details remain **OPEN** in the Product Model / ADR-001.

---

## 1.4 — AI Annotation

**Goal:** Produce useful initial annotations with provenance / confidence while allowing unreviewed AI annotations to participate in My Library retrieval.

---

## 1.5 — My Library + Result Integration

**Goal:** Complete the first proper user vertical slice:

```text
WeRead
  ↓
Import
  ↓
Normalize / Match
  ↓
AI Annotation
  ↓
My Library
  ↓
Homepage Result
```

Homepage begins supporting the conceptual Global / My Library scope.

At 1.5, **stop and use/test** the real workflow before expanding community functionality.

---

## Later / Tentative

Everything beyond 1.5 belongs here until agreed. **No version numbers yet.**

Possible future work:

- publication
- drafts
- contributions
- voting / community support
- Global moderation
- correction workflow
- Favorite
- ambient review
- hybrid / semantic retrieval
- translation workflow
- export / data ownership

---

## AI / developer handoff

Before implementing a new milestone, read:

1. [PRODUCT_MODEL.md](PRODUCT_MODEL.md)
2. This roadmap
3. Relevant [ADRs](../decisions/)
4. [database.md](../database.md)
5. Latest [release note](../releases/)

Do not silently resolve **OPEN** items. See [docs/README.md](../README.md).
