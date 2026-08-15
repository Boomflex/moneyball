param(
  [int]$Tail = 30,
  [string]$Fm26Path = "C:\Program Files (x86)\Steam\steamapps\common\Football Manager 26"
)

$Path = Join-Path $Fm26Path "BepInEx\config\MoneyballUiInspector\ui-events.jsonl"
if (-not (Test-Path $Path)) {
  Write-Host "No UI inspector log found at $Path"
  exit 1
}

Get-Content -LiteralPath $Path -Tail $Tail
