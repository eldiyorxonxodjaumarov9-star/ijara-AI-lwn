# Smoke: hermes CLI + forbidden env + mock fixture present
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Write-Host "=== Hermes smoke ==="
$hermes = Get-Command hermes -ErrorAction SilentlyContinue
if ($hermes) {
  hermes --version
  hermes doctor
} else {
  Write-Host "BLOCKER: hermes CLI not on PATH — run official installer"
}
if ($env:DATABASE_URL) { Write-Host "FAIL: DATABASE_URL set in Hermes shell"; exit 2 }
if ($env:TELEGRAM_BOT_TOKEN) { Write-Host "FAIL: TELEGRAM_BOT_TOKEN set"; exit 2 }
$fixture = Join-Path $Root "fixtures\daily-snapshot.mock.json"
if (-not (Test-Path $fixture)) { Write-Host "FAIL: missing fixture"; exit 1 }
Write-Host "OK: fixture present"
Get-ChildItem (Join-Path $Root "skills") | ForEach-Object { Write-Host "skill: $($_.Name)" }
