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
  --retrieval-artifact research/retrieval/formal-study/runs/<retrieval-run-id>/run.json `
  --run-id formal-selector-openai-pilot-YYYYMMDD `
  --max-requests 40 `
  --timeout-ms 60000 `
  --retry-limit 2
```

`--allow-paid-api` is required. Without it the process stops before any request. To cap dollars, add a rate for that provider and model to `pricing/pricing-catalog.v1.json`, then add `--max-estimated-budget-usd <amount>`. A budget with no matching rate stops before the first request. The bundled catalog has no prices.

DeepSeek uses `DEEPSEEK_API_KEY` and `selector-deepseek.pilot.v1.json`. Gemini uses `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) and `selector-gemini.pilot.v1.json`. The API key is sent as a header, not in the URL.

## Local Ollama selector

```powershell
$env:OLLAMA_HOST = "http://127.0.0.1:11434"
$env:PGWHITE_SELECTOR_MODEL = "<ollama model id>"
npm run research:formal:run -- --stage selection --execution-mode local --config research/retrieval/formal-study/configs/selector-ollama.pilot.v1.json --retrieval-artifact research/retrieval/formal-study/runs/<retrieval-run-id>/run.json --run-id formal-selector-ollama-pilot-YYYYMMDD
```

Quantization and VRAM are recorded when `POST /api/show` and `GET /api/ps` return them. USD cost stays unknown unless the pricing catalog has a rate.
