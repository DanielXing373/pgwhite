# Cross-device setup (future Qwen run)

Target experiment machine (later): Windows + NVIDIA RTX 5070 Laptop (8 GB VRAM) / 32 GB RAM.

This foundation does **not** require CUDA or model weights on the development machine.

## Shared via Git

On the experiment machine:

```bash
git clone <repo-url> pgwhite
cd pgwhite
git fetch --tags
git checkout research/1.42-qwen-retrieval
git pull
```

Do not manually copy runner files between machines.

## Environment separation

| Concern | Location |
|---------|----------|
| Repo code / config / small run JSON | Git |
| Python/Node runtime | Local machine environment |
| Model weights / HF cache | Local cache dirs (gitignored) |
| Large temp embedding matrices | Local / ignored |
| Small run metrics / rankings | `research/retrieval/runs/<run-id>/` (committable) |

Do **not** hardcode absolute paths, usernames, drive letters, or CUDA device IDs in config.

## Planned future real-provider steps (not implemented here)

1. Implement `provider.id=qwen3` (or equivalent) calling `Qwen/Qwen3-Embedding-0.6B` behind the existing `embed(texts)` boundary.
2. Create the curated 20–30 Quote calibration fixture (separate task).
3. Run A, then B, then C with distinct `--run-id`s.
4. Commit small run artifacts; push branch; analyze on the development machine after `git pull`.

## Fake provider reminder

`provider.id=fake` verifies plumbing only. Its Recall numbers are **not** semantic evidence.
