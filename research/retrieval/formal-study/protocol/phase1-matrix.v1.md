# Phase 1 — Embedding 3×3 matrix (PLANNED — do not execute yet)

Model: `Qwen/Qwen3-Embedding-0.6B`  
Ontology: v1.43 freeze  
Benchmark: `formal-benchmark.v1.frozen.json` sha256 `5ad71ae64886fa09a52b8c51e93b8304da3553d09c9dabe9186b03360b5c70da`

| Experiment ID | Representation | Instruction mode | Planned run ID |
|---|---|---|---|
| P1-A-none | A | none | `formal-p1-A-none-<date>` |
| P1-B-none | B | none | `formal-p1-B-none-<date>` |
| P1-C-none | C | none | `formal-p1-C-none-<date>` |
| P1-A-query | A | prompt_name=query | `formal-p1-A-query-<date>` |
| P1-B-query | B | prompt_name=query | `formal-p1-B-query-<date>` |
| P1-C-query | C | prompt_name=query | `formal-p1-C-query-<date>` |
| P1-A-task | A | task_instruct | `formal-p1-A-task-<date>` |
| P1-B-task | B | task_instruct | `formal-p1-B-task-<date>` |
| P1-C-task | C | task_instruct | `formal-p1-C-task-<date>` |

Default literary `task_instruct` text (must be stored verbatim in each run):

```text
Given a Chinese literary quotation, retrieve the literary theme concepts whose meanings are expressed or strongly implied by the quotation. Match concepts by meaning, including implicit themes, rather than by keyword overlap alone.
```

Built-in `prompt_name=query` expands to the model’s stored prompt (web-search default Instruct/Query). Artifacts must record the **effective** prompt string from the loaded model when available.
