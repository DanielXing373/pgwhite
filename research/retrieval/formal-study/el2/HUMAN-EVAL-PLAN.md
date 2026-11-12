# EL2 human-evaluation preparation plan

Status: **plan only**. Do not generate or launch a participant-facing pack until separately authorized.

## What participants will see

For each assigned quotation:

- The original Chinese quotation
- Four anonymous Theme sets (labels + definitions), in a **per-question shuffled order**
- Sources (never shown): Human Gold, Embedding Top2, GPT-6 Luna 0–2, DeepSeek Flash 0–2

Do **not** equalize Theme counts. Gold may have 0–5 Themes; Embedding always has 2; LLMs have 0–2 in recorded order. Record `theme_count` for each set.

Human Gold is **not** an answer key in this preference study.

## Sampling

- Pool: all 58 frozen quotes
- Each participant: 10–20 unique quotes, sampled without replacement from the 58
- Preserve `el1_pilot` as private metadata (the original 10 EL1 quotes)

Reserved seed: `20261022` (`el2/registry.json`).

Helpers (not a launched study): `el2/src/preferencePrep.mjs` (`planPreferenceDisplayOrder`, `sampleQuotesForParticipant`).

## Collision handling

Before the final pack, re-run collision detection across **all four** sources:

- Identical **ordered** lists
- Identical **unordered** ID sets

Gold vs Embedding collisions are already in `el2/baselines/coverage.v1.json`. Luna and Flash cannot be included until those runs complete. Collisions are reported, not repaired; participants may still see identical-looking sets.

## Public vs private

Public items: quote text, shuffled Theme sets, Theme counts, item IDs.  
Private mapping: source identities, run IDs, model IDs, `el1_pilot`, Gold IDs, display-order permutation.

Do not include costs, tokens, or model names in public files.
