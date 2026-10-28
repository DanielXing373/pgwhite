# EL2 Human Preference Study — Protocol

**Protocol version:** `el2-human-preference.protocol.v1`, with **Amendment 1** (2026-10-27, copy `el2-hs-copy.v3`)  
**Dataset version:** `el2-hs-questions.v1` (frozen)

> **Amendment 1.** Participant-facing wording and display changed before any data collection (no real responses exist). Full record, including the superseded v1 strings: `COPY-REVISIONS.md`. The sections below describe the amended protocol. Superseded v1 rules: per-question prompt 「请选择你认为最能概括这段文字主题的一组标签。」; options showed labels + definitions; E was 「以上都不合适」; the disclosure was a long sentence inside the page-2 instructions.

## Participant flow

1. Open shared `/el2test` URL (no Library homepage required).
2. Welcome + research description + informed consent.
3. Server creates a session, assigns Control or Disclosure, assigns 10 quote IDs, section placement, within-section order, and A–D mappings. Assignment is written once.
4. Page 1: five excerpts, page-1 instructions (neutral).
5. Page 2: five excerpts, page-2 instructions (identical for both groups) plus, for Disclosure only, the bold disclosure line.
6. Submit the ten choices (idempotent). Confirmation + thank-you. Nothing else is collected; there is no contact or follow-up field.

Refresh reloads the same assignment (cookie + server draft). Pressing 同意并开始 again with an in-progress session resumes it instead of creating a new one. Back navigation keeps answers. Closing without submit leaves `completion_status = in_progress` then `abandoned` after the timeout in `RANDOMIZATION.md`.

## Instructions by page

Exact Chinese strings: `CONSENT.md`.

| Group | Questions 1–5 | Questions 6–10 |
| --- | --- | --- |
| Control | Neutral | Neutral |
| Disclosure | Neutral | Neutral + bold 「请注意，本页包含 AI 生成的标签组。」 |

The disclosure line is chosen on the server from the stored group and sent only to Disclosure sessions for page 2.

## Excerpt UI

- Quotation (frozen `text_zh`) with a red required asterisk and number, then a right-aligned citation 「——作者《书名》」 using verified or human-adjudicated attribution for all 20 eligible items (nationality brackets stripped for display).
- No per-excerpt prompt; instructions appear once per page.
- Options A–D in one row: Theme **names only** (no definitions), original within-source order, counts not equalized.
- Option E: 都不满意 (fixed position, full width below A–D).
- No default. 继续/确认提交 show validation and scroll to the first unanswered excerpt.

## Analysis population

Report all findings as **conditional on the 20 eligible quotations**. Exclusion of 38/58 is in `EXCLUSION-REPORT.md`.

## Study vs test mode

`study_mode`: `study` | `test`. Test sessions use the same protocol with a banner and are excluded from primary tables. Where each mode is allowed (local, Vercel Preview, Vercel Production) is enforced server-side; see `SECURITY.md`. Suspicious sessions are flagged for review, never deleted; see `QUALITY-REVIEW.md`. Synthetic example: session `test_00000000` / group `control` / quotes (illustrative only) `batch1-calib-007` … not a real assignment.
