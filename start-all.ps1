# TIENDA — Backend + Frontend en una sola consola
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'

function Stop-Port([int]$port) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Write-Host ""
Write-Host "  === TIENDA ===" -ForegroundColor Cyan
Write-Host "  Liberando puertos 5000 y 3000..." -ForegroundColor Yellow
Stop-Port 5000
Stop-Port 3000
Start-Sleep 1

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "  Falta Node.js" -ForegroundColor Red
  pause
  exit 1
}

# Backend en job (misma sesión)
Write-Host "  [1/2] Backend  http://127.0.0.1:5000" -ForegroundColor Green
$backendJob = Start-Job -Name 'tienda-backend' -ScriptBlock {
  param($dir)
  Set-Location $dir
  node server.js 2>&1
} -ArgumentList $Backend

# Esperar API
$apiOk = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep 1
  try {
    $h = Invoke-RestMethod 'http://127.0.0.1:5000/api/health' -TimeoutSec 1
    if ($h.status -eq 'ok') { $apiOk = $true; break }
  } catch {}
}
if ($apiOk) {
  Write-Host "        Backend OK" -ForegroundColor Green
} else {
  Write-Host "        Backend aún arrancando / revisá MongoDB..." -ForegroundColor Yellow
}

Write-Host "  [2/2] Frontend http://127.0.0.1:3000" -ForegroundColor Green
Write-Host ""
Write-Host "  Dejá esta ventana abierta. Ctrl+C detiene el frontend;" -ForegroundColor DarkGray
Write-Host "  el backend se detiene al cerrar la ventana." -ForegroundColor DarkGray
Write-Host ""

# Mostrar logs del backend en paralelo
$logJob = Start-Job -Name 'tienda-backend-logs' -ScriptBlock {
  param($jobId)
  while ($true) {
    $j = Get-Job -Id $jobId -ErrorAction SilentlyContinue
    if (-not $j) { break }
    Receive-Job -Id $jobId -ErrorAction SilentlyContinue | ForEach-Object {
      Write-Host "[API] $_" -ForegroundColor DarkCyan
    }
    if ($j.State -ne 'Running') { break }
    Start-Sleep -Milliseconds 400
  }
} -ArgumentList $backendJob.Id

try {
  Set-Location $Frontend
  npm run dev
} finally {
  Write-Host ""
  Write-Host "  Cerrando backend..." -ForegroundColor Yellow
  Stop-Job -Name 'tienda-backend','tienda-backend-logs' -ErrorAction SilentlyContinue
  Remove-Job -Name 'tienda-backend','tienda-backend-logs' -Force -ErrorAction SilentlyContinue
  Stop-Port 5000
  Stop-Port 3000
  Write-Host "  Listo." -ForegroundColor Green
}
