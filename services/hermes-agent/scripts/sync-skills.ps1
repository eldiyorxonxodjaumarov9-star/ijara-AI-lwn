# Sync Arenda skills into HERMES_HOME/skills (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Src = Join-Path $Root "skills"
$HomeDir = if ($env:HERMES_HOME) { $env:HERMES_HOME } else { Join-Path $env:USERPROFILE ".hermes" }
$Dest = Join-Path $HomeDir "skills"
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item -Path (Join-Path $Src "*") -Destination $Dest -Recurse -Force
Write-Host "Synced skills → $Dest"
