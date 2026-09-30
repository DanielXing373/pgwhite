# PGWhite Product Model v1.1

**Status:** Accepted for documentation baseline (milestone 1.1)  
**Applies to:** intended product semantics from 1.1 onward  
**Related:** [ROADMAP.md](ROADMAP.md) · [ADRs](../decisions/) · [database.md](../database.md)

This document describes the **current accepted product model**, not implementation archaeology.

**Do not** treat historical scripts, experimental branches, or unfinished UI as overrides of this model. Code is evidence of what is implemented today; this document + accepted ADRs define intended product semantics. Conflicts must be reported explicitly.

Items marked **OPEN** must not be silently decided by implementation agents.

---

## Product thesis

PGWhite turns long-term literary highlights into a searchable, progressively organized **personal knowledge library**, and allows users to voluntarily contribute their organization and interpretations to an evolving **community literary knowledge base**.

### Core principle

**Import everything. Organize progressively.**

Users should receive value before completing cleanup or review.

---

## Canonical Content

Conceptual hierarchy:

```text
Author
  ↓
Book / Edition
  ↓
Quote
```

Quote identity should eventually consider:

- author
- book
- edition / translation context
- normalized quote text

Normalization may handle:

- punctuation differences
- whitespace
- formatting noise
- attribution suffixes when attribution is already represented structurally

Different translations or materially different editions may remain distinct.

PGWhite does **not** determine which literary translation is objectively “best.”

**OPEN:** Exact canonical matching algorithm and identity rules.

---

## Personal Layer

Conceptually:

```text
User
  ↓
My Library
  ↓
Personal Interpretation
```

- Imported content belongs to **My Library**.
- In the future, users may also **Favorite** Global quotes into My Library.
- **Import is not Favorite.** These are different relationships / provenance.

Personal interpretation may differ from Global interpretation.

Changing personal tags must **not** directly modify Global.

AI-generated annotations may participate in personal retrieval **before** human verification.

**Unverified does not mean unusable.**

---

## Community / Global Layer

Global is an evolving **community knowledge layer**.

It is **not** an objectively correct literary answer.

- A quote’s first accepted public contribution may establish its initial Global state.
- Global publication includes quote text, relevant structured metadata, and tags/annotations intended for publication.
- Users may keep content private. Publication is voluntary.
- Minority interpretations may remain valuable even with low community support.
- Low support must **not** automatically mean deletion or incorrectness.

**OPEN:** Exact aggregation / voting / ranking behavior.

---

## Result / Homepage

The homepage remains centered on the existing direct relationship:

**Tag / Filter → Result**

This is already working and important in PGWhite 1.0.

Do **not** replace the homepage with a dashboard, import screen, or My Library landing page.

### Future default result scope

**Global + My Library**

Future scope filtering should conceptually support:

- Global + My Library
- Global
- My Library

If the same canonical quote exists in both, it should **not** produce duplicate result cards.

The result should expose both contexts and may allow switching:

Global interpretation ⇄ My interpretation

**OPEN:** Exact UI for dual-context results and scope controls.

---

## AI Annotation

PGWhite does **not** currently aim to train a personalized AI model per user.

Initial AI annotation should prioritize obvious / high-confidence structure.

- AI confidence helps decide what may deserve human attention.
- AI confidence is **not** literary truth.
- AI provenance should eventually be visible at an interpretation / annotation-set level rather than repeating an “AI generated” marker beside every individual tag.

**OPEN:** Future assistance levels and exact confidence UX.

---

## Draft and Contribution

Personal modifications do not directly change Global.

Conceptually:

```text
Personal changes
      ↓
Saved Draft
      ↓
Publish
      ↓
Atomic Contribution
      ↓
Review / Vote / Moderation
      ↓
Possible Global update
```

- One Publish action creates one coherent contribution.
- The backend may preserve field-level diffs.
- Do **not** require field-by-field publication.
- Rejected contributions may be revised and submitted again.
- The product may gently surface unpublished improvements, but must **not** create review debt.

---

## Correction vs Interpretation

### Correction

Relatively factual issues such as:

- quote text errors
- author / book / edition metadata errors
- attribution errors
- corrupted formatting

### Interpretation Contribution

Subjective literary interpretation such as:

- theme
- rhetorical device
- other interpretive annotations

These may eventually use different review mechanisms.

---

## Community support

Do **not** model Global as simple majority-wins consensus.

Multiple interpretations may coexist with different community support.

A low-support interpretation may still be valuable.

**OPEN:** Voting denominator, weighting, aggregation, ranking, and visualization.

---

## Moderation

Keep separate:

| Axis | Meaning |
|------|---------|
| **Integrity** | Duplicate, corrupted, malformed, meaningless, or clearly invalid data |
| **Safety** | Potentially sensitive / inappropriate public content needing screening |
| **Community Quality** | Whether a contribution meaningfully improves or extends Global knowledge |

Do **not** collapse these into one moderation score.

---

## Terminology (must not conflate)

| Term | Meaning |
|------|---------|
| **Import** | External highlight/content entering PGWhite (e.g. WeRead) |
| **Favorite** | Future PGWhite-native action on an existing Quote into My Library |
| **Library Entry** | Membership: this Quote is in this User’s personal library |
| **Quote** | Canonical literary content entity |
| **Global** | Community knowledge layer over Quotes |
| **My Library** | Personal layer for a User |

See also [ADR-003](../decisions/ADR-003-import-and-provenance.md).
