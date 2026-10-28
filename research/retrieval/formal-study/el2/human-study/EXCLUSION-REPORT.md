# EL2 four-source exclusion report

**Dataset:** `el2-hs-questions.v1`  
Machine-readable: `EXCLUSION-REPORT.json`

Eligibility recomputed from frozen Gold, Embedding Top2, `EL2-GPT6LUNA`, `EL2-DSFLASH`. Theme sets compared as unordered ID sets. Original order unused for exclusion.

## Totals

| | n |
| --- | --- |
| Original quotations | 58 |
| Invalid model output (Flash `id_not_in_candidates`) | 7 |
| Duplicate Theme sets (any valid pair) | 34 |
| Overlap of the two reasons | 3 |
| Ineligible | 38 |
| **Eligible** | **20** |

Eligible IDs (verified equal to the Phase 1A list):

`batch1-calib-007`, `batch1-calib-013`, `batch1-calib-017`, `batch1-calib-020`, `batch1-calib-021`, `batch1-calib-022`, `batch2-batch2-004`, `batch2-batch2-006`, `batch2-batch2-007`, `batch2-batch2-011`, `batch2-batch2-012`, `batch2-batch2-013`, `batch2-batch2-014`, `batch2-batch2-016`, `batch2-batch2-018`, `batch2-batch2-019`, `batch2-batch2-022`, `batch2-batch2-024`, `batch2-batch2-026`, `batch2-batch2-027`

Pool notes: 14 batch2 / 6 batch1; one EL1-pilot (`batch2-batch2-022`); Gold theme counts 1–5 only (no empty Gold).

Per-quote reasons: `EXCLUSION-REPORT.json`.
