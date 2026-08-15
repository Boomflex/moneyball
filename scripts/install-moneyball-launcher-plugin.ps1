param(
  [string]$Fm26Path = "C:\Program Files (x86)\Steam\steamapps\common\Football Manager 26"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Dll = Join-Path $ProjectRoot "dist\bepinex\MoneyballLauncher.dll"
$PluginDir = Join-Path $Fm26Path "BepInEx\plugins\MoneyballLauncher"

if (-not (Test-Path $Dll)) {
  & (Join-Path $PSScriptRoot "build-moneyball-launcher-plugin.ps1") -Fm26Path $Fm26Path
}

New-Item -ItemType Directory -Force -Path $PluginDir | Out-Null
Copy-Item -LiteralPath $Dll -Destination (Join-Path $PluginDir "MoneyballLauncher.dll") -Force
Write-Host "Installed MoneyballLauncher.dll to $PluginDir"
