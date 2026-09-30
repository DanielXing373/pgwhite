# PGWhite documentation

**Current milestone:** [1.1 — Documentation Baseline](releases/1.1-documentation-baseline.md)  
**Working product baseline:** [1.0](releases/1.0-baseline.md) (tag `v1.0` → `63ab96ee2f74b58694cf413357de543f0d0ab041`)

This directory is the **source of truth** for product concepts, roadmap, and accepted architectural decisions for future human contributors and AI coding assistants.

---

## What is PGWhite?

PGWhite (鸽白词句库) turns long-term literary highlights into a searchable, progressively organized personal knowledge library, and allows users to voluntarily contribute organization and interpretations to an evolving community literary knowledge base.

**Core principle:** Import everything. Organize progressively.

---

## What can PGWhite 1.0 already do?

1.0 is a **working admin-operated product**, not an empty scaffold:

- **Retrieval:** Tag / Filter → Result on the homepage (authors, books, characters, times, themes, devices, search)
- **Content ingestion (admin/offline):** curated seed SQL + WeRead → generated SQL → manual apply
- **Engineering foundation for future user Library:** Users, Library Entries, Imports, Import Items, provenance, migrations `0001`–`0005`, historical WeRead reconstruction for Daniel’s library

1.0 does **not** yet productize a live user-facing Import → My Library UI. That is the 1.2–1.5 path. See [releases/1.0-baseline.md](releases/1.0-baseline.md).

---

## Current milestone

| Version | Name | Status |
|---------|------|--------|
| **1.0** | Working Baseline | Complete (`v1.0`) |
| **1.1** | Documentation Baseline | **Current** |
| 1.2 | Live User Ingestion | Next |
| 1.3–1.5 | Normalize → AI → My Library + Result | Planned |

Numeric versions only. See [product/ROADMAP.md](product/ROADMAP.md).

---

## Recommended reading order (before changing code)

1. [product/PRODUCT_MODEL.md](product/PRODUCT_MODEL.md) — product semantics
2. [product/ROADMAP.md](product/ROADMAP.md) — versioned milestones
3. Relevant [decisions/](decisions/) ADRs
4. [database.md](database.md) — schema, migrations, ops
5. Latest [releases/](releases/) note

**Do not** infer current product behavior solely from old code, historical scripts, experimental branches, or previous implementation assumptions. **Product Model + accepted ADRs** are the source of truth for product concepts. Code is evidence of current implementation.

Items marked **OPEN** must not be silently decided by an implementation agent. If an unresolved decision materially affects schema, canonical identity, provenance, Global/Personal semantics, public API behavior, or irreversible data behavior: **stop and request a product decision**.

When Product Model / ADRs conflict with code or schema, **report the conflict explicitly** rather than silently choosing one.

---

## Architectural / product boundaries (1.1)

- Homepage stays **Tag / Filter → Result** (not a dashboard / Import / My Library landing page)
- **Import ≠ Favorite**
- Canonical Quote may participate in Personal and Global layers; interpretations may differ
- Historical WeRead provenance is **reconstructed at batch level**; no synthetic historical ImportItems
- `/api/dev/*` is R&D-only (disabled in production unless `DEV_DATA_TOOLS=1`)
- Do not invent speculative schema or UI for later milestones during earlier ones

---

## What comes next?

**1.2 — Live User Ingestion:** turn the offline/admin WeRead path into an application-level user import path (do not overbuild). Details: [ROADMAP.md](product/ROADMAP.md).

Do not begin 1.2 work from this documentation milestone alone without an explicit product request.

---

## Index

| Path | Purpose |
|------|---------|
| [product/PRODUCT_MODEL.md](product/PRODUCT_MODEL.md) | Product Model v1.1 |
| [product/ROADMAP.md](product/ROADMAP.md) | Numeric roadmap |
| [decisions/](decisions/) | Architecture Decision Records |
| [releases/](releases/) | Frozen release snapshots |
| [database.md](database.md) | Database / migrations / ops |
| [bug-reports/](bug-reports/) | Historical UI bug notes (not product model) |
| [`analysis/`](../analysis/) | Forensic provenance artifacts (not runtime) |
