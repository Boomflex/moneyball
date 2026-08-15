param(
  [string]$Fm26Path = "C:\Program Files (x86)\Steam\steamapps\common\Football Manager 26"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Project = Join-Path $ProjectRoot "bepinex\MoneyballUiInspector\MoneyballUiInspector.csproj"
$OutDir = Join-Path $ProjectRoot "dist\bepinex"
$OutDll = Join-Path $OutDir "MoneyballUiInspector.dll"
$CoreDir = Join-Path $Fm26Path "BepInEx\core"
$InteropDir = Join-Path $Fm26Path "BepInEx\interop"
$SystemDotnet = (Get-Command dotnet -ErrorAction SilentlyContinue).Source
$BundledDotnet = "C:\Program Files\Epic Games\UE_5.4\Engine\Binaries\ThirdParty\DotNet\6.0.302\windows\dotnet.exe"
$Dotnet = if (Test-Path $BundledDotnet) { $BundledDotnet } else { $SystemDotnet }

if (-not $Dotnet -or -not (Test-Path $Dotnet)) {
  throw "Could not find a .NET SDK. Install the .NET 6+ SDK or update BundledDotnet in this script."
}
if (-not (Test-Path $Project)) {
  throw "Could not find plugin project at $Project"
}
if (-not (Test-Path $CoreDir)) {
  throw "Could not find BepInEx core folder at $CoreDir"
}
if (-not (Test-Path $InteropDir)) {
  throw "Could not find BepInEx interop folder at $InteropDir"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$env:DOTNET_CLI_HOME = Join-Path $ProjectRoot "tmp\dotnet-home"
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = "1"
$env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"
$env:NUGET_PACKAGES = Join-Path $ProjectRoot "tmp\nuget-packages"
New-Item -ItemType Directory -Force -Path $env:DOTNET_CLI_HOME | Out-Null
New-Item -ItemType Directory -Force -Path $env:NUGET_PACKAGES | Out-Null

& $Dotnet build $Project `
  --configuration Release `
  --configfile (Join-Path (Split-Path $Project) "NuGet.Config") `
  -p:Fm26Path="$Fm26Path" `
  -p:OutputPath="$OutDir\"

if ($LASTEXITCODE -ne 0) {
  throw "Plugin build failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path $OutDll)) {
  throw "Expected output DLL was not produced at $OutDll"
}

Write-Host "Built $OutDll"
