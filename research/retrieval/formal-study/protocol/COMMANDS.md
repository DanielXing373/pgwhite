# Commands

Do not start the Phase 1 GPU matrix or a paid selector until that run is explicitly approved.

`dry-run` reads the frozen files and prints the effective plan. It does not load the embedding model and does not call an API. The exception is a **fake selector** dry-run: that path writes a 10-quote selection artifact using the in-process fake provider. It still does not call OpenAI, Ollama, or the GPU embedder.

## Checks that do not use the GPU or a paid API

```bash
npm test
npm run research:retrieval:test
npm run research:formal:run -- \
  --stage retrieval \
  --execution-mode dry-run \
  --config research/retrieval/formal-study/configs/P1-C-none.retrieval.v1.json
```

## Windows RTX 5070 Laptop — Phase 1 retrieval

Run this from the repository root in PowerShell. `PGWHITE_PYTHON` must point at the CUDA virtualenv. Each command uses a new run id. A second launch with the same id is refused.

```powershell
$env:PGWHITE_PYTHON = "C:\path\to\venv\Scripts\python.exe"
npm run research:formal:run -- --stage retrieval --execution-mode local --config research/retrieval/formal-study/configs/P1-A-none.retrieval.v1.json --run-id formal-p1-A-none-YYYYMMDD
npm run research:formal:run -- --stage retrieval --execution-mode local --config research/retrieval/formal-study/configs/P1-B-none.retrieval.v1.json --run-id formal-p1-B-none-YYYYMMDD
npm run research:formal:run -- --stage retrieval --execution-mode local --config research/retrieval/formal-study/configs/P1-C-none.retrieval.v1.json --run-id formal-p1-C-none-YYYYMMDD
npm run research:formal:run -- --stage retrieval --execution-mode local --config research/retrieval/formal-study/configs/P1-A-query.retrieval.v1.json --run-id formal-p1-A-query-YYYYMMDD
npm run research:formal:run -- --stage retrieval --execution-mode local --config research/retrieval/formal-study/configs/P1-B-query.retrieval.v1.json --run-id formal-p1-B-query-YYYYMMDD
npm run research:formal:run -- --stage retrieval --execution-mode local --config research/retrieval/formal-study/configs/P1-C-query.retrieval.v1.json --run-id formal-p1-C-query-YYYYMMDD
npm run research:formal:run -- --stage retrieval --execution-mode local --config research/retrieval/formal-study/configs/P1-A-task.retrieval.v1.json --run-id formal-p1-A-task-YYYYMMDD
npm run research:formal:run -- --stage retrieval --execution-mode local --config research/retrieval/formal-study/configs/P1-B-task.retrieval.v1.json --run-id formal-p1-B-task-YYYYMMDD
npm run research:formal:run -- --stage retrieval --execution-mode local --config research/retrieval/formal-study/configs/P1-C-task.retrieval.v1.json --run-id formal-p1-C-task-YYYYMMDD
```

Constants in those configs: `Qwen/Qwen3-Embedding-0.6B`, 185 Themes, 58 quotes, cosine similarity, normalized embeddings, no reranker. The run stores the full 185-row ranking and derives Recall@5, Recall@10, and Recall@20 from it.

## Fake-provider 10-quote selector dry-run

Uses the frozen pilot (not the first 10 quotes of the 58-quote retrieval run) and the stored C-task rankings. Do not treat fake accuracy as a research result.

```powershell
npm run research:formal:run -- `
  --stage selection `
  --execution-mode dry-run `
  --config research/retrieval/formal-study/configs/selector-fake.pilot.v1.json `
  --retrieval-artifact research/retrieval/formal-study/runs/formal-p1-c-task-20261021/run.json `
  --run-id formal-selector-fake-pilot-YYYYMMDD `
  --max-requests 10
```

## OpenAI 10-quote pilot

Use a retrieval `run.json` from a completed formal retrieval run. The selector reads that file and does not re-embed. Set the model id in the environment. There is no universal default model. The key stays in the environment and is not written into the run.

