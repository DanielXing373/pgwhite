# Reproducibility checklist (pre-matrix)

| Item | Status | Notes |
|---|---|---|
| Ontology freeze candidate (185, hash) | **PASS** | `ontology/FREEZE.md` |
| Ontology snapshot copied | **PASS** | `ontology/atomic-tag-library.v1.43.freeze.json` |
| 58-sample sources located | **PASS** | `benchmark/sources.md` |
| No duplicate IDs/texts | **PASS** | audit integrity |
| Theme ID/label resolve on v1.43 | **PASS** | 0 mismatches |
| Human audit artifact | **PASS** | `audit/benchmark-human-review.v1.tsv` |
| Human freeze of benchmark | **PASS** | 45 APPROVED, 13 EDITED, 0 PENDING |
| Formal frozen benchmark file | **PASS** | `benchmark/FREEZE.md`; sha256 `5ad71ae6…70da` |
| 10-quote pilot freeze | **PASS** | `formal-pilot-10.v1.frozen.json`; sha256 `855fd0c3…9f06` |
| A/B/C construction verified | **PASS** | `representations.mjs` + unit test |
| Instruction modes `none` / `prompt_name=query` / `task_instruct` | **PASS (helpers+worker)** | `qwenInstructionModes.mjs` + `embed_qwen3.py`; exact-string unit tests |
| Formal runner stores effective query text and full ranking | **PASS** | `formal-study/runner`; Recall@5/10/20 from one ranking; effective config snapshot |
| Historical retrieval pipeline aggregates | **PARTIAL** | `run-retrieval-benchmark.mjs` still reports Recall@3/@5. Formal runs use the formal runner. |
| Recall@5/10/20 function correctness | **PASS** | unit test; formal stage passes `[5,10,20]` |
| Environment capture template | **PASS** | `environment/capture-template.json` |
| Experiment manifest | **PASS** | `experiment-manifest.v1.json` (planned) |
| Immutable formal run dir | **PASS** | `runs/` empty |
| Unit/infra tests | see CI command output | |

**Gate:** Formal retrieval and selector infrastructure is implemented and covered by fake-provider tests. The Phase 1 GPU matrix and paid API calls stay stopped until an explicit approval.
