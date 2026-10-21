# PGWhite Formal Retrieval + Selector Study

**Status:** benchmark and 10-quote pilot are frozen. Formal retrieval and selector infrastructure is implemented. EL (GPT-5 mini vs GPT-5.2 on Qwen Top20) is prepared and not yet executed. Await explicit approval before paid API calls.

## Layout

```text
formal-study/
  README.md
  protocol/           # study protocol + Phase 1 matrix
  ontology/           # frozen ontology snapshot + freeze note
  benchmark/          # source snapshot; formal frozen bench (after human review)
  audit/              # audit + human-review artifacts (EDIT HERE)
  schemas/            # manifest / run schemas
  configs/            # planned formal configs, including EL
  el/                 # EL registry and model verification
  runs/               # immutable formal runs (gitignored)
  archives/           # recoverable EL archives (gitignored)
  summaries/          # cross-run tables
  adjudication/       # post-freeze GT issues (never silent GT edits)
  environment/        # capture templates
```

## Freeze pipeline

```text
original fixtures (immutable)
  → audit/ (this step)
  → human review of TSV/MD
  → benchmark/formal-benchmark.v1.frozen.json  (frozen; see benchmark/FREEZE.md)
  → benchmark/formal-pilot-10.v1.frozen.json
  → Phase 1 embedding matrix (not started)
```

## Open the human review file

**Primary editable file:**

`research/retrieval/formal-study/audit/benchmark-human-review.v1.tsv`

Companion narrative:

`research/retrieval/formal-study/audit/benchmark-human-review.v1.md`
