# PGWhite research version control

Numeric versions only (`1.41`, `1.42`, …). Never letter suffixes (`1.4A`).

## Accepted releases

Accepted versions live on `main` and receive annotated Git tags:

- `v1.41` → `9026b2a9bde3793829fd418a3c60d1c267cdfd05`
- `v1.42` (not created until 1.42 is accepted)

## Active research

Work happens on dedicated branches. Current:

- `research/1.42-qwen-retrieval`

Do not develop research versions directly on `main`.

## Version metadata (per research version)

Record when known:

| Field | Notes |
|-------|--------|
| Base commit SHA | Accepted prior version (e.g. `v1.41`) |
| Final accepted commit SHA | Only after acceptance — do not invent early |
| Git tag | After acceptance (`v1.42`, …) |
| Models / configs | Model id, revision, representation A/B/C, run config |
| Benchmark / data version | Fixture schema + content hash |

## Cross-device workflow

1. **Development machine:** commit → push research branch  
2. **Experiment machine (e.g. RTX 5070):** `git pull` / checkout same branch → run experiment → commit result artifacts → push  
3. **Development machine:** `git pull` → analyze  

Do not rely on manually copying runner files between machines.
