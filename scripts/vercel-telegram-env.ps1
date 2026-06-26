$envFile = Join-Path $PSScriptRoot ".." ".env.local"
if (-not (Test-Path $envFile)) { throw ".env.local topilmadi" }

function Get-EnvValue($name) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -split "=", 2)[1].Trim().Trim('"')
}

$token = Get-EnvValue "TELEGRAM_BOT_TOKEN"
$cron = Get-EnvValue "CRON_SECRET"
$appUrl = Get-EnvValue "NEXT_PUBLIC_APP_URL"

if (-not $token) { throw "TELEGRAM_BOT_TOKEN yo'q" }

Push-Location (Join-Path $PSScriptRoot "..")
try {
  $token | npx vercel env add TELEGRAM_BOT_TOKEN production --force
  if ($cron) { $cron | npx vercel env add CRON_SECRET production --force }
  if ($appUrl) { $appUrl | npx vercel env add NEXT_PUBLIC_APP_URL production --force }
  npx vercel --prod --yes
} finally {
  Pop-Location
}
