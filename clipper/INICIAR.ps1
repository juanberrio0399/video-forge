# INICIAR — el UNICO archivo que corres. Hace TODO automatico:
#   actualiza el codigo -> instala (solo la 1a vez) -> revisa tus claves -> EDITA y SUBE los Shorts.
# No tienes que ejecutar nada mas. Doble clic al acceso del Escritorio y listo.
$ErrorActionPreference = "Continue"
$clipper = $PSScriptRoot
Set-Location $clipper
Clear-Host
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "        ODDLY CLIPPER  -  arranque automatico" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# [1] Traer lo ultimo del repo
Write-Host "`n[1/4] Actualizando el codigo..." -ForegroundColor Yellow
try { git -C (Split-Path $clipper -Parent) pull --quiet } catch {}

# [2] Instalar (solo la primera vez)
if (-not (Test-Path ".\venv")) {
  Write-Host "[2/4] Primera vez: instalando todo (esto tarda unos minutos, es 1 sola vez)..." -ForegroundColor Yellow
  powershell -ExecutionPolicy Bypass -File ".\setup.ps1"
} else {
  Write-Host "[2/4] Ya esta instalado. OK" -ForegroundColor Green
}

# [3] Revisar que tengas tus claves (lo unico manual, 1 sola vez)
if (-not (Test-Path ".\.env")) { Copy-Item ".env.example" ".env" }
$envtxt = Get-Content ".\.env" -Raw
if ($envtxt -match "(?m)(GEMINI_API_KEY|R2_ACCESS_KEY_ID)=\s*$") {
  Write-Host "`n[3/4] FALTAN TUS CLAVES (gratis)." -ForegroundColor Red
  Write-Host "      Voy a abrir el archivo de claves en el Bloc de notas." -ForegroundColor Red
  Write-Host "      Pega tus claves, GUARDA (Ctrl+S), cierra el Bloc de notas y vuelve aca." -ForegroundColor Red
  Start-Sleep 2
  notepad ".\.env"
  Read-Host "`n   Cuando ya guardaste tus claves, presiona ENTER para seguir"
} else {
  Write-Host "[3/4] Claves cargadas. OK" -ForegroundColor Green
}

# [4] EDITAR Y SUBIR (todo automatico: descarga -> IA elige -> edita -> QA -> sube privado a Oddly)
Write-Host "`n[4/4] Editando y subiendo (esto corre solo, no tienes que hacer nada)...`n" -ForegroundColor Yellow
.\venv\Scripts\python.exe -m src.pipeline

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " Listo. Los Shorts quedaron PRIVADOS en Oddly Loop." -ForegroundColor Green
Write-Host " Revisa el BOT DE TELEGRAM para aprobar cuales se publican." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Read-Host "`nPresiona ENTER para cerrar"
