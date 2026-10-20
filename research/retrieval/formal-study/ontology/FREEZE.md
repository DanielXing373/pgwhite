# Ontology Freeze Candidate — LOCKED for this study

| Field | Value |
|---|---|
| Library version | `atomic-tag-library.v1.43` |
| Active Themes | **185** |
| Devices (unused in Theme study) | 31 |
| Authoritative path | `research/tag-library/data/library/atomic-tag-library.v1.43.json` |
| Study snapshot | `research/retrieval/formal-study/ontology/atomic-tag-library.v1.43.freeze.json` |
| SHA-256 | `a71db8ba7e34ea5c2db33b53a6c1583d8ac8bbf3e11871198bf0deedc0ed39b7` |
| Freeze Git SHA (prep) | `3b6c9547178aa91b2ef3b5612ae87bfc31e64416` |
| Branch | `research/1.42-qwen-retrieval` |

## Hard rules during the study

1. Models **must not** create new Theme types.
2. Valid outputs: `[]`, one Theme, or multiple Themes — all from the frozen 185.
3. **Missing ontology is out of experimental scope.** Do not invent Themes when a quote falls outside coverage.
4. Do not modify the ontology file or snapshot during experiments.
5. Future Theme expansion is a separate product process.

Snapshot SHA-256 must equal the authoritative file hash before any formal run.
