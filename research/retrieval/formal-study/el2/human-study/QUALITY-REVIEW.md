# EL2 questionnaire — suspicious-session review

Principle: **flag, never delete.** Original responses and assignment records are always preserved. A flag is a prompt for human review, not an exclusion. Answers are never excluded just because they look unusual — unusual preferences are data.

## Automatic flags (computed at export time)

`service.ts` → `qualityFlags()`. Each export row carries `quality_flags` (semicolon-separated, empty when none). Flags are recomputed on every export and are not written to the database, so thresholds can change without touching stored data.

| Flag | Rule | Why |
| --- | --- | --- |
| `fast_completion` | consent → submit under **120 s** (`QUALITY_FAST_SECONDS`) for 10 excerpts | Too fast to read ten passages |
| `uniform_letter` | all 10 choices the same letter among A–D | A–D order is shuffled per excerpt, so a constant letter means a constant screen position, not a constant source |
| `all_none` | all 10 choices are E 「都不满意」 | Possible disengagement; also a legitimate opinion |
| `creation_burst` | at least **10** completed sessions created within ±60 s of this one (`QUALITY_BURST_*`) | Scripted floods. Cohort-level, because sessions are not linked to IPs |

## Excessive session creation

Prevented at creation time by the rate limiter (`SECURITY.md`). Sessions are intentionally not tagged with an IP hash, so excess creation cannot be attributed to individual sessions afterwards. Review instead:

- `creation_burst` flags in the export.
- Ratio of `in_progress`/`abandoned` to `completed` sessions per hour (SQL on `el2_hs_session`, read-only).
- HTTP 429 counts in hosting logs.

## Review procedure

1. Export with the protected endpoint (`format=csv`) on a locked workstation. Never commit exports.
2. Count flagged sessions by flag, group, and day. Record the counts in the analysis log.
3. For the primary analysis, include **all** completed `study` sessions with `copy_version = el2-hs-copy.v3`.
4. Sensitivity analysis: re-run excluding `fast_completion` and `creation_burst` sessions. Report both. Do not exclude `uniform_letter` or `all_none` unless they co-occur with `fast_completion`, and report that rule if used.
5. Any further exclusion rule must be written here, dated, before looking at outcome differences between groups.
6. Never delete or edit rows in `el2_hs_session`, `el2_hs_assignment_item`, or `el2_hs_response` for quality reasons.
