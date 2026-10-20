# Formal run artifact schema (v1 proposal)

Each completed formal run lives at:

```text
research/retrieval/formal-study/runs/<run_id>/
  manifest.json
  run.json                 # full sample-level evidence
  summary.md
  environment.json
  config.snapshot.json
```

Never overwrite a completed run. To fix a mistake: set `status=invalidated` + reason; create a new `run_id`.

## Required `run.json` content (minimum)

### Run header

- `run_id`, `created_at`, `git_commit_sha`, `git_branch`
- `ontology_version`, `ontology_sha256`, `ontology_path`
- `benchmark_version`, `benchmark_sha256`, `benchmark_path`
- `representation` (A\|B\|C)
- `instruction_mode` (`none`\|`prompt_name=query`\|`task_instruct`)
- `effective_query_instruction` (string or null)
- `query_encoding_description`
- `document_encoding_description`
- embedding provider metadata (model id, revision, dims, normalize, device, dtype, library versions)
- hardware / OS / CUDA / Python / package versions
- aggregate metrics: Recall@5/@10/@20 (+ values list for bootstrap later)
- performance: total runtime, mean/median per-quote latency

### Per quote (`results[]`)

- `quote_id`, `text_zh`
- `expected_theme_ids`, `expected_theme_labels`
- `theme_document_texts` used for the corpus (or pointer to representation build)
- `deterministic_hits[]` (if enabled)
- `ranking[]` preferably **full ontology order**, else at least Top-20, each with:
  - `rank`, `tag_id`, `canonical_zh`
  - `representation_text` (exact string embedded as document)
  - `similarity` (cosine)
- `ranks_of_expected[]` with rank/similarity/in_top_5/10/20
- `recall_at` for 5/10/20
- `effective_query_text` **or** structured `{instruction, query_body, encoding_mode}` proving what the model saw
- `tagging_latency_ms`, errors/retries

### Selector fields (Phase 2+, reserved)

- `candidate_k`, `candidates[]`, `selector_provider`, raw response, parsed ids, tokens, cost, latency
