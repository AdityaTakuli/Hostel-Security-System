# HMS Startup Script — Cleans up and starts fresh
Write-Host "`n=== HMS.SYS Startup ===" -ForegroundColor Cyan

# 1. Kill any leftover processes on ports 3000 and 4000
Write-Host "[1/3] Clearing ports 3000 & 4000..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3000,4000 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  Where-Object { $_ -ne 0 } |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

# 2. Clear the .next build cache to avoid stale CSS/JS
Write-Host "[2/3] Clearing .next build cache..." -ForegroundColor Yellow
$nextDir = Join-Path $PSScriptRoot "apps\web\.next"
if (Test-Path $nextDir) {
    Remove-Item -Path $nextDir -Recurse -Force -ErrorAction SilentlyContinue
}

# 3. Start dev
Write-Host "[3/3] Starting HMS..." -ForegroundColor Green
Write-Host "  Web:    http://localhost:3000" -ForegroundColor White
Write-Host "  Media:  ws://localhost:4000`n" -ForegroundColor White
npm run dev
