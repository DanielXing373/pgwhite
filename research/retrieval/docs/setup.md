# Cross-device setup — Qwen3-Embedding on Windows/CUDA

Target experiment machine: Windows + NVIDIA GPU (e.g. RTX 5070 Laptop, 8 GB VRAM) / ample system RAM.

Development machines may lack CUDA. The normal npm test suite uses the **fake** provider and does **not** download Qwen.

## Shared via Git

```bash
git clone https://github.com/DanielXing373/pgwhite.git
cd pgwhite
git fetch --tags origin
git checkout research/1.42-qwen-retrieval
git pull
```

Do not manually copy runner files between machines.

## Environment separation

| Concern | Location |
|---------|----------|
| Repo code / config / small run JSON | Git |
| Python venv | Local (gitignored under `research/retrieval/**/.venv/` or elsewhere) |
| Model weights / HF cache | Local Hugging Face cache (default; do not hardcode paths in config) |
| Large temp matrices | Local / ignored |
| Small run metrics / rankings | `research/retrieval/runs/<run-id>/` (committable) |

Do **not** hardcode absolute paths, usernames, drive letters, or CUDA device IDs in committed config.

## Windows venv + Qwen (experiment machine)

Use PowerShell from the repo root.

### 1) Node (for the retrieval CLI)

Install Node.js 20+ if needed, then:

```powershell
npm install
```

### 2) Python venv

```powershell
py -3.11 -m venv .venv-qwen
.\.venv-qwen\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

### 3) CUDA PyTorch first

Install a **CUDA-enabled** PyTorch build matching your driver from https://pytorch.org  
(Do **not** install a CPU-only wheel if you intend to run with `require_cuda=true`.)

Verify:

```powershell
python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else None)"
```

`torch.cuda.is_available()` must be `True` for Experiment 0.1.

### 4) Sentence Transformers

```powershell
pip install -r research\retrieval\runner\python\requirements-qwen3.txt
```

Optional: point the Node provider at this venv Python (portable; no drive letter required if you activate the venv in the same shell):

```powershell
$env:PGWHITE_PYTHON = "python"
```

Or set `PGWHITE_PYTHON` to the venv’s `python.exe` if you prefer not to activate the venv.

### 5) First model download

The first run downloads `Qwen/Qwen3-Embedding-0.6B` into the local Hugging Face cache. Keep cache/weights **out of Git**.

## Experiment 0.1 — exploratory A/B/C (no ground truth)

From an activated venv shell at repo root, after `git pull` on `research/1.42-qwen-retrieval`:

```powershell
npm run research:retrieval:run -- --config research/retrieval/config/exp0.1-qwen06b.retrieval.v1.json --provider qwen3 --representation A --run-id exp0.1-qwen06b-A

npm run research:retrieval:run -- --config research/retrieval/config/exp0.1-qwen06b.retrieval.v1.json --provider qwen3 --representation B --run-id exp0.1-qwen06b-B

npm run research:retrieval:run -- --config research/retrieval/config/exp0.1-qwen06b.retrieval.v1.json --provider qwen3 --representation C --run-id exp0.1-qwen06b-C
```

Each run is immutable. Re-running the same `--run-id` after completion is refused.

Artifacts land in:

- `research/retrieval/runs/exp0.1-qwen06b-A/`
- `research/retrieval/runs/exp0.1-qwen06b-B/`
- `research/retrieval/runs/exp0.1-qwen06b-C/`

Then commit the small run JSON/Markdown (not caches/weights) and push the branch.

## Failure behavior (intentional)

The Qwen provider **fails clearly** when:

- Python cannot be started
- `sentence-transformers` / CUDA PyTorch are missing
- `require_cuda=true` but CUDA is unavailable
- the model fails to load

It does **not** silently switch to the fake provider or to CPU under `require_cuda=true`.

## Fake provider reminder

`provider.id=fake` verifies plumbing only. Its rankings are **not** semantic evidence.
