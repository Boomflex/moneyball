param(
  [int]$AppPort = 5173,
  [int]$BridgePort = 8712,
  [string]$SteamAppId = "3551340",
  [string]$GamePath = "",
  [string]$ExportDir = "",
  [switch]$NoOpenSite,
  [switch]$NoLaunchGame
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Node = (Get-Command node -ErrorAction Stop).Source
$MoneyballUrl = "http://127.0.0.1:$AppPort/"
$BridgeUrl = "http://127.0.0.1:$BridgePort"

function Test-Url($Url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
    return @{
      Ok = $true
      Content = [string]$response.Content
    }
  } catch {
    return @{
      Ok = $false
      Content = $_.Exception.Message
    }
  }
}

function Start-HiddenNode($Arguments) {
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $Node
  $psi.Arguments = $Arguments
  $psi.WorkingDirectory = $ProjectRoot
  $psi.UseShellExecute = $true
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  [void][System.Diagnostics.Process]::Start($psi)
}

function Wait-ForUrl($Url, $Name) {
  for ($i = 0; $i -lt 20; $i += 1) {
    $probe = Test-Url $Url
    if ($probe.Ok) {
      Write-Host "$Name ready at $Url"
      return $probe
    }
    Start-Sleep -Milliseconds 350
  }
  throw "$Name did not become ready at $Url"
}

$appProbe = Test-Url $MoneyballUrl
if ($appProbe.Ok) {
  Write-Host "Moneyball app already running at $MoneyballUrl"
} else {
  Write-Host "Starting Moneyball app on port $AppPort"
  Start-HiddenNode "scripts\dev-server.mjs $AppPort"
  Wait-ForUrl $MoneyballUrl "Moneyball app" | Out-Null
}

$bridgeProbe = Test-Url "$BridgeUrl/health"
if ($bridgeProbe.Ok -and $bridgeProbe.Content -like '*fm26-player-export-folder*') {
  Write-Host "FM26 export bridge already running at $BridgeUrl"
} else {
  if ($bridgeProbe.Ok) {
    Write-Host "Port $BridgePort is responding, but it is not the real export bridge. Starting a real bridge may fail unless that port is free."
  }
  Write-Host "Starting FM26 export bridge on port $BridgePort"
  $bridgeArgs = "scripts\fm26-export-bridge.mjs $BridgePort"
  if ($ExportDir) {
    $bridgeArgs = "$bridgeArgs `"$ExportDir`""
  }
  Start-HiddenNode $bridgeArgs
  Wait-ForUrl "$BridgeUrl/health" "FM26 export bridge" | Out-Null
}

if (-not $NoOpenSite) {
  Start-Process $MoneyballUrl
}

if (-not $NoLaunchGame) {
  if ($GamePath) {
    Start-Process -FilePath $GamePath
  } else {
    Start-Process "steam://rungameid/$SteamAppId"
  }
}

Write-Host ""
Write-Host "Moneyball is ready."
Write-Host "App:    $MoneyballUrl"
Write-Host "Bridge: $BridgeUrl"
Write-Host "In Moneyball, use endpoint $BridgeUrl and enable Auto-pull latest export."
