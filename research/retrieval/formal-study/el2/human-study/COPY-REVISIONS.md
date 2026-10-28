# EL2 human study — participant copy and protocol revisions

This file is the change record for participant-facing wording and design. It does not replace the history: the v1 strings below are the original frozen copy, kept verbatim.

| Field | Value |
| --- | --- |
| Previous version | `el2-hs-copy.v1` (frozen Phase 1 copy) |
| Intermediate version | `el2-hs-copy.v2` (local iteration only; never deployed, never shown to a participant) |
| New version | **`el2-hs-copy.v3`** |
| Effective date | 2026-10-27 |
| Approved by | Researcher (UI, wording, and layout approved in review; contact removal decided 2026-10-27) |
| Protocol version | unchanged: `el2-human-preference.protocol.v1`, amended by this record (Amendment 1) |
| Dataset version | unchanged: `el2-hs-questions.v1`, internal master SHA-256 `1e3b6d1f…fc2a4d8`. The 20 quotations and their Theme sets are untouched. |
| Randomization version | unchanged: `el2-assignment.v1` |
| Real participant responses collected | **None.** Migration 0007 has not been executed, there is no study database, and nothing has been deployed. Only local in-memory test sessions (`study_mode=test`) have existed. |

`el2-hs-copy.v2` is skipped as a live version so that no analysis can confuse it with v3. `COPY_VERSION` in code, the 0007 protocol seed row, and every new session row carry `el2-hs-copy.v3`.

## Amendment 1 — design changes (v1 → v3)

1. **Theme options show Theme names only.** v1 protocol said "Theme labels + definitions". Definitions are no longer shown, and the public API no longer sends `definition_zh`.
2. **Option E is 「都不满意」.** v1: 「以上都不合适」.
3. **No per-question prompt.** v1 showed 「请选择你认为最能概括这段文字主题的一组标签。」 above every quotation. v3 puts the instruction once per page in the instruction box.
4. **Disclosure is a short bold statement.** v1 embedded a long disclosure sentence in the page-2 instructions. v3 gives both groups identical page-2 instructions; only the Disclosure group additionally sees a bold line 「请注意，本页包含 AI 生成的标签组。」 in the instruction box on page 2. Control never receives it (enforced server-side by `sectionNotices`; unit-tested).
5. **No 「题」 framing.** Excerpts are 「段」/「摘录」, not 「题」/「题目」 (unit-tested).
6. **Quotation layout.** Quotation first, then a right-aligned citation 「——作者《书名》」 without 作者/书籍 labels. Leading nationality brackets (e.g. 「[波兰]」) are stripped at display time for every author; the frozen dataset is unchanged.
7. **Required marker.** Each excerpt number carries a red asterisk; no separate legend.
8. **No contact-information collection.** A v2 draft added an optional WeChat/email field for follow-up interviews. It was removed before any deployment. The questionnaire requests no email, phone, social handle, or other contact detail; the server rejects unexpected request fields instead of storing them; the pending migration has no contact table.

## Exact wording changes

