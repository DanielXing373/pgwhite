# Formal study run artifact (v1)

Each run is a new directory:

```text
research/retrieval/formal-study/runs/<run_id>/
  manifest.json
  run.json
  summary.md
  environment.json
  config.snapshot.json
```

The writer refuses a non-empty directory. A mistake is a new `run_id`. `config.snapshot.json` is the effective configuration after CLI overrides, including `execution_mode`. Its SHA-256 is `effective_config_sha256` in `run.json`. The source file hash is `provenance.source_config_sha256`.

`run.json` uses `schema_version` `formal-study-run.v1`.

## Retrieval

Header: run id, experiment id, git SHA, branch, dirty flag, ontology and benchmark paths and hashes, representation, instruction mode, effective query instruction, query and document encoding descriptions, provider metadata, full Theme document texts, Recall@5/10/20 with denominators, sequential latency (P50/P95) and total wall time. `concurrent` stays null.

Each quote stores the Chinese text, expected Theme IDs in frozen-file order, the exact query text sent to the encoder, per-quote latency, and the ranking of all active Themes. Each ranking row has rank, Theme ID, label, the exact representation text, and cosine similarity. Expected-Theme ranks include `in_top_5`, `in_top_10`, and `in_top_20`. Zero-theme quotes keep Recall@K unevaluated (`recall: null`).

For `prompt_name=query`, the preview uses the loaded model's `prompts["query"]` when the worker reports it. Otherwise it stores the documented Sentence-Transformers prefix and marks the source `documented_sentence_transformers_default`.

## Selection

The run records the retrieval artifact path and SHA-256. It does not re-embed. Each quote stores the prompt the model saw, candidate IDs, labels, definitions, optional aliases, raw response, parsed IDs, validation status, token usage, retries, latency, and USD cost. Cost is `unknown` when tokens or a catalog rate are missing.

Aggregate selection metrics report micro and macro precision, recall, and F1 with denominators, exact-match rates, zero-theme accuracy, mean selected count, and invalid-output rate. A zero denominator stays null.

## Credentials

API keys are read from `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, and `GEMINI_API_KEY` or `GOOGLE_API_KEY`. They are not written to the artifact. Authorization headers are dropped, and secret-shaped strings are redacted.
