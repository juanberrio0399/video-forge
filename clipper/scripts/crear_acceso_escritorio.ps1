# Deja en el ESCRITORIO un acceso que abre este proyecto en VS Code, listo para correr.
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$ws = Join-Path $repo "Oddly Clipper.code-workspace"
$desktop = [Environment]::GetFolderPath("Desktop")

# 1) Copia el workspace al Escritorio (doble clic -> abre VS Code en el repo)
Copy-Item $ws (Join-Path $desktop "Oddly Clipper.code-workspace") -Force

# 2) Un .bat de respaldo por si prefieres un solo clic que abra VS Code directo
$bat = @"
@echo off
code "$ws"
"@
Set-Content -Path (Join-Path $desktop "Abrir Oddly Clipper.bat") -Value $bat -Encoding ASCII

Write-Host "✓ Listo. En tu Escritorio quedaron:" -ForegroundColor Green
Write-Host "   • 'Oddly Clipper.code-workspace'  (doble clic -> abre VS Code en el repo)"
Write-Host "   • 'Abrir Oddly Clipper.bat'       (un clic -> lo mismo)"
Write-Host "`nEn VS Code:  Terminal -> Run Task -> '▶ Correr Oddly Clipper'  (o en la terminal: .\run.ps1)"
