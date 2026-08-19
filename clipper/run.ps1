# Oddly Clipper — RUN. Corre TODO el flujo (descarga CC -> IA -> edicion pro -> QA -> Oddly privado).
# Uso:  .\run.ps1                 (usa config.json -> 'sources')
#       .\run.ps1 "URL_CC"        (procesa esa URL)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".\venv")) { Write-Host "Falta el setup. Corre primero:  .\setup.ps1" -ForegroundColor Red; exit 1 }
if (-not (Test-Path ".\.env")) { Write-Host "Falta .env con tus claves. Copialo de .env.example y llenalo." -ForegroundColor Red; exit 1 }

if ($args.Count -ge 1) {
  .\venv\Scripts\python.exe -m src.pipeline $args[0]
} else {
  .\venv\Scripts\python.exe -m src.pipeline
}
