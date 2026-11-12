# DeepSeek selector preparation (EL-Pilot-10)

**Status:** infrastructure implemented 2026-10-21. No DeepSeek paid calls. No new live runs. See `DEEPSEEK-IMPLEMENTATION.md`.  
**Verified:** 2026-10-21 from [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/), [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/), [JSON Output](https://api-docs.deepseek.com/guides/json_mode/), [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/), [Responses API](https://api-docs.deepseek.com/api/create-response/).

This is an exploratory 10-quote comparison. Frozen Gold is one reader’s interpretation, not exhaustive semantic truth. Later blinded human evaluation of reasonableness remains in scope.

## 1. Frozen setup to reuse

Do not change these.

| Asset | ID / hash |
| --- | --- |
| Ontology (185 Themes) | `a71db8ba7e34ea5c2db33b53a6c1583d8ac8bbf3e11871198bf0deedc0ed39b7` |
| Pilot EL-Pilot-10 | `855fd0c338daf008259f8ae1886300a02cc1e9b02bc25d5a01dd611faba09f06` |
| Retrieval | `formal-p1-c-task-20261021` / artifact `570f9916…34b143d` / effective `775e3d5c…1c9a165a` |
| Prompt | `SELECTOR_TASK_INSTRUCTION` (no aliases) |
| Output | `{"selected_theme_ids":[]}` max 3 candidate IDs; empty list allowed |
| Metrics | end-to-end Micro-F1 primary; P/R, exact match, zero-theme accuracy, invalid output rate, retrieval/selector/FP attribution, USD, latency |
| GPT baselines | `EL-P1-GPT5MINI` (`gpt-5-mini-2025-08-07`, Micro-F1 0.476, $0.00561, 2254 ms) · `EL-P1-GPT52` (`gpt-5.2-2025-12-11`, Micro-F1 0.500, $0.02541, 1033 ms) |

Existing DeepSeek adapter: `createDeepSeekSelector` → `https://api.deepseek.com/chat/completions`, `DEEPSEEK_API_KEY`, `response_format: {type: json_object}`, `temperature: 0`. Config `selector-deepseek.pilot.v1.json` is **not** EL-ready: `model_id` null, no C-task retrieval lock, `max_requests` 40, no USD budget.

## 2. Verified DeepSeek models

Chat Completions `model` enum is **`deepseek-flash`** and **`deepseek-v4-pro` only**. Do not use retired `deepseek-chat` / `deepseek-reasoner` / `deepseek-v4-flash`.

| API model ID | Served version (docs) | Role |
| --- | --- | --- |
| `deepseek-flash` | DeepSeek-V4.1-Flash-1017 | lower-cost |
| `deepseek-v4-pro` | DeepSeek-V4-Pro-0813 | higher-capability |

Legacy names `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` still route to Flash-1017 at Flash prices. Record `response.model` and `system_fingerprint` in artifacts; aliases are not immutable snapshots like OpenAI dated IDs.

USD per 1M tokens ([pricing](https://api-docs.deepseek.com/quick_start/pricing/)). Peak = 01:00–04:00 and 06:00–10:00 UTC weekdays (not Chinese holidays). Off-peak is half.

| Model | Peak in (miss / hit) | Peak out | Off-peak in (miss / hit) | Off-peak out |
| --- | --- | --- | --- | --- |
| deepseek-flash | 0.30 / 0.006 | 1.20 | 0.15 / 0.003 | 0.60 |
| deepseek-v4-pro | 1.32 / 0.044 | 3.96 | 0.66 / 0.022 | 1.98 |

Usage fields: `prompt_tokens`, `completion_tokens`, `prompt_cache_hit_tokens` / `prompt_tokens_details.cached_tokens`, `completion_tokens_details.reasoning_tokens`. Existing extractor already maps those. Treat reasoning as **output-billed** (do not double-count) once catalog rows exist.

JSON: Chat Completions allows **`json_object` only**, not `json_schema`. Prompt must contain the word “json” (current user text does: `Return JSON: …`). Docs warn of occasional **empty content** and truncation unless `max_tokens` is set. Responses API supports `json_schema`; that would be a different API surface than EL OpenAI Chat Completions.

Thinking is **enabled by default** (effort `high`). Disable with `thinking: {type: "disabled"}` and/or `reasoning_effort: "none"`. In thinking mode, `temperature` is ignored (no error). Default `max_tokens` is 8K non-thinking vs 64K thinking.

## 3. Compatibility vs OpenAI (comparison risks)

| Factor | EL OpenAI | DeepSeek today | Risk |
| --- | --- | --- | --- |
| Constraint | `json_schema` + enum of Top20 IDs | `json_object`; enum only in **local** `validateSelection` | Higher invalid / invented-ID rate |
| Thinking | mini `low`; 5.2 `none` | Default **on** | Accidental CoT, latency, cost, ignored temperature |
| Version pin | Dated snapshot IDs | Alias + fingerprint | Served weights can move under the same ID |
| Pricing | Flat | Peak/off-peak | Catalog cannot be a single number without a documented policy |
| Empty JSON | Not observed | Documented occasional empty `content` | Invalid output, not a model Theme choice |
| `temperature: 0` | Omitted on GPT-5 | Effective only if thinking **disabled** | Current adapter always sends 0 but does not disable thinking |

Keep Chat Completions + local schema validation for the first DeepSeek arm (reuse runner). Do not switch to Responses API until a smoke FAIL on `json_object`.

## 4. Required implementation (before any paid call)

Do not execute until these land. Frozen gold/ontology/metrics stay unchanged.

1. New EL configs (not the old `selector-deepseek.pilot.v1.json`): same retrieval lock, 10 quotes, `max_selected` 3, no aliases, `$1` post-call budget, `max_requests` 10 (smoke: 1 + `quote_ids`).
2. `buildDeepSeekBody`: `thinking: {type: "disabled"}`, `reasoning_effort: "none"`, `max_tokens` ~512, keep `json_object` and `temperature: 0`.
3. Pass that request object from `select.mjs` (today only `openaiRequest` is forwarded).
4. Pricing catalog: official peak **and** off-peak rows, or peak-only conservative rates with `reasoning_billed_as: output`. Budget validation stays on.
5. Persist `system_fingerprint` and returned `model`.
6. Registry IDs: `EL-P1-DSFLASH`, `EL-P1-DSPRO`; smoke `…-SMOKE`. Exclude smokes from the Pilot table.
7. Unique run IDs; archive copies; no overwrite of GPT or smoke artifacts.

## 5. Controlled matrix

**IV:** selector model.  
**Controls:** EL-Pilot-10, 185 Themes, C-task Top20, same instruction text, max 3, same eval code.  
**Thinking:** disabled on both DeepSeek arms (primary). A thinking-on arm is a **separate** experiment, not this matrix.

| Experiment | Model | Thinking | Quotes |
| --- | --- | --- | --- |
| EL-P1-GPT5MINI (done) | gpt-5-mini-2025-08-07 | low | 10 |
| EL-P1-GPT52 (done) | gpt-5.2-2025-12-11 | none | 10 |
| EL-P1-DSFLASH | deepseek-flash | disabled | 10 |
| EL-P1-DSPRO | deepseek-v4-pro | disabled | 10 |
| matching 1-quote smokes | same | disabled | `batch1-calib-005` |

Procedure: implement → dry-run → smoke each model → 10-quote pilots → archive → identified comparison + optional blinded export later.

## 6. Cost estimate (planning, not a cap)

Anchor: GPT-5 mini used ~11.6k input / ~1.5k output tokens for 10 quotes. Non-thinking JSON should be closer to GPT-5.2 output size (~365 completion tokens).

Conservative **peak, cache-miss**, 12k in + 2k out, plus 1 smoke quote (~1.2k + 0.2k):

| Arm | 10-quote | + smoke | vs GPT mini $0.0056 / 5.2 $0.0254 |
| --- | --- | --- | --- |
| Flash | ~$0.006 | ~$0.007 | similar to mini |
| Pro | ~$0.027 | ~$0.030 | similar to 5.2 |

If thinking is left on, output can jump by 10–100× at output rates; **HOLD**.  
`max_estimated_budget_usd: 1` is a **post-call** stop. `max_requests` is the hard pre-call cap.

## 7. Hypotheses and gates

- **H1 (validity):** Flash and Pro return parseable JSON with 0–3 candidate IDs; invalid_output_rate = 0 on smoke and pilot.
- **H2 (cost/latency):** Flash cheaper or faster than GPT-5.2 at similar Gold Micro-F1 (exploratory; no significance test).
- **H3 (capability):** Pro ≥ Flash on Micro-F1 **or** later human reasonableness, at higher cost.
- Gold Micro-F1 is **agreement with one annotation**, not semantic correctness. Extra Themes vs Gold may still be useful.

**Smoke GO:** HTTP 200; `validation_status: valid`; `http_status` stored; usage + calculated USD; request snapshot shows thinking disabled; wall time ≫ 2 ms (actual HTTP).  
**Smoke HOLD:** empty content; 401/403; thinking still on; unknown cost; invented IDs.

**Pilot PASS:** 10/10 valid; retrieval lock hashes unchanged; budget not exceeded; archive SHA-256 verified; originals unmodified.  
**Pilot FAIL:** invalid_output_rate > 0.2; STOP before first request (missing key/rate); or any frozen hash drift.

**Do not** treat a Micro-F1 gap of a few points on n=10 as a ranking.

## 8. Next execution steps (after paid-call authorization)

1. Dry-run both DeepSeek configs (local, no API).  
2. Smoke Flash then Pro with **new** run IDs (`EL-P1-DSFLASH-SMOKE`, `EL-P1-DSPRO-SMOKE`).  
3. If GO: 10-quote `EL-P1-DSFLASH` then `EL-P1-DSPRO`.  
4. Archive; compare to GPT baselines; keep smokes out of the table.  
5. Later: unified four-model blinded human-eval pack (not generated in this step).

## 9. Approved decisions (2026-10-21)

1. Thinking-off only. No thinking-on arm.  
2. Catalog uses verified **peak** rates. USD is `catalog_token_estimate`, not a provider invoice. Record actual tokens.  
3. Chat Completions `json_object` + local Theme ID validation.  
4. Credentials only from `DEEPSEEK_API_KEY` in the execution environment.  
5. Future unified blinded pack for all four models; do not generate or score it yet.

No merge, tag, paid DeepSeek call, or frozen-data edit in this step.
