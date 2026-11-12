# PGWhite Formal Retrieval + Selector Study

**Status:** benchmark and 10-quote pilot are frozen. EL1 five-model Theme-selection is complete and immutable. EL2 (58-quote preference sources) is prepared separately under `el2/`; do not mix EL2 runs into EL1 archives.

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
  el/                 # EL1 registry and model verification
  el2/                # EL2 58-quote preference-source preparation
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
