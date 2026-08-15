param(
  [string]$Fm26Path = "C:\Program Files (x86)\Steam\steamapps\common\Football Manager 26"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Dll = Join-Path $ProjectRoot "dist\bepinex\MoneyballUiInspector.dll"
$PluginDir = Join-Path $Fm26Path "BepInEx\plugins\MoneyballUiInspector"

if (-not (Test-Path $Dll)) {
  & (Join-Path $PSScriptRoot "build-moneyball-ui-inspector-plugin.ps1") -Fm26Path $Fm26Path
}

New-Item -ItemType Directory -Force -Path $PluginDir | Out-Null
Copy-Item -LiteralPath $Dll -Destination (Join-Path $PluginDir "MoneyballUiInspector.dll") -Force
Write-Host "Installed MoneyballUiInspector.dll to $PluginDir"
