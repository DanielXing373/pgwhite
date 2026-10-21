# EL experiment batch

EL compares how accurately two OpenAI models select 0–3 literary Themes from the frozen Qwen Top20 candidates. Automated metrics use the existing selection pipeline. Human evaluation is model-blinded and is organized separately by the project owner.

**Status:** infrastructure prepared. No EL paid API calls have been executed.

## Identifiers

| Role | ID |
| --- | --- |
| Experiment batch | EL |
| Pilot dataset | EL-Pilot-10 |
| GPT-5 mini formal run | EL-P1-GPT5MINI |
| GPT-5.2 formal run | EL-P1-GPT52 |
| GPT-5 mini smoke | EL-P1-GPT5MINI-SMOKE |
| GPT-5.2 smoke | EL-P1-GPT52-SMOKE |

Do not rename historical Phase 1 or Phase 2 runs. Do not mark an experiment `completed` until that run has actually finished.

Registry: `research/retrieval/formal-study/el/registry.json`

## Locked inputs

- Ontology SHA-256 `a71db8ba7e34ea5c2db33b53a6c1583d8ac8bbf3e11871198bf0deedc0ed39b7`
- Benchmark SHA-256 `5ad71ae64886fa09a52b8c51e93b8304da3553d09c9dabe9186b03360b5c70da`
- Pilot SHA-256 `855fd0c338daf008259f8ae1886300a02cc1e9b02bc25d5a01dd611faba09f06`
- Retrieval run `formal-p1-c-task-20261021`
- Retrieval artifact SHA-256 `570f99165e5ced8d3ddff16a7b9d21e231b86bc58d97d2ab6584ededb34b143d`
- Retrieval effective config SHA-256 `775e3d5c4b54dc3da84a1efc1e24a515bc23fe4fad26a7e359ca7dc01c9a165a`

Qwen3-Embedding-0.6B, representation C, `task_instruct`, cosine, normalized embeddings, 185 Themes, Top20, no reranker.

## Budget

`max_requests` is the hard pre-call cap (10 for the formal pilot, 1 for smoke). `max_estimated_budget_usd` is **1.00** and is a **post-call estimated-spend stop**. It is not a guaranteed pre-call cap. A single response can still exceed $1. Unknown token usage blocks later calls. Budget validation is not disabled.

## Archive

After a real run:

```powershell
node research/retrieval/formal-study/runner/scripts/archive-el-run.mjs `
  --run-dir research/retrieval/formal-study/runs/<run-id> `
  --archive-dir research/retrieval/formal-study/archives/<run-id> `
  --experiment-id EL-P1-GPT5MINI
```

Archives are local, gitignored, refuse overwrite, copy without modifying the original run, hash every file with SHA-256, and validate after write. Copy the `archives/` folder to external storage yourself. Do not upload research artifacts without explicit authorization.

## Human evaluation export

After both formal EL runs exist, export blinded samples (this does not fabricate results):

```powershell
node research/retrieval/formal-study/runner/scripts/export-el-human-eval.mjs `
  --run research/retrieval/formal-study/runs/EL-P1-GPT5MINI/run.json `
  --run research/retrieval/formal-study/runs/EL-P1-GPT52/run.json `
  --seed 20261021 `
  --public-out research/retrieval/formal-study/archives/EL-human-eval/public.json `
  --private-out research/retrieval/formal-study/archives/EL-human-eval/private-mapping.json
```

The public file has sample IDs, Chinese quotes, selected Theme labels/definitions, and selection status. It must not include model names, providers, run IDs, costs, tokens, gold labels, or automated scores. The private mapping stays in the archive.

## Automated metrics

Primary: end-to-end Micro-F1 (`aggregate_metrics.micro.f1`). Secondary: micro precision/recall, macro-F1, exact match, zero-theme accuracy, invalid output rate, cost per quote, latency per quote. Error attribution: retrieval miss, selector miss, false positive. Pilot numbers are exploratory.

## Smoke tests (do not run until approved)

Smoke configs keep the frozen 10-quote file and hash, then select `batch1-calib-005` only. Formal 10-quote validation is unchanged.

See `protocol/COMMANDS.md`.
