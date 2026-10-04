# Fixtures

| File | Version | Notes |
|------|---------|-------|
| `benchmark.v1.json` | `annotation-bench-v1.1` | Frozen **102** Quotes (40 + 12 + 50); quote 1399 excluded |
| `taxonomy.v1.json` | `taxonomy-theme-device-v1-excl-time` | Theme 时间 excluded from reconcileTargets |
| `examples/` | mock dry-run copies | Optional committed examples for review |

```bash
pnpm research:annotation:export-fixture   # READ-ONLY re-export
pnpm research:annotation:dry-run          # mock outputs only
pnpm research:annotation:free-concepts    # live free-concept stage (requires valid OPENAI_API_KEY)
```

Legacy tags in the fixture are **weak human references**, not ground truth.
