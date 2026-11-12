# DeepSeek EL implementation report

**Date:** 2026-10-21  
**Status:** GO for local validation. **HOLD** before any paid DeepSeek request.  
**Authorization required:** first live smoke (`EL-P1-DSFLASH-SMOKE`, then `EL-P1-DSPRO-SMOKE`).

No live DeepSeek calls were made. Frozen ontology, 10-quote pilot, C-task retrieval, GPT run/archive artifacts, metric definitions, and the existing two-model human-eval export were not modified.

## Changed files

Runner:

- `runner/src/selector/instruction.mjs` — `buildDeepSeekBody` sends `thinking: {type:"disabled"}`, `reasoning_effort: "none"`, `max_tokens: 512`, `json_object`, `temperature: 0`.
- `runner/src/selector/providers/deepseek.mjs` — forwards `deepseek_request`; records `system_fingerprint`.
- `runner/src/selector/providers/openai.mjs` — records `system_fingerprint` when present (body unchanged).
- `runner/src/selector/select.mjs` — forwards `deepseek_request`; stores fingerprint on DeepSeek results.
- `runner/src/selectionStage.mjs` — DeepSeek `selector_provider` records thinking + `local_validateSelection`. OpenAI `selector_provider` shape unchanged.
- `runner/src/safety.mjs` — thinking-on DeepSeek configs are blockers (no request).
- `runner/src/cost.mjs` — calculated USD tagged `estimate_kind: catalog_token_estimate`, `invoice_status: not_provider_confirmed`, `billing_window` from catalog.

Configs / catalog / registry:

- `configs/EL-P1-DSFLASH.selection.v1.json`, `EL-P1-DSPRO.selection.v1.json` (`max_requests: 10`)
- `configs/EL-P1-DSFLASH.smoke.v1.json`, `EL-P1-DSPRO.smoke.v1.json` (`max_requests: 1`, quote `batch1-calib-005`)
- `pricing/pricing-catalog.v1.json` — peak DeepSeek rates; OpenAI rates unchanged
- `el/registry.json` — DeepSeek rows `prepared` / `prepared_smoke`; GPT completed rows unchanged
- Docs: `el/EL.md`, `el/MODELS.md`, `el/DEEPSEEK-PREP.md`, `protocol/COMMANDS.md`, `README.md`, `experiment-manifest.v1.json`
- Tests: `research/retrieval/tests/el-infrastructure.test.mjs`, `formal-infrastructure.test.mjs`

Unchanged on purpose: `selector-deepseek.pilot.v1.json` (not EL-ready), frozen benchmark/ontology, GPT runs/archives, existing human-eval files. Adapter defaults still disable thinking if that older config is used.

## Compatibility vs OpenAI (archived in configs)

| | OpenAI EL | DeepSeek EL |
| --- | --- | --- |
| Constraint | Chat Completions `json_schema` strict enum | Chat Completions `json_object`; enum in local `validateSelection` |
| Thinking | mini `low`; 5.2 `none` | explicitly `disabled` + `reasoning_effort: none` |
| Version | dated snapshot IDs | aliases; record `model` + `system_fingerprint` |
| Cost | flat catalog rates | peak catalog rates; estimate ≠ invoice |

## Test results

Local: `npm run research:retrieval:test` — **71/71 passed**. Dry-runs of `EL-P1-DSFLASH`, `EL-P1-DSPRO`, and `EL-P1-GPT5MINI` returned `calls_provider: false` and empty blockers. Fake-provider/HTTP fixtures only (no network to DeepSeek).

OpenAI smoke fixture still sends `json_schema`, omits `temperature`, omits `thinking`, and does not set DeepSeek `selector_provider` fields.

## Exact smoke-test commands (do not run until authorized)

Use a **new** `--run-id` if a directory already exists. Set the key in the same shell. Do not put the key in a file, log, or commit.

```powershell
$env:DEEPSEEK_API_KEY = "<set in this shell only>"
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL-P1-DSFLASH.smoke.v1.json --run-id EL-P1-DSFLASH-SMOKE
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL-P1-DSPRO.smoke.v1.json --run-id EL-P1-DSPRO-SMOKE
```

Dry-run (safe now):

```powershell
npm run research:formal:run -- --stage selection --execution-mode dry-run --config research/retrieval/formal-study/configs/EL-P1-DSFLASH.selection.v1.json
npm run research:formal:run -- --stage selection --execution-mode dry-run --config research/retrieval/formal-study/configs/EL-P1-DSPRO.selection.v1.json
```

After GO smokes, pilots:

```powershell
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL-P1-DSFLASH.selection.v1.json --run-id EL-P1-DSFLASH
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL-P1-DSPRO.selection.v1.json --run-id EL-P1-DSPRO
```

## Cost estimates (peak catalog, not invoices)

Anchor: ~12k input + 2k output tokens for 10 quotes; smoke ~1.2k + 0.2k. Cache-miss peak USD.

| Arm | 10-quote estimate | + smoke | vs GPT mini $0.0056 / 5.2 $0.0254 |
| --- | --- | --- | --- |
| `deepseek-flash` | ~$0.006 | ~$0.007 | similar to mini |
| `deepseek-v4-pro` | ~$0.024–$0.027 | ~$0.027–$0.030 | similar to 5.2 |

`max_estimated_budget_usd: 1` is a **post-call** stop. `max_requests` is the hard pre-call cap. Recorded USD will be labeled `catalog_token_estimate` / `not_provider_confirmed`. Off-peak invoices may be lower.

## Provenance limitations

- `deepseek-flash` / `deepseek-v4-pro` are aliases, not dated OpenAI-style snapshots. Served weights can move; archive `response.model` and `system_fingerprint` (null if omitted).
- Docs served versions: Flash-1017, Pro-0813. The API may not return those strings.
- Empty `content` is a documented DeepSeek `json_object` failure mode; treat as invalid output, not a Theme choice.
- `json_object` cannot pin the Theme-ID enum at the API. Invented IDs are a selector invalid-output, caught locally.
- If thinking is left on, temperature is ignored and output cost can jump; the runner **blocks** thinking-on configs.
- Nondeterministic outputs remain possible at temperature 0.

## GO / HOLD

**GO (this step):** configs, adapter, catalog, registry, local tests, dry-runs.

**HOLD:** any `--execution-mode paid-api` DeepSeek call until explicit authorization.

Smoke GO after a future paid run: HTTP 200, `validation_status: valid`, usage + catalog USD, request snapshot `thinking.type === "disabled"`, wall time ≫ 2 ms, fingerprint/model stored when returned.

Smoke HOLD: empty content, 401/403, thinking still on, unknown cost, invented IDs.

Do not rank models on n=10 Micro-F1. Gold is one reader’s interpretation. Unified four-model blinded human eval is planned and **not generated**.
