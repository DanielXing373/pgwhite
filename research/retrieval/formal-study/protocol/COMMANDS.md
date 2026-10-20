# Commands (DO NOT run the Phase 1 matrix yet)

## Infrastructure only (safe now)

```bash
# Unit / retrieval tests (no GPU matrix)
npm test

# Calibration validator (historical fixture; unrelated to formal freeze)
npm run research:retrieval:validate-calib

# Tag library tests
npm run research:taglib:test
```

## After human benchmark freeze (future)

```bash
# Example — placeholders only; configs not executed in this prep step
npm run research:retrieval:run -- \
  --config research/retrieval/formal-study/configs/P1-C-none.retrieval.v1.json \
  --provider qwen3 \
  --representation C \
  --run-id formal-p1-C-none-YYYYMMDD
```

Repeat for all nine Phase 1 experiment IDs with unique `run_id`s.  
Never reuse a completed `run_id`. Never overwrite `formal-study/runs/*`.
