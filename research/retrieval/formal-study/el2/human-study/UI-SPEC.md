# `/el2test` UI spec (as implemented and approved, copy `el2-hs-copy.v3`)

Implementation: `pages/el2test.vue`. Strings: `server/utils/el2hs/copy.ts`, mirrored in `CONSENT.md`. Changes from the original Phase 1 spec are recorded in `COPY-REVISIONS.md`.

The questionnaire is a **standalone** flow. `app.vue` renders `/el2test` without `TopBar`, `FlyingGhosts`, `FloatingButtons`, filters, or the import link. Route rule `/el2test` is client-rendered (`ssr: false`).

## Visual identity

- Theme tokens from `styles/theme.css` (`--color-bg`, `--color-fg`, `--color-muted`, `--color-brand`). Quotation text uses the homepage quotation font and line spacing.
- Header: logo + 「鸽白词句库」 kicker + 「阅读研究」 title. No rainbow strip, no language toggle.
- One colour per role: Theme chips sky blue (`Chip dimension="themes"`), actions brand blue, instruction box lavender, progress mint, required/error red, test banner yellow.

## Pages

1. **Welcome/consent.** Description, consent bullets, acknowledgement. 「不同意，离开」 bottom-left (link to `/`), 「同意并开始」 bottom-right.
2. **Page 1.** Sticky progress bar 「第 1–5 段，共 10 段」 + 「已选 x / 10」; lavender instruction box; five excerpts; only 「继续」 bottom-right.
3. **Page 2.** Progress 「第 6–10 段，共 10 段」; instruction box with identical text for both groups. For the Disclosure group only, a bold line 「请注意，本页包含 AI 生成的标签组。」 sits inside the box below the instructions. Five excerpts. 「上一页」 bottom-left, 「确认提交」 bottom-right. **No contact or follow-up field.**
4. **Confirm dialog.** 「提交后将无法修改。确认提交吗？」 with 返回检查 / 确认提交; Esc and backdrop close it; confirm button focused on open.
5. **Thank-you.** Check mark + thank-you text.

## Excerpt block

- Quotation first, preceded by a red asterisk and the number (「\*1.」).
- Right-aligned citation 「——作者《书名》」, no 作者/书籍 labels, nationality brackets stripped.
- No per-excerpt prompt.
- A–D: four cards in one horizontal row (4-column grid, also on phones). Each card: large letter on top, Theme name chips stacked vertically below. Theme names only, no definitions.
- E 「都不满意」: full-width dashed card below A–D.
- Selected A–D: sky border + soft sky background, chips switch to active. Selected E: neutral grey border/background.
- Entire card clickable; `role="radiogroup"` / `role="radio"` with `aria-checked`; arrow keys move within an excerpt; roving tabindex.

## Validation and recovery

- 继续/确认提交 with an unanswered excerpt: red outline on unanswered excerpts, message 「还有摘录没有选择。已帮您定位到第一处。」, smooth scroll to the first one (scroll margin clears the sticky bar).
- Each selection is saved as a server draft. Refresh: GET session by cookie and rehydrate. Starting again with an in-progress session resumes it.

## Interaction and accessibility

Hover lift and press scale on buttons and cards, visible focus rings, `prefers-reduced-motion` disables motion. Text inputs: none.

## Errors

Start/submit errors show the server's Chinese `data.message` (rate limit, mode not available) or a generic fallback from `copy.ts`.
