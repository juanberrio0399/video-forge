# Deja en el ESCRITORIO: (1) el lanzador de UN CLIC y (2) un LEEME que te guia.
$ErrorActionPreference = "Stop"
$clipper = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath("Desktop")
$iniciar = Join-Path $clipper "INICIAR.ps1"

# 1) Lanzador de un clic (doble clic -> corre TODO automatico)
$bat = @"
@echo off
title Oddly Clipper
powershell -ExecutionPolicy Bypass -File "$iniciar"
"@
Set-Content -Path (Join-Path $desktop "INICIAR Oddly Clipper.bat") -Value $bat -Encoding ASCII

# 2) LEEME (guia en lenguaje simple)
$leeme = @"
========================================
   ODDLY CLIPPER  -  como usarlo
========================================

QUE HACE (solo):
  Toma videos largos CC de YouTube, la IA elige los mejores momentos, los edita
  como Shorts (9:16, subtitulos, musica) y los deja PRIVADOS en tu canal Oddly Loop.
  Tu solo apruebas cuales se publican desde el BOT DE TELEGRAM.

COMO SE USA (1 solo paso):
  1) Doble clic en "INICIAR Oddly Clipper.bat" (aqui en el Escritorio).
     -> Se abre una ventana negra y hace TODO solo: actualiza, instala (la 1a vez),
        edita y sube. No tienes que tocar nada mas.

  * La PRIMERA vez te va a pedir pegar tus claves (gratis) en un Bloc de notas:
    pegalas, guarda (Ctrl+S), cierra, y sigue. Eso es 1 sola vez.

DONDE PONER LOS VIDEOS A PROCESAR:
  Abre  Documentos\video-forge\clipper\config.json  y en "sources" pega las URLs
  de los videos CC de YouTube que quieras convertir. Guarda y corre el INICIAR.

IMPORTANTE:
  - NO se abre ningun editor de video: la edicion es AUTOMATICA (en la ventana negra
    ves el avance: descargando... editando... subiendo...). El resultado listo llega
    a Oddly Loop (privado) y al bot de Telegram para que apruebes.
  - Solo videos con licencia Creative Commons (se verifica solo).
  - Corre igual en este PC (sin GPU) o en el otro (con GPU): se ajusta solo.
========================================
"@
Set-Content -Path (Join-Path $desktop "LEEME - Oddly Clipper.txt") -Value $leeme -Encoding UTF8

Write-Host "OK. En tu Escritorio quedaron:" -ForegroundColor Green
Write-Host "   - INICIAR Oddly Clipper.bat   (doble clic = corre TODO)"
Write-Host "   - LEEME - Oddly Clipper.txt   (la guia)"
