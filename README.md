# Moneyball Recruitment Browser App

A static browser version of the recruitment workbook. It keeps the workbook flow as app tabs: CSV import, Best Buy, Squad Need, Role Sheets, Pizza Charts, Player Similarity, League Standards, and Archetype Guide.

## Run locally

```powershell
python -m http.server 5173
```

Open http://localhost:5173.

## Import data

Use the `CSV template` button in the app, or start from `sample-moneyball-import.csv`. The importer matches headers against the original workbook role sheets and accepts either a wide export or role-specific CSV columns. After import, the app shows role detection confidence, matched score-field coverage, missing fields, and any derived fields used for normalization.

## Formula regression checks

Run this before and after any refactor or UI pass:

```powershell
node tests/regression.test.mjs
```

The test covers the real GK, CB, FB, MID/CM, CAM, Winger, and Striker FM26 exports and snapshots the detected role, row counts, top player, role fit, score, VFM, and deal flag. It is intended to catch accidental formula/scoring changes.

## Workbook-derived model

`src/model.js` is generated from `C:\Users\jakek\Downloads\Moneyball Recruitment Spreadsheet 3 E14 Version.xlsx` by `scripts/extract_blueprint.py`. It contains the workbook role inputs, scoring weights, league strength tables, expected value/wage coefficients, and archetype guide.
