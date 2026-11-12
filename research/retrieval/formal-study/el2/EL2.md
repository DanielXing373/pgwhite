# EL2 preparation report

**Date:** 2026-10-22  
**Status:** **GO** for local validation. **HOLD** before any paid Luna or DeepSeek request.  
**EL1:** closed and not modified (runs, archives, Gold, ontology, retrieval, EL1 configs).

EL2 is a separate 58-quote Theme-selection batch for later blinded preference evaluation. Four sources: Human Gold (untruncated), Embedding Top2, GPT-6 Luna 0–2, DeepSeek Flash 0–2.

## 1. Data integrity and coverage

Verified against freeze constants:

| Asset | SHA-256 / ID | Result |
| --- | --- | --- |
| Ontology (185 `active_candidate`) | `a71db8ba…ed39b7` | match |
| 58-quote benchmark | `5ad71ae6…c70da` | 58 quotes |
| EL1 pilot (subset) | `855fd0c3…09f06` | 10/10 IDs present in the 58 |
| Retrieval `formal-p1-c-task-20261021` | artifact `570f9916…34b143d` · effective `775e3d5c…1c9a165a` | **58/58** full rankings of length 185 |

Missing retrieval quote IDs: **none**. No retrieval regeneration. Quote texts and Gold ID lists match the retrieval artifact. Every Gold Theme ID and every Embedding Top2 ID resolves in the frozen ontology.

Machine-readable: `el2/baselines/coverage.v1.json`.

## 2. Human Gold Theme-count distribution (descriptive only)

Not a reason to edit Gold.

| Gold Theme count | Quotes |
| --- | --- |
| 0 | 3 (`batch1-calib-008`, `batch1-calib-011`, `batch2-batch2-001`) |
| 1 | 20 |
| 2 | 19 |
| 3 | 10 |
| 4 | 3 |
| 5 | 3 |

Gold is copied in **original recorded order**. LLM 0–2 does not apply to Gold.

Path: `research/retrieval/formal-study/el2/baselines/human-gold.v1.json`

## 3. Embedding Top2

Method: exactly ranks 1–2 of the frozen C-task ranking, original order, no similarity threshold, no LLM. No new embedding inference.

Path: `research/retrieval/formal-study/el2/baselines/embedding-top2.v1.json`  
Config: `configs/EL2-EMBED-TOP2.selection.v1.json` (local provider `embedding-top2`)

Gold vs Embedding collisions (identical ordered list or identical ID set): **4 quotes** (report, do not repair). `batch2-batch2-028` is an **ordered** match; `batch1-calib-004`, `batch1-calib-009`, `batch1-calib-012` are the same two IDs in different order. Full list: `el2/baselines/coverage.v1.json`. Luna/Flash are not in this table yet.

## 4. EL2 LLM prompt and configs

Prompt version `selector-task-instruction.el2.v1`:

- `el2/prompt/selector-task-instruction.el2.v1.txt`
- Same semantic text in Luna and Flash configs (`selector_task_instruction`)

| ID | Config | `max_requests` |
| --- | --- | --- |
| EL2-GPT6LUNA | `configs/EL2-GPT6LUNA.selection.v1.json` | 58 |
| EL2-GPT6LUNA-SMOKE | `configs/EL2-GPT6LUNA.smoke.v1.json` | 1 (`batch1-calib-005`) |
| EL2-DSFLASH | `configs/EL2-DSFLASH.selection.v1.json` | 58 |
| EL2-DSFLASH-SMOKE | `configs/EL2-DSFLASH.smoke.v1.json` | 1 (`batch1-calib-005`) |

Luna: Chat Completions `json_schema` `maxItems: 2`, `reasoning_effort: none`, omit temperature.  
Flash: `json_object` + local `validateSelection` max 2, thinking disabled.  
Invalid IDs, duplicates, malformed JSON, and >2 IDs are recorded as invalid, not repaired. Output order is preserved.

Registry: `el2/registry.json` (not the EL1 registry).

## 5. Local validation

`npm run research:retrieval:test` — **85/85 passed**. Coverage:

- Gold reproduced exactly (count + order + EL1 pilot flag)
- Embedding always two highest-ranked IDs
- Luna/Flash schema and validation accept only 0–2 candidate IDs; order kept; too many / invented / duplicate / malformed rejected
- Dry-runs do not fetch
- Embedding local run does not fetch and matches the Top2 baseline
- Fake-HTTP Luna smoke records EL2 prompt, `maxItems` 2, usage, catalog cost

## 6. Estimated API costs (catalog, not invoices)

Scaled from EL1 per-quote usage, Standard Luna / peak Flash, `reasoning_effort: none` / thinking off, cache-miss:

| Arm | 58-quote | + smoke |
| --- | --- | --- |
| `gpt-6-luna` | ~$0.007–$0.009 | ~$0.009 |
| `deepseek-flash` | ~$0.014–$0.016 | ~$0.016 |

`max_estimated_budget_usd: 1` remains a post-call stop. `max_requests` is the hard cap (58 / 1).

## 7. Commands (do not run paid until authorized)

Dry-run (safe now):

```powershell
npm run research:formal:run -- --stage selection --execution-mode dry-run --config research/retrieval/formal-study/configs/EL2-GPT6LUNA.selection.v1.json
npm run research:formal:run -- --stage selection --execution-mode dry-run --config research/retrieval/formal-study/configs/EL2-DSFLASH.selection.v1.json
npm run research:formal:run -- --stage selection --execution-mode dry-run --config research/retrieval/formal-study/configs/EL2-EMBED-TOP2.selection.v1.json
```

Embedding Top2 local (no API; use a new `--run-id` if the directory exists):

```powershell
npm run research:formal:run -- --stage selection --execution-mode local --config research/retrieval/formal-study/configs/EL2-EMBED-TOP2.selection.v1.json --run-id EL2-EMBED-TOP2
```

Smoke (HOLD until authorized):

```powershell
$env:OPENAI_API_KEY = "<set in this shell only>"
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL2-GPT6LUNA.smoke.v1.json --run-id EL2-GPT6LUNA-SMOKE
$env:DEEPSEEK_API_KEY = "<set in this shell only>"
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL2-DSFLASH.smoke.v1.json --run-id EL2-DSFLASH-SMOKE
```

Full 58-quote (HOLD until both smokes PASS):

```powershell
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL2-GPT6LUNA.selection.v1.json --run-id EL2-GPT6LUNA
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL2-DSFLASH.selection.v1.json --run-id EL2-DSFLASH
```

Smoke PASS: HTTP 200, 0–2 valid candidate IDs in recorded order, usage + calculated USD, request shows EL2 prompt and max 2.

## 8. Human-evaluation plan

`el2/HUMAN-EVAL-PLAN.md`. Participant pack **not generated**.

## 9. GO / HOLD

| Gate | Decision |
| --- | --- |
| Frozen 58-quote + retrieval coverage | **GO** (58/58) |
| Gold exact copy + Embedding Top2 | **GO** |
| Local tests / dry-run / fake smoke | **GO** after tests in this report |
| Paid Luna/Flash smoke | **HOLD** until explicit authorization |
| Paid 58-quote runs | **HOLD** until smokes PASS |
| Participant-facing study | **HOLD** |

No unresolved coverage gaps. Stop before paid execution.
