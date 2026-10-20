# Formal Study Protocol v1 (pre-approval)

## Research question

Given a **fixed** Chinese Theme ontology, which pipeline best trades off candidate recall, final annotation quality, cost, and latency?

```text
Chinese Quote
  → Candidate Retrieval (Stage A)
  → Top-K existing Themes
  → Constrained LLM Selector (Stage B; later)
  → 0–N existing Themes
```

Stages are scored independently.

## Controlled constants (Phase 1)

- Ontology: frozen `atomic-tag-library.v1.43` (185 Themes) — see `ontology/FREEZE.md`
- Benchmark: formal frozen 58-quote set — **pending human approval**
- Embedding model: `Qwen/Qwen3-Embedding-0.6B` (until later phases change it)
- Similarity: cosine on L2-normalized embeddings
- Hardware: single declared CUDA machine per run (recorded in artifacts)
- No reranker in the initial 3×3 matrix
- No paid LLM selector yet

## Independent variables (Phase 1)

| Factor | Levels |
|---|---|
| Representation | A, B, C |
| Qwen query encoding | `none`, `prompt_name=query`, `task_instruct` |

Nine runs. One full ranking per run; derive Recall@5/@10/@20 offline.

## Later phases (not started)

2. Rerank only on ~2 survivors (identical pools; report coverage vs R@K)  
3. Provider-agnostic selector on stored Top-K truncations (5/10/20)  
4. End-to-end Pareto (quality × cost × latency)  
5. Larger adjudicated validation

## GT integrity

Never edit frozen GT to improve metrics. Log disputes under `adjudication/`.
