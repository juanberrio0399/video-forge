# Oddly Clipper - SETUP (una sola vez por PC). Instala todo lo gratis y detecta tu hardware.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "=== Oddly Clipper - setup ===" -ForegroundColor Cyan

# 1) Python
try { $pv = (python --version) 2>&1 } catch { $pv = $null }
if (-not $pv) {
  Write-Host "[X] Falta Python 3.10+. Instalalo de https://www.python.org/downloads/ (marca 'Add to PATH') y reintenta." -ForegroundColor Red
  exit 1
}
Write-Host "[OK] $pv"

# 2) Entorno virtual + dependencias (salida detallada -> a un log; en pantalla solo el resumen)
if (-not (Test-Path ".\venv")) { Write-Host "Creando entorno virtual..."; python -m venv venv }
Write-Host "Instalando dependencias (esto tarda unos minutos, es 1 sola vez)..." -ForegroundColor Yellow
$log = Join-Path $PSScriptRoot "setup_install.log"
.\venv\Scripts\python.exe -m pip install --upgrade pip *> $log
.\venv\Scripts\python.exe -m pip install -r requirements.txt *>> $log
if ($LASTEXITCODE -eq 0) {
  Write-Host "[OK] Dependencias instaladas:" -ForegroundColor Green
  foreach ($p in @("yt-dlp (descarga)", "faster-whisper (transcribe)", "google-generativeai (IA)", "boto3 (R2)", "python-dotenv", "requests")) {
    Write-Host "     [OK] $p"
  }
} else {
  Write-Host "[X] Fallo la instalacion. Ultimas lineas del log:" -ForegroundColor Red
  Get-Content $log -Tail 15
  exit 1
}

# 3) ffmpeg
$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue)
if (-not $ff) {
  Write-Host "ffmpeg no esta en el PATH. Intento instalarlo con winget..." -ForegroundColor Yellow
  try { winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements } catch {}
  Write-Host "Si sigue faltando, instala ffmpeg y agregalo al PATH, luego reabre la terminal." -ForegroundColor Yellow
} else {
  Write-Host "[OK] ffmpeg encontrado"
}

# 4) .env
if (-not (Test-Path ".\.env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "-> Cree .env - ABRELO y pon tus claves (todas gratis)." -ForegroundColor Yellow
}

# 5) Hardware
Write-Host ""
Write-Host "Detectando hardware..." -ForegroundColor Cyan
.\venv\Scripts\python.exe src\detect_hardware.py

Write-Host ""
Write-Host "[OK] Setup listo." -ForegroundColor Green
