# Literary Theme Ontology (LTO) — research source notes

## Upstream

- Project: [Theme Ontology / Literary Theme Ontology](https://www.themeontology.org/)
- Repository: https://github.com/theme-ontology/theming
- Inspected commit: `5a06dc483961b9907914e6baef8de8ffdfc7f22e` (2026-09-28)
- Theme file used: `notes/themes/primary.th.txt`

## License / attribution

- Ontology/theme content: **MIT** (`LICENSE.md` upstream)
- Story descriptions (`.st.txt` `:: Description` sections): **CC BY-SA** — **not used** in PGWhite 1.41 extracts

When redistributing theme text from this extract, retain MIT attribution to Theme Ontology.

## PGWhite usage policy

LTO is a **research/reference** source for 1.41.

- Do **not** blindly import all ~2990 upstream themes into production.
- Prefer upper / early-middle hierarchy nodes and map them to Chinese **atomic** labels.
- Long English phrasal leaves are usually poor PGWhite Tags.
- Exact-name selection only — avoid fuzzy matches that pull false friends (e.g. `death` → `death ray`, `power` → `tidal power`).
- This extract **never** mutates the production `tags` table.

## Hierarchy findings (summary)

- 3 roots: `alternate reality`, `the human world`, `the natural world`
- ~2966 themes in `primary.th.txt`
- Depth roughly 0–9; mass around depth 3–5
- Fields commonly present: Description, Parents; often References/Examples; Aliases less common

See `hierarchy-summary.v1.json` and `themes-selected.v1.json`.

## Re-ingest

```bash
# shallow clone if needed
git clone --depth 1 https://github.com/theme-ontology/theming /tmp/lto-inspect/theming

npm run research:taglib:ingest-lto -- --lto-dir /tmp/lto-inspect/theming
```
