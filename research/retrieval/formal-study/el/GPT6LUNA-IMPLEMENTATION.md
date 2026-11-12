# GPT-6 Luna EL implementation report

**Date:** 2026-10-22  
**Status:** **GO** for local validation and fake-provider dry-runs. **HOLD** before any paid OpenAI request.  
**Authorization required:** first live smoke (`EL-P1-GPT6LUNA-SMOKE`). Do not run `EL-P1-GPT6LUNA` until that smoke PASSes.

No live Luna calls were made. Frozen ontology, 10-quote pilot, C-task retrieval, existing GPT/DeepSeek run and archive artifacts, Gold labels, evaluation metrics, embedding model, and the four-model HTML report were not modified.

## Verified API details (2026-10-22)

Official sources:

- Model: https://developers.openai.com/api/docs/models/gpt-6-luna
- Pricing: https://developers.openai.com/api/docs/pricing
- GPT-6 guide: https://developers.openai.com/api/docs/guides/latest-model

| Field | Value |
| --- | --- |
| Display name | GPT-6 Luna (not an API ID) |
| Official API model ID | `gpt-6-luna` |
| Dated snapshot | none listed; default snapshot is `gpt-6-luna` |
| Chat Completions `v1/chat/completions` | supported |
| Responses `v1/responses` | supported; **not used** for this arm |
| Structured outputs | supported (`structured_outputs`) |
| `reasoning_effort` | `none`, `low`, `medium` (**API default**), `high`, `xhigh`, `max` |
| Chat Completions function calling | only with `reasoning_effort: "none"` |
| EL request | Chat Completions + `json_schema` strict; **no tools**; omit `temperature`; pin `reasoning_effort: "none"` |
| Standard short-context USD / 1M | input 0.10, cached input 0.01, output 0.50 |
| Cache writes | 0.125 / 1M (not a runner usage line today) |
| Long context | >272K input: 2× input/cache, 1.5× output; EL prompts are far below this |
| Reasoning billing | billed as output (`reasoning_billed_as: output`) |

Do not substitute `gpt-6-sol`, `gpt-6.1-sol`, or `gpt-6-astra`. Astra / GPT-6.1 Sol do not support `none`.

## Runner audit

Existing OpenAI adapter already:

- posts Chat Completions
- sends `json_schema` / strict Theme-ID enum
- omits `temperature` when `openai_request.omit_temperature` is true
- forwards `reasoning_effort`
- records `response.model`, `system_fingerprint`, usage, and `request_body`

**Minimum change:** no adapter/code path change. Add Luna configs + catalog row + registry + tests + docs. Preserve GPT-5 mini, GPT-5.2, and DeepSeek behavior.

## Frozen reuse

Unchanged: EL-Pilot-10 (`855fd0c3…`), 185-Theme ontology (`a71db8ba…`), C-task `formal-p1-c-task-20261021` / `570f9916…` / `775e3d5c…`, Qwen3-Embedding-0.6B Top20, selector instruction, max 3 Themes, Gold and metrics.

## Changed files

- `configs/EL-P1-GPT6LUNA.selection.v1.json` (`max_requests: 10`, immutable run ID `EL-P1-GPT6LUNA`)
- `configs/EL-P1-GPT6LUNA.smoke.v1.json` (`max_requests: 1`, quote `batch1-calib-005`, run ID `EL-P1-GPT6LUNA-SMOKE`)
- `pricing/pricing-catalog.v1.json` — `gpt-6-luna` Standard rates; catalog version `el-openai-deepseek-luna-verified-2026-10-22`
- `el/registry.json` — Luna `prepared` / `prepared_smoke`; existing completed/prepared rows unchanged
- Docs: `el/EL.md`, `el/MODELS.md`, `protocol/COMMANDS.md`, `README.md`, `experiment-manifest.v1.json`
- Tests: `research/retrieval/tests/el-infrastructure.test.mjs`