| Key | v1 (original) | v3 (current) |
| --- | --- | --- |
| welcome | 欢迎参加鸽白词句库的阅读研究。 | 欢迎参加鸽白词句库的笔记研究。 |
| research_description | 这项研究想了解：面对同一段文学摘录时，读者更认可哪一种主题标签。你将看到 10 段中文摘录。每段有四组主题标签，请选出你认为最合适的一组。全程匿名，大约需要 8–12 分钟。 | 研究想了解：摘录一段文学时，读者更认可哪一种主题标签。您将看到 10 段中文摘录。每段有四组主题标签，请选出您认为最合适的一组。全程匿名，大约需要 8–12 分钟完成。 |
| consent_intro | 参与即表示你同意： | 参与即表示您同意： |
| consent bullet 1 | 你已年满 18 岁。 | 您已年满 18 岁。 |
| consent bullet 2 | 回答仅用于学术研究，不与你的姓名或账号关联。 | 回答仅用于学术研究，不与您的姓名或账号关联。 |
| consent bullet 3 | 你可以随时关闭页面退出；未提交的内容不会用于正式分析。 | 您可以随时关闭页面退出；未提交的内容不会用于正式分析。 |
| consent bullet 4 | 摘录来自已出版作品，仅用于研究展示。 | (unchanged) |
| consent_ack | 点击「同意并开始」即表示你理解以上说明并自愿参加。 | 点击「同意并开始」即表示您理解以上说明并自愿参加。 |
| first_section | 下面有 5 道题。请根据摘录本身选择最能概括其主题的一组标签。没有标准答案。 | 下面有 5 段文学摘录。请凭个人理解，选出您认为最贴合主题的一组标签。如果都不满意，请选「都不满意」。 |
| second_section_control | 下面还有 5 道题。请继续根据摘录本身选择最能概括其主题的一组标签。规则与上一页相同。 | 下面有新的 5 段文学摘录。请凭个人理解，选出您认为最贴合主题的一组标签。如果都不满意，请选「都不满意」。 |
| second_section_disclosure | 下面还有 5 道题。请注意：这一页的部分主题标签可能由人工智能系统生成或协助生成，并非全部来自人工标注。请仍然根据摘录本身，选择你认为最合适的一组。若你认为四组都不合适，请选择「以上都不合适」。 | identical to second_section_control |
| disclosure_notice (new; Disclosure page 2 only, bold) | — | 请注意，本页包含 AI 生成的标签组。 |
| question_prompt (removed) | 请选择你认为最能概括这段文字主题的一组标签。 | — |
| none_of_the_above | 以上都不合适 | 都不满意 |
| validation_incomplete | 请完成本页全部 5 题后再继续。 | 还有摘录没有选择。 |
| validation_scroll | 已为你定位到第一道未作答题。 | 已帮您定位到第一处。 |
| submit_confirm | 提交后将无法修改。确认提交这 10 道题的选择吗？ | 提交后将无法修改。确认提交吗？ |
| thank_you | 感谢你的参与。你的回答已匿名保存。可以关闭此页面。 | 感谢您的参与。回答已匿名保存。可以关闭此页面。 |
| back | 返回 | 上一页 |
| progress_1 | 第 1–5 题，共 10 题 | 第 1–5 段，共 10 段 |
| progress_2 | 第 6–10 题，共 10 题 | 第 6–10 段，共 10 段 |
| answered_prefix (new) | — | 已选 （shown as 「已选 x / 10」） |
| author_label / book_label (removed) | 作者 / 书籍 | — |
| rate_limited (new) | — | 开始的次数过于频繁，请稍后再试。 |
| mode_disabled (new) | — | 当前环境未开放此问卷。 |
| start_failed (new) | — | 暂时无法开始，请稍后再试。 |
| submit_failed (new) | — | 提交失败，请稍后再试。 |
| start, decline, continue, submit_yes, submit_back, test_banner, already_submitted | | unchanged |

Server error text (not in `COPY`): incomplete submit → 「请先为全部 10 段摘录做出选择。」; unexpected request field → 「请求包含不接受的字段。」; malformed answers → 「请求格式无效。」.

The frozen file `datasets/el2-hs-questions.participant-content.v1.json` still contains `"none_of_the_above_label_zh": "以上都不合适"` (as does its build script). It is a frozen QA catalog and is **not** read by the questionnaire; it is intentionally left unchanged. The live E label comes from `NONE_LABEL_ZH` in `server/utils/el2hs/constants.ts`.

## Analysis notes caused by the amendment

- The disclosure manipulation is now a separate bold line rather than wording woven into the instructions. H2/H3 in `DESIGN.md` still compare Disclosure page 2 with Control page 2; the operative manipulation is the presence of `disclosure_notice`.
- Hiding definitions removes one channel by which longer Gold definitions could favour Gold; Theme-count differences remain visible.
- Every session row stores `copy_version`; only `el2-hs-copy.v3` sessions belong in the primary analysis.

## Removed features

| Feature | Status |
| --- | --- |
| Optional follow-up contact (WeChat/email) — v2 draft | Removed from UI, API, stores, migration 0007, export, tests, and docs. Never deployed; no contact data ever stored outside local memory test runs. |
| Follow-up contact export `?dataset=followup` | Removed. The parameter is ignored; the research export has no contact columns. |
| `user_agent_hash` session column (unused) | Removed from 0007 to avoid an unnecessary identifier. |
