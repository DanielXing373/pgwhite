# Annotation Workbench (1.4 R&D)

See:

- [Audit](../../docs/research/1.4-ai-annotation-audit.md)
- [Checkpoint (pre-live)](../../docs/research/1.4-workbench-checkpoint.md)

**RESEARCH ONLY — ZERO PRODUCTION DATABASE MUTATION.**

```bash
# Read-only: freeze / refresh fixture + taxonomy snapshot
pnpm research:annotation:export-fixture

# Mock dry-run (no live LLM / embedding)
pnpm research:annotation:dry-run

# Review UI (static): open review/index.html and load runs/mock-dry-run-v1/run.json
```

## Pipeline under test

```text
LLM free concepts (zh-literary-rich-v1)
  → embedding reconcile (Theme/Device; 时间 excluded)
  → Existing Assignment | New Personal Concept
```

Not: taxonomy → LLM chooses labels.

## Fixture

- `fixtures/benchmark.v1.json` — `annotation-bench-v1` (~103 Quotes)
- `fixtures/taxonomy.v1.json` — reconcile targets with documented exclusions

## STOP

Do not run live LLM or embedding until product reviews fixture, prompt, schemas, and experiment design.
