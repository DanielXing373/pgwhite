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
| Pipeline stores effective query preview per quote | **FAIL / PARTIAL** | helper exists; formal runner wiring + full ranking@10/20 aggregates still needed before matrix |
| Recall@5/10/20 function correctness | **PASS** | unit test; current route pipeline defaults aggregate ks to `[3,5]` — formal configs must pass `[5,10,20]` |
| Environment capture template | **PASS** | `environment/capture-template.json` |
| Experiment manifest | **PASS** | `experiment-manifest.v1.json` (planned) |
| Immutable formal run dir | **PASS** | `runs/` empty |
| Unit/infra tests | see CI command output | |

**Gate:** The benchmark freeze is cleared. Phase 1 GPU matrix must still not start until formal runner wiring stores sample-level `effective_query_preview` and R@5/10/20 aggregates.