Unchanged on purpose: OpenAI/DeepSeek adapters, existing run directories, frozen benchmark/ontology, four-model HTML, human-eval export files.

## Local test results

`npm run research:retrieval:test` — **73/73 passed** (Luna config, catalog, registry, dry-run, fake-HTTP smoke fixture).

CLI dry-run of `EL-P1-GPT6LUNA.selection.v1.json`: `calls_provider: false`, empty `blockers`, `model_id: gpt-6-luna`, `reasoning_effort: none`, `quote_count: 10`, `active_theme_count: 185`, `effective_config_sha256: b375ec519088cd557fe32e71351e5b6a4b479e6d52c04ba2a1ecc3cb9743bb33`.

CLI dry-run of `EL-P1-GPT6LUNA.smoke.v1.json`: `calls_provider: false`, empty `blockers`, `max_requests: 1`, `quote_ids: ["batch1-calib-005"]`, `effective_config_sha256: df0a6a0eb7cad916a1afc46741edf3b4ffcca246fb9c97fbefde58df09a4050f`.

No paid API.

## Smoke PASS criteria (live, after authorization)

1. HTTP 200 from Chat Completions; no 401/4xx/5xx.
2. Valid Theme selection: parseable `{"selected_theme_ids":[…]}` with 0–3 IDs from that quote’s Top20 enum (`validateSelection` valid).
3. Recorded `usage` (input/output; reasoning/cached if present) and `cost_summary.total_usd_status === "calculated"`.
4. Request configuration verified in `request_body` / `effective_config`: `model: gpt-6-luna`, `reasoning_effort: none`, no `temperature`, `response_format.type: json_schema`.
5. Provenance: `response.model`, `system_fingerprint` when present, catalog estimate tagged `catalog_token_estimate` / `not_provider_confirmed`.

FAIL: invalid JSON, invented IDs, missing usage, wrong model ID, `reasoning_effort` not `none`, or overwrite of an existing run dir. Use a new `--run-id` if `EL-P1-GPT6LUNA-SMOKE` already exists.

## Exact smoke command (do not run until authorized)

```powershell
$env:OPENAI_API_KEY = "<set in this shell only>"
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL-P1-GPT6LUNA.smoke.v1.json --run-id EL-P1-GPT6LUNA-SMOKE
```

Safe now (no API):

```powershell
npm run research:formal:run -- --stage selection --execution-mode dry-run --config research/retrieval/formal-study/configs/EL-P1-GPT6LUNA.selection.v1.json
```

After GO smoke, pilot (do not run until authorized):

```powershell
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL-P1-GPT6LUNA.selection.v1.json --run-id EL-P1-GPT6LUNA
```

## Cost estimates (catalog, not invoices)

Anchor: ~12k input + 2k output for 10 quotes; smoke ~1.2k + 0.2k. Cache-miss Standard USD.

| Arm | 10-quote estimate | + smoke |
| --- | --- | --- |
| `gpt-6-luna` | ~$0.0022 | ~$0.0024 |

Compared with recorded pilots (exploratory): GPT-5 mini ~$0.0056, GPT-5.2 ~$0.0254, DeepSeek Flash ~$0.0024, DeepSeek Pro ~$0.0104. Luna is expected cheaper than mini/5.2/Pro at these rates if `none` holds.

`max_estimated_budget_usd: 1` is a **post-call** stop. `max_requests` is the hard pre-call cap.

## After smoke and pilot

- Archive `EL-P1-GPT6LUNA` with the existing archive script (overwrite refused).
- Add a Luna column to `EL-Four-Model-Theme-Visual-Report.html` only after the 10-quote run exists.
- Extend the planned unified human-eval pack to include Luna; do not generate or score it in this step.

## GO / HOLD

| Gate | Decision |
| --- | --- |
| Local tests + dry-run | **GO** |
| Paid smoke | **HOLD** until explicit authorization |
| Paid 10-quote pilot | **HOLD** until smoke PASS |
| HTML / human-eval pack | **HOLD** until pilot archived |
