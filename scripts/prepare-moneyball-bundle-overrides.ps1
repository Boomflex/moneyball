param(
  [string]$Fm26Path = "C:\Program Files (x86)\Steam\steamapps\common\Football Manager 26",
  [string[]]$BundleNames = @(
    "ui-tiles_assets_all.bundle",
    "ui-tileslayouts_assets_all.bundle"
  )
)

$ErrorActionPreference = "Stop"

$SourceDir = Join-Path $Fm26Path "fm_Data\StreamingAssets\aa\StandaloneWindows64"
$OverrideDir = Join-Path $Fm26Path "BepInEx\config\MoneyballUiTweaks\bundle-overrides"

if (-not (Test-Path $SourceDir)) {
  throw "Could not find FM26 UI bundle directory at $SourceDir"
}

New-Item -ItemType Directory -Force -Path $OverrideDir | Out-Null

foreach ($BundleName in $BundleNames) {
  $Source = Join-Path $SourceDir $BundleName
  $Destination = Join-Path $OverrideDir $BundleName

  if (-not (Test-Path $Source)) {
    Write-Warning "Skipping missing bundle: $Source"
    continue
  }

  if (Test-Path $Destination) {
    Write-Host "Already staged: $Destination"
    continue
  }

  Copy-Item -LiteralPath $Source -Destination $Destination
  Write-Host "Staged override copy: $Destination"
}

Write-Host ""
Write-Host "Original FM26 bundles were not modified."
Write-Host "To revert an override, delete its copy from:"
Write-Host $OverrideDir
