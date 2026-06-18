# Vercel production sozlash (PowerShell)
# Ishlatish: .\scripts\setup-vercel.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "==> Vercel loyihasiga ulanish..." -ForegroundColor Cyan
npx vercel@latest link --yes | Out-Null

$envFile = Join-Path $PWD ".env"
if (-not (Test-Path $envFile)) {
  Write-Host ".env topilmadi!" -ForegroundColor Red
  exit 1
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $vars[$matches[1].Trim()] = $matches[2].Trim()
  }
}

function Set-VercelEnv([string]$Name, [string]$Value) {
  if (-not $Value) { return }
  Write-Host "  + $Name" -ForegroundColor Green
  $Value | npx vercel@latest env add $Name production --force 2>&1 | Out-Null
}

Write-Host "==> Environment variables qo'shilmoqda..." -ForegroundColor Cyan
Set-VercelEnv "NEXT_PUBLIC_API_URL" "/api"
Set-VercelEnv "JWT_ACCESS_SECRET" $vars["JWT_ACCESS_SECRET"]
Set-VercelEnv "JWT_REFRESH_SECRET" $vars["JWT_REFRESH_SECRET"]
Set-VercelEnv "JWT_ACCESS_EXPIRES" "15m"
Set-VercelEnv "JWT_REFRESH_EXPIRES" "7d"
Set-VercelEnv "SETUP_SECRET" $vars["JWT_ACCESS_SECRET"]

Write-Host ""
Write-Host "==> Neon PostgreSQL (Vercel Storage)..." -ForegroundColor Cyan
Write-Host "Agar birinchi marta bo'lsa, brauzerda shartlarni qabul qiling:" -ForegroundColor Yellow
Write-Host "https://vercel.com/eldiyorxonxodjaumarov9-5892s-projects/~/integrations/accept-terms/neon" -ForegroundColor Yellow
npx vercel@latest integration add neon 2>&1

Write-Host ""
Write-Host "==> Production deploy..." -ForegroundColor Cyan
npx vercel@latest deploy --prod --yes

Write-Host ""
Write-Host "==> Baza init (seed)..." -ForegroundColor Cyan
$secret = $vars["JWT_ACCESS_SECRET"]
try {
  Invoke-RestMethod -Method POST `
    -Uri "https://www.arendaai.uz/api/setup/init" `
    -Headers @{ "x-setup-secret" = $secret } `
    -TimeoutSec 120
  Write-Host "Baza tayyor!" -ForegroundColor Green
} catch {
  Write-Host "Init keyinroq qo'lda: POST /api/setup/init (x-setup-secret header)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Tayyor! Tekshiring: https://www.arendaai.uz/api/health" -ForegroundColor Green
Write-Host "Kirish: superadmin@arendahub.uz / Admin@12345" -ForegroundColor Green
