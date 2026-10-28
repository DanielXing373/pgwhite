# EL2 Human Preference Study — Design

**Versions:** dataset `el2-hs-questions.v1` · protocol `el2-human-preference.protocol.v1` · randomization `el2-assignment.v1`  
**Status:** Phase 1 dataset `el2-hs-questions.v1` is **frozen** for question content. Three quotations use human-adjudicated author/book (`human-attribution-overrides.v1.json`); frozen `text_zh` is unchanged. Phase 2 questionnaire implemented locally with participant copy `el2-hs-copy.v3` (Amendment 1, `COPY-REVISIONS.md`); not deployed, no database, no real responses.

## Research intent

Chinese readers see one frozen literary quotation and four anonymous Theme sets. We ask which set they prefer. Human Gold is **not** an answer key. The study measures preference, not Theme-selection accuracy.

Primary question: which of four Theme annotation sources do Chinese readers prefer for the same quotation?

Secondary, exploratory: does a truthful statement that the page contains AI-generated Theme sets change selections, or increase 「都不满意」 (option E; 「以上都不合适」 in the v1 copy)?

This is not a general AI-trust survey. The disclosure names possible AI involvement in Theme tagging for that page only. It does not measure attitudes toward AI in the abstract.

## Conditions

Anonymous, Chinese, mobile-first, shared `/el2test` link. No demographics, reading-habit, AI-trust questionnaire, or contact/follow-up field.

Each participant answers exactly 10 unique quotations from the eligible pool of 20: two pages of five vertically stacked excerpts. Four anonymous Theme-set cards (A–D, Theme names only, no definitions) plus E = 都不满意. No defaults.

Random assignment:

- **Control:** pages 1 and 2 use neutral instructions.
- **Disclosure:** page 1 neutral; page 2 uses the same neutral instructions plus a bold line 「请注意，本页包含 AI 生成的标签组。」.

Both groups see the same four underlying sources. The disclosure is truthful (every excerpt shows the Luna and Flash Theme sets among A–D) and must not claim that every option is AI-generated.

## Eligibility (population for inference)

The original EL2 benchmark has 58 quotations. Inference is **conditional on the 20 quotations** where:

1. All four sources have valid outputs.
2. Every selected Theme ID is an `active_candidate` in ontology `a71db8ba…ed39b7`.
3. The four Theme-ID sets are pairwise distinct as **unordered** sets (empty sets that match count as duplicates).
4. Display order inside a source is the original recorded order.

Do not claim results represent all 58 quotations. Flash invalid outputs were not repaired. Collisions were not repaired.

Eligible IDs: see `EXCLUSION-REPORT.md` and `EXPECTED_ELIGIBLE_QUOTE_IDS`.

## Sources (private)

| Internal id | Origin | Theme count |
| --- | --- | --- |
| `human-gold` | Frozen human annotation, untruncated | 0–5 |
| `embedding-top2` | Frozen C-task ranks 1–2 | always 2 |
| `gpt-6-luna` | EL2-GPT6LUNA, 0–2 | 0–2 |
| `deepseek-flash` | EL2-DSFLASH, 0–2 | 0–2 |

Theme-count differences are visible to participants as longer or shorter cards. Do not pad or trim. Gold on the eligible pool still varies (1–5 Themes); empty-Gold quotes did not survive collision screening.

## Hypotheses (pre-specified)

H1 (primary, exploratory): source preference ranks are not uniform among A–D after mapping through the private assignment.

H2 (secondary): Disclosure-group page 2 has a higher rate of E than Control page 2.

H3 (secondary): Disclosure-group page 2 shifts mass away from Luna/Flash relative to Control page 2.

No confirmatory power analysis. Target n is operational (enough completed sessions to fill 10-quote forms), not a registered RCT.

## Statistical analysis plan

Unit of analysis: one selected option per question, with private map from `{session, question}` → `source_id` or `none`.

Primary descriptive tables:

- Counts and percentages of Gold / Embedding / Luna / Flash / E, overall and by group × section.
- Per-quotation source shares (n is small; 20 items × 10 of 20 shown).

Exploratory models (if n permits): mixed multinomial or Bradley–Terry among A–D, random intercept for participant and quotation; E as a separate opt-out. Do not treat Gold as truth in these models.

Limitations: 20-item pool is batch2-heavy (14/20), contains one EL1-pilot quote, no empty-Gold items, and excludes 7 Flash-invalid plus 31 collision-only quotes. Theme-count leakage (Gold often longer) can drive preference. Opaque `theme_set_id` hashes must not appear in public write-ups as if they were source names.

## Ethics and privacy

Anonymous sessions. No account. No names, emails, phone numbers, WeChat IDs, or other contact details; the server rejects unexpected request fields rather than storing them. No raw IPs or user agents. Store only a high-entropy session token (hashed at rest). Abuse control keeps transient, salted IP hashes that are not linked to sessions (`SECURITY.md`). Retain research rows under a documented retention window (see `DATA-DICTIONARY.md`). Participants can close the tab; incomplete sessions are not published.

This protocol is research documentation, not an IRB determination. Local ethical review should confirm anonymous preference data and quotation copyright display (author/book shown when verified).

## Reproducibility

Rebuild: `node research/retrieval/formal-study/el2/human-study/scripts/build-human-study-dataset.mjs`  
Requires local gitignored EL2 runs. Do not call paid APIs. Frozen hashes: ontology `a71db8ba…`, benchmark `5ad71ae6…`, retrieval `570f9916…`.
