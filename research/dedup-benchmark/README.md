# Dedup Benchmark (R&D)

See [docs/research/1.3-dedup-benchmark.md](../../docs/research/1.3-dedup-benchmark.md).

```bash
pnpm research:dedup:export-seeds   # READ-ONLY, once
pnpm research:dedup:generate       # offline
pnpm research:dedup:benchmark      # offline → output/
pnpm research:dedup:dry-run -- --seed <id> --text "…"
```

**ZERO database mutation** after seed export.
