# Retrieval runs

Immutable experiment outputs live here:

`research/retrieval/runs/<run-id>/`

Typical files:

- `manifest.json` — compact completion metadata (also used for overwrite protection)
- `run.json` — full results
- `summary.md` — human-readable aggregate
- `analysis.json` — optional post-hoc human classification slots (does not overwrite raw results)

If `manifest.json` already exists, the runner refuses to overwrite unless config explicitly sets `overwrite_completed_runs: true` (default false).
