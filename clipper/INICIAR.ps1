# INICIAR - el UNICO archivo que corres. Hace TODO automatico:
#   actualiza -> instala (solo la 1a vez) -> revisa tus claves -> EDITA y SUBE los Shorts a R2.
$ErrorActionPreference = "Continue"
$env:PYTHONUTF8 = "1"   # para que los textos con acentos/emoji del avance no rompan en Windows
$clipper = $PSScriptRoot
Set-Location $clipper
Clear-Host
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "        ODDLY CLIPPER  -  arranque automatico" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# [1] Traer lo ultimo del repo
Write-Host ""
Write-Host "[1/4] Actualizando el codigo..." -ForegroundColor Yellow
try { git -C (Split-Path $clipper -Parent) pull --quiet } catch {}

# [2] Instalar (solo la primera vez)
if (-not (Test-Path ".\venv")) {
  Write-Host "[2/4] Primera vez: instalando todo (tarda unos minutos, es 1 sola vez)..." -ForegroundColor Yellow
  powershell -ExecutionPolicy Bypass -File ".\setup.ps1"
} else {
  Write-Host "[2/4] Revisando dependencias..." -ForegroundColor Yellow
  .\venv\Scripts\python.exe -m pip install -q -r requirements.txt *> "$clipper\setup_install.log"
  Write-Host "[2/4] Dependencias al dia. OK" -ForegroundColor Green
}

# [3] Revisar que tengas tus claves (lo unico manual, 1 sola vez)
if (-not (Test-Path ".\.env")) { Copy-Item ".env.example" ".env" }
$envtxt = Get-Content ".\.env" -Raw
if ($envtxt -match "(?m)(GEMINI_API_KEY|R2_ACCESS_KEY_ID)=\s*$") {
  Write-Host ""
  Write-Host "[3/4] FALTAN TUS CLAVES (gratis). Abro el .env - pega tus claves, GUARDA (Ctrl+S), cierra y vuelve." -ForegroundColor Red
  Start-Sleep 2
  notepad ".\.env"
  Read-Host "   Cuando ya guardaste tus claves, presiona ENTER para seguir"
} else {
  Write-Host "[3/4] Claves cargadas. OK" -ForegroundColor Green
}

# Acceso del Escritorio (por si no esta)
powershell -ExecutionPolicy Bypass -File ".\scripts\crear_acceso_escritorio.ps1" 2>$null

# [4] EDITAR Y SUBIR (todo automatico)
Write-Host ""
Write-Host "[4/4] Editando y subiendo a R2 (corre solo, no tienes que hacer nada)..." -ForegroundColor Yellow
Write-Host ""
.\venv\Scripts\python.exe -m src.pipeline

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Listo. Los Shorts quedaron en R2." -ForegroundColor Green
Write-Host " (Falta el lado del bot para aprobarlos - lo estamos armando.)" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Read-Host "Presiona ENTER para cerrar"