```powershell
$env:OPENAI_API_KEY = "<set in this shell only>"
$env:PGWHITE_SELECTOR_MODEL = "<operator-chosen model id>"
npm run research:formal:run -- `
  --stage selection `
  --execution-mode paid-api `
  --allow-paid-api `
  --config research/retrieval/formal-study/configs/selector-openai.pilot.v1.json `
  --retrieval-artifact research/retrieval/formal-study/runs/formal-p1-c-task-20261021/run.json `
  --run-id formal-selector-openai-pilot-YYYYMMDD
```

`--allow-paid-api` is required. Without it the process stops before any request. The OpenAI pilot config locks the C-task retrieval artifact by run id and SHA-256 and sets `max_estimated_budget_usd` to 1.00. That USD stop is computed after each call from reported tokens; it is not a guaranteed pre-call cap. The bundled catalog has no rates, so a budget-capped OpenAI run stops before the first request until an operator adds a verified rate for the exact model id. `max_requests` is 10 (one call budget per frozen pilot quote; retries share that budget).

DeepSeek uses `DEEPSEEK_API_KEY` and `selector-deepseek.pilot.v1.json`. Gemini uses `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) and `selector-gemini.pilot.v1.json`. The API key is sent as a header, not in the URL.

## Local Ollama selector

```powershell
$env:OLLAMA_HOST = "http://127.0.0.1:11434"
$env:PGWHITE_SELECTOR_MODEL = "<ollama model id>"
npm run research:formal:run -- --stage selection --execution-mode local --config research/retrieval/formal-study/configs/selector-ollama.pilot.v1.json --retrieval-artifact research/retrieval/formal-study/runs/formal-p1-c-task-20261021/run.json --run-id formal-selector-ollama-pilot-YYYYMMDD
```

Quantization and VRAM are recorded when `POST /api/show` and `GET /api/ps` return them. USD cost stays unknown unless the pricing catalog has a rate.

## EL batch (prepared; do not execute until approved)

EL uses the frozen 10-quote pilot and the locked C-task retrieval artifact. Identifiers: `EL`, `EL-Pilot-10`, `EL-P1-GPT5MINI`, `EL-P1-GPT52`. Registry: `research/retrieval/formal-study/el/registry.json`.

`max_requests` is the hard pre-call cap. `max_estimated_budget_usd` is 1.00 and is a post-call estimated-spend stop, not a guaranteed pre-call cap.

Dry-run (no API):

```powershell
npm run research:formal:run -- --stage selection --execution-mode dry-run --config research/retrieval/formal-study/configs/EL-P1-GPT5MINI.selection.v1.json
npm run research:formal:run -- --stage selection --execution-mode dry-run --config research/retrieval/formal-study/configs/EL-P1-GPT52.selection.v1.json
```

Single-quote smoke tests (not part of the EL-Pilot comparison). Do not run until approved:

```powershell
$env:OPENAI_API_KEY = "<set in this shell only>"
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL-P1-GPT5MINI.smoke.v1.json --run-id EL-P1-GPT5MINI-SMOKE
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL-P1-GPT52.smoke.v1.json --run-id EL-P1-GPT52-SMOKE
```

Formal 10-quote EL pilots (do not run until approved; do not include smoke predictions):

```powershell
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL-P1-GPT5MINI.selection.v1.json --run-id EL-P1-GPT5MINI
npm run research:formal:run -- --stage selection --execution-mode paid-api --allow-paid-api --config research/retrieval/formal-study/configs/EL-P1-GPT52.selection.v1.json --run-id EL-P1-GPT52
```

Archive a completed run (local, gitignored, overwrite refused):

```powershell
node research/retrieval/formal-study/runner/scripts/archive-el-run.mjs --run-dir research/retrieval/formal-study/runs/EL-P1-GPT5MINI --archive-dir research/retrieval/formal-study/archives/EL-P1-GPT5MINI --experiment-id EL-P1-GPT5MINI
```

Copy `research/retrieval/formal-study/archives/` to external storage yourself. Do not upload research artifacts without explicit authorization.
