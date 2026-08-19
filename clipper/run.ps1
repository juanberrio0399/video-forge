# Oddly Clipper - RUN. Corre TODO el flujo (buscar/descargar CC -> IA -> editar -> QA -> R2).
# Uso:  .\run.ps1                 (usa config.json: busca o 'sources')
#       .\run.ps1 "URL_CC"        (procesa esa URL)
$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = "1"
Set-Location $PSScriptRoot

if (-not (Test-Path ".\venv")) { Write-Host "Falta el setup. Corre primero:  .\setup.ps1" -ForegroundColor Red; exit 1 }
if (-not (Test-Path ".\.env")) { Write-Host "Falta .env con tus claves. Copialo de .env.example y llenalo." -ForegroundColor Red; exit 1 }

if ($args.Count -ge 1) {
  .\venv\Scripts\python.exe -m src.pipeline $args[0]
} else {
  .\venv\Scripts\python.exe -m src.pipeline
}
