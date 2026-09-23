# Analysis / forensic artifacts (Sprint 1C.0)

These files are **forensic migration and audit artifacts**.

They are **NOT** runtime application data.

After Sprint 1C ownership migration has been applied, **runtime application code must not depend on them**.

## Contents

| File | Purpose |
|------|---------|
| `legacy-provenance-reconstruction.json` | Per-quote provenance class, confidence, evidence (read-only reconstruction) |
| `legacy-slug-to-mysql-map.json` | Legacy JSON slug id → MySQL quote id map |
| `legacy-provenance-summary.md` | Human-readable aggregate summary |
| `../scripts/analyze-legacy-provenance.mjs` | Re-runnable READ-ONLY analyzer (requires DB credentials locally) |

## Privacy

Artifacts contain quote text previews/hashes already present in the PGWhite corpus.
They must not contain credentials, API keys, or private WeRead account payloads.
