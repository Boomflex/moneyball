# Moneyball Recruitment Browser App

A static browser version of the recruitment workbook. It keeps the workbook maths locked while adding CSV import, a player database, role sheets, player comparison, squad planning, and model reference views.

## Run locally

```powershell
python -m http.server 5173
```

Open http://localhost:5173.

## One-click FM26 launcher

Double-click `launch-moneyball-fm26.bat` to start the Moneyball app, start the real FM26 export bridge, open Moneyball in your browser, and launch Football Manager 26 through Steam.

The launcher uses Steam app id `3551340` for Football Manager 26. If you want to start the helpers without launching FM26:

```powershell
.\scripts\start-moneyball-fm26.ps1 -NoLaunchGame
```

If your export bridge should use a different port:

```powershell
.\scripts\start-moneyball-fm26.ps1 -BridgePort 8713
```

## BepInEx startup plugin

The `MoneyballLauncher` BepInEx plugin starts the Moneyball app and real export bridge when FM26 loads through BepInEx.

Build it:

```powershell
.\scripts\build-moneyball-launcher-plugin.ps1
```

Install it into FM26:

```powershell
.\scripts\install-moneyball-launcher-plugin.ps1
```

After FM26 launches once, BepInEx creates the config at:

```text
C:\Program Files (x86)\Steam\steamapps\common\Football Manager 26\BepInEx\config\com.boomflex.fm26.moneyball.launcher.cfg
```

Use that config to change the Moneyball folder, ports, export folder, or browser opening behavior.

## BepInEx UI inspector

The `MoneyballUiInspector` plugin logs the Unity UI Toolkit element under the mouse so FM26 panels can be mapped without editing bundles.

Build it:

```powershell
.\scripts\build-moneyball-ui-inspector-plugin.ps1
```

Install it into FM26:

```powershell
.\scripts\install-moneyball-ui-inspector-plugin.ps1
```

Controls in FM26:

```text
F10 = toggle UI click logging
F11 = dump current UI tree
```

Logs are written as JSON lines to:

```text
C:\Program Files (x86)\Steam\steamapps\common\Football Manager 26\BepInEx\config\MoneyballUiInspector\ui-events.jsonl
```

Read the latest events:

```powershell
.\scripts\read-ui-inspector-events.ps1
```

## BepInEx UI tweaks

The `MoneyballUiTweaks` plugin hides selected FM26 UI pieces that expose attribute-development information. It also includes a reversible bundle override loader for experimenting with UI layout swaps without modifying Steam's original FM26 files.

Build it:

```powershell
.\scripts\build-moneyball-ui-tweaks-plugin.ps1
```

Install it into FM26:

```powershell
.\scripts\install-moneyball-ui-tweaks-plugin.ps1
```

Current tweak:

```text
Squad > Training > Individual Training
Hide the Progress Report line chart inside TrainingProgressReport
```

After FM26 launches once, BepInEx creates the config at:

```text
C:\Program Files (x86)\Steam\steamapps\common\Football Manager 26\BepInEx\config\com.boomflex.fm26.moneyball.uitweaks.cfg
```

Useful config switches:

```ini
[Individual Training]
HideProgressReportGraph = true

[Bundle Overrides]
Enabled = true
Directory = C:\Program Files (x86)\Steam\steamapps\common\Football Manager 26\BepInEx\config\MoneyballUiTweaks\bundle-overrides
UiBundlesOnly = true
LogRedirects = true
```

The bundle override loader is reversible: place a replacement `.bundle` in the override directory with the same filename as the original, restart FM26, and the plugin redirects FM's load to the replacement. Remove the replacement file, or set `Enabled = false`, to revert.

Prepare local override copies of the likely Player Report UI bundles:

```powershell
.\scripts\prepare-moneyball-bundle-overrides.ps1
```

For the Player Report experiment, the current map is:

```text
Source tile:      PlayerReportPer90 / RadarPolygonGraph / micro-tile-wide-2x1
Destination card: card states-player stats / AllComps / PerformanceSummaryExtended
Likely bundles:  ui-tiles_assets_all.bundle and ui-tileslayouts_assets_all.bundle
```

For the local FM26 bridge prototype, run the app and mock bridge in separate terminals:

```powershell
npm run dev
npm run bridge:mock
```

Open http://127.0.0.1:5173, go to Import, and use the Connect FM26 buttons against `http://127.0.0.1:8711`. The mock bridge returns `sample-moneyball-import.csv`; a BepInEx plugin can replace that endpoint later while keeping the webapp contract stable.

To read real FM26 data through the existing Player Export mod, run this instead of the mock bridge:

```powershell
npm run bridge:exports
```

The export bridge serves the newest `.csv` from:

```text
C:\Users\jakek\OneDrive\Documents\Sports Interactive\Football Manager 26\FM26PlayerExport by vinteset\Exports CSV
```

In FM26, export the player search, squad, shortlist, or benchmark list you want. Then click `Recruitment`, `Your squad`, or `Benchmark` in the Moneyball app. The button you choose decides how Moneyball uses the latest CSV.

For a live-ish workflow, enable `Auto-pull latest export` in the Connect FM26 panel and choose whether new exports should load as recruitment, your squad, or benchmark. Moneyball checks the bridge every few seconds and imports when a newer CSV appears.

If your Player Export folder is somewhere else:

```powershell
$env:FM26_EXPORT_DIR="C:\path\to\Exports CSV"
npm run bridge:exports
```

If PowerShell blocks `npm.ps1`, use the direct Node commands instead:

```powershell
node scripts/dev-server.mjs 5173
node scripts/fm26-export-bridge.mjs
```

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
