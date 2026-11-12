# EL-Pilot-10 comparison (exploratory)

This is an **exploratory 10-quote** experiment. It is not a statistical sample. Do not claim significance, rank models for production, or treat gold-label false positives as definitely wrong: they may be reasonable interpretations that the frozen gold set does not include.

Gold, ontology, prompts, and metric definitions were not changed. Metrics are the existing pipeline: end-to-end Micro-F1 is `aggregate_metrics.micro.f1`.

## Runs

| | EL-P1-GPT5MINI | EL-P1-GPT52 |
| --- | --- | --- |
| Snapshot | `gpt-5-mini-2025-08-07` | `gpt-5.2-2025-12-11` |
| Effective config SHA-256 | `808f6e5a82c00430c4983097fa5620cfc45a5bc8f297991a0fc76c96377b8365` | `c284f02dc4b5bcc499a610e4f2a2d60a5eb585547140a9d0db5ebdc7b49dde91` |
| `run.json` SHA-256 | `7d1ab53a40e3848c97902df5450aa8e33175b4890cc1cf03e3c3aa7ec2e38630` | `020b2604aa06e722ea75ff0ec6c53689475d09ea70cb4e3630942ccfaf742d14` |
| Valid outputs | 10 / 10 | 10 / 10 |
| HTTP | 200 | 200 |

Locked inputs match the freeze: ontology `a71db8ba…ed39b7`, pilot `855fd0c3…c70da`, retrieval `formal-p1-c-task-20261021` / `570f9916…34b143d` / effective `775e3d5c…1c9a165a`.

## Automated metrics

| Metric | GPT-5 mini | GPT-5.2 |
| --- | --- | --- |
| Micro-F1 (primary) | 0.476 | 0.500 |
| Micro precision | 0.417 (10 / 24) | 0.400 (12 / 30) |
| Micro recall | 0.556 (10 / 18) | 0.667 (12 / 18) |
| Macro-F1 | 0.542 | 0.558 |
| Exact match | 0 / 10 | 1 / 10 |
| Zero-theme accuracy | 0 / 2 | 0 / 2 |
| Invalid output rate | 0 | 0 |
| Retrieval miss | 4 | 4 |
| Selector miss | 4 | 2 |
| False positive | 14 | 18 |
| Total USD | 0.00561 | 0.02541 |
| USD / quote | 0.00056 | 0.00254 |
| Tokens in / out / reasoning / cached | 11602 / 1469 / 1088 / 1024 | 11602 / 365 / 0 / 0 |
| Sequential mean latency | 2254 ms | 1033 ms |
| Sequential P50 / P95 | 2253 / 3484 ms | 962 / 1487 ms |
| Wall clock | 22.55 s | 10.34 s |

GPT-5.2 has slightly higher Micro-F1 and recall, one exact match (`batch2-batch2-022`), fewer selector misses, more false positives (it always selected 3 Themes), ~4.5× cost, and lower latency with `reasoning_effort: none`.

Both models selected Themes on the two **zero-theme gold** quotes (`batch1-calib-008`, `batch2-batch2-001`). Those predictions are preserved unchanged in the human-eval export. Automated zero-theme accuracy is 0 for both; a human reader may still judge the selected Themes as reasonable scene readings.

## Error attribution note

The 4 retrieval misses are identical in count for both models (gold Themes absent from Qwen Top20). Remaining misses are selector misses. False positives include extra Themes beside a correct gold hit; on this gold set those extras count as FP even when they are plausible.

## Human evaluation

20 blinded samples (10 quotes × 2 models), seed `20261021`. Public export has quote text, selected labels/definitions, and selection status only.
