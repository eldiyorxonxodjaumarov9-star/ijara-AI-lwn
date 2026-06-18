# ArendaHub — sozlashni yakunlash
# Ishlatish: .\scripts\finish-setup.ps1

$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ""
Write-Host "=== ArendaHub sozlash ===" -ForegroundColor Cyan
Write-Host ""

# 1. Brauzerda Neon shartlarini ochish
$neonUrl = "https://vercel.com/eldiyorxonxodjaumarov9-5892s-projects/~/integrations/accept-terms/neon?source=cli"
Write-Host "1) Brauzerda Neon shartlarini qabul qiling (Accept):" -ForegroundColor Yellow
Write-Host "   $neonUrl" -ForegroundColor White
Start-Process $neonUrl

Read-Host "Neon shartlarini qabul qilganingizdan keyin Enter bosing"

# 2. Neon o'rnatish
Write-Host ""
Write-Host "2) Neon PostgreSQL o'rnatilmoqda..." -ForegroundColor Cyan
$neonResult = npx vercel@latest integration add neon 2>&1 | Out-String
Write-Host $neonResult

if ($neonResult -match "action_required") {
  Write-Host ""
  Write-Host "Neon hali ulanmadi. Vercel Dashboard orqali qo'lda qiling:" -ForegroundColor Red
  Write-Host "   Storage -> Neon -> Create" -ForegroundColor White
  Read-Host "Tayyor bo'lgach Enter bosing"
}

# 3. Env tekshirish
Write-Host ""
Write-Host "3) Environment variables..." -ForegroundColor Cyan
npx vercel@latest env ls 2>&1

# 4. Redeploy
Write-Host ""
Write-Host "4) Production deploy..." -ForegroundColor Cyan
npx vercel@latest deploy --prod --yes 2>&1 | Select-Object -Last 8

# 5. Baza init
Write-Host ""
Write-Host "5) Baza yaratish va seed..." -ForegroundColor Cyan
$envContent = Get-Content (Join-Path $PWD ".env")
$secret = ($envContent | Where-Object { $_ -match '^JWT_ACCESS_SECRET=' }) -replace '^JWT_ACCESS_SECRET=',''

Start-Sleep -Seconds 5
try {
  $result = Invoke-RestMethod -Method POST `
    -Uri "https://www.arendaai.uz/api/setup/init" `
    -Headers @{ "x-setup-secret" = $secret } `
    -TimeoutSec 180
  Write-Host "Baza tayyor!" -ForegroundColor Green
  $result | ConvertTo-Json
} catch {
  Write-Host "Init xato: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Keyinroq qayta urinib ko'ring yoki /api/setup/init ni qo'lda chaqiring." -ForegroundColor Yellow
}

# 6. Health check
Write-Host ""
Write-Host "6) Tekshirish..." -ForegroundColor Cyan
try {
  $health = Invoke-RestMethod -Uri "https://www.arendaai.uz/api/health" -TimeoutSec 30
  $health | ConvertTo-Json
} catch {
  Write-Host "Health: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Kirish: superadmin@arendahub.uz / Admin@12345" -ForegroundColor Green
Write-Host "Sayt: https://www.arendaai.uz" -ForegroundColor Green
