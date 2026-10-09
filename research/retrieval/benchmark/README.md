# Benchmark fixtures

Versioned Quote inputs for retrieval experiments.

| Fixture | Role |
|---------|------|
| `synthetic-smoke.v1.json` | Infrastructure smoke only; **not** calibration GT |
| `exp0.1-exploratory-single-quote.v1.json` | Experiment 0.1 exploratory (no expected Themes) |
| `calib-zh-themes.v1.json` | **Calibration scaffold** (~20–30 Quotes); starts `status=draft` with empty `quotes[]` |

## Calibration

Manual ground truth only. Rules: `research/retrieval/docs/calibration-rules.md`.

```bash
npm run research:retrieval:validate-calib
```

Do **not** auto-promote GPT free-concepts, Experiment 0.1 rankings, or legacy production tags to ground truth.
