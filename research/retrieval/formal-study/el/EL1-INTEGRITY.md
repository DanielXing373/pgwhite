# EL1 integrity report

**Status:** EL1 five-model Theme-selection pilot is **complete** on immutable artifacts. No new API calls. Frozen ontology, C-task candidates, prompts, Gold, and metric definitions were not modified.

Verified 2026-10-22 against `research/retrieval/formal-study/runs/<run-id>/run.json`.

## Freeze (all five runs match)

| Asset | SHA-256 / ID |
| --- | --- |
| Ontology | `a71db8ba7e34ea5c2db33b53a6c1583d8ac8bbf3e11871198bf0deedc0ed39b7` |
| Pilot-10 | `855fd0c338daf008259f8ae1886300a02cc1e9b02bc25d5a01dd611faba09f06` |
| Retrieval run | `formal-p1-c-task-20261021` |
| Retrieval artifact | `570f99165e5ced8d3ddff16a7b9d21e231b86bc58d97d2ab6584ededb34b143d` |
| Retrieval effective config | `775e3d5c4b54dc3da84a1efc1e24a515bc23fe4fad26a7e359ca7dc01c9a165a` |
| Embedding | `Qwen/Qwen3-Embedding-0.6B` · C · `task_instruct` · Top20 · no reranker |

## Run integrity

| Run | Model ID | Effective config | `run.json` | Valid | HTTP | USD status |
| --- | --- | --- | --- | --- | --- | --- |
| EL-P1-GPT5MINI | `gpt-5-mini-2025-08-07` | `808f6e5a…7b8365` | `7d1ab53a…e38630` | 10/10 | 200 | calculated |
| EL-P1-GPT52 | `gpt-5.2-2025-12-11` | `c284f02d…9dde91` | `020b2604…f742d14` | 10/10 | 200 | calculated |
| EL-P1-DSFLASH | `deepseek-flash` | `63d726b8…ea38abc` | `56773983…cbc7d6` | 9/10 | 200 | calculated |
| EL-P1-DSPRO | `deepseek-v4-pro` | `7bbe5c0e…f8c592c` | `fd1fc69c…2323db` | 10/10 | 200 | calculated |
| EL-P1-GPT6LUNA | `gpt-6-luna` | `dcfc3fc1…3cd978` | `04391ab7…04d53db` | 10/10 | 200 | calculated |

Request pins (from `effective_config`, not regenerated):

- OpenAI mini: `reasoning_effort: low`, omit temperature, `json_schema`
- OpenAI 5.2 and Luna: `reasoning_effort: none`, omit temperature, `json_schema`
- DeepSeek: `thinking: disabled`, `reasoning_effort: none`, `json_object` + local `validateSelection`

Token usage (sum of per-quote `usage`) and catalog USD:

| Run | In / out / reasoning / cached | Total USD (catalog estimate) |
| --- | --- | --- |
| GPT-5 mini | 11602 / 1469 / 1088 / 1024 | 0.00561 |
| GPT-5.2 | 11602 / 365 / 0 / 0 | 0.02541 |
| DeepSeek Flash | 7665 / 275 / 0 / 640 | 0.00244 |
| DeepSeek Pro | 7635 / 325 / 0 / 768 | 0.01039 |
| GPT-6 Luna | 11602 / 326 / 0 / 1173 | 0.00122 |

USD is `catalog_token_estimate` / `not_provider_confirmed`. GPT-5 mini and GPT-5.2 `run.json` hashes match the existing archives.

## Invalid output (preserved)

`EL-P1-DSFLASH` quote `batch1-calib-027`: HTTP 200, `validation_status: invalid`, `validation_reason: id_not_in_candidates`, `invented_theme_ids: ["theme-0124","theme-0114"]`, raw `{"selected_theme_ids":["theme-0124","theme-0114"]}`. Truncated IDs were not rewritten. Other models on that quote are valid.

## Limitations (EL1)

- **n=10** exploratory. Do not claim significance or production ranking.
- **Gold is one reader**, not exhaustive truth. Automated false positives include Gold disagreements that may still be semantically reasonable.
- **API constraints differ:** OpenAI `json_schema` vs DeepSeek `json_object` + local validation. Flash’s invalid row is a constraint failure, not a Gold disagreement.
- Retrieval Top20 and the 185-Theme freeze are shared; embedding model was not upgraded.
- Catalog cost is not an invoice. Luna has no dated snapshot; served ID is the alias `gpt-6-luna`.

## Archives (no overwrite of existing GPT-5 mini / GPT-5.2 / two-model human-eval)

| Path | Contents |
| --- | --- |
| `archives/EL-P1-GPT5MINI` | existing; `run.json` hash unchanged |
| `archives/EL-P1-GPT52` | existing; `run.json` hash unchanged |
| `archives/EL-P1-DSFLASH` | new copy of Flash run |
| `archives/EL-P1-DSPRO` | new copy of Pro run |
| `archives/EL-P1-GPT6LUNA` | new copy of Luna run |
| `archives/EL-human-eval` | existing two-model pack (20 samples) |
| `archives/EL-human-eval-five-model` | five-model pack (50 samples) |
| `archives/EL1-five-model-completion` | integrity, comparison, HTML, registry snapshot, five-model eval copies |
