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

# 2) LEEME (guia simple, en texto plano)
$leeme = @"
========================================
   ODDLY CLIPPER  -  como usarlo
========================================

QUE HACE (solo, sin que edites nada):
  Toma videos largos CC de YouTube, la IA elige los mejores momentos, los edita
  como Shorts (9:16 vertical, subtitulos) usando SOLO el contenido del video, y los
  deja en R2. Tu APRUEBAS desde el BOT DE TELEGRAM cuales se publican.

COMO SE USA (1 solo paso):
  Doble clic en "INICIAR Oddly Clipper.bat" (aqui en el Escritorio).
  Se abre una ventana negra y hace TODO solo: actualiza, instala (1a vez),
  busca videos CC, te muestra un TOP para elegir, edita y sube a R2.

LA PRIMERA VEZ:
  Te abre un Bloc de notas pidiendo tus 2 claves (Gemini + R2, gratis).
  Pegalas, guarda (Ctrl+S), cierra y continua. Solo 1 vez.

QUE VIDEOS PROCESA:
  Por defecto busca solo (temas en clipper\config.json). Tambien puedes pegar
  URLs CC directas en config.json -> "sources".

IMPORTANTE:
  - NO abre ningun editor de video. La edicion es AUTOMATICA (ves texto del avance
    en la ventana negra). El resultado va a R2 y al bot.
  - Solo videos Creative Commons (se verifica solo). Pone credito al autor.
  - Corre igual con o sin tarjeta grafica (se ajusta solo).
========================================
"@
Set-Content -Path (Join-Path $desktop "LEEME - Oddly Clipper.txt") -Value $leeme -Encoding ASCII

Write-Host "[OK] En tu Escritorio quedaron el INICIAR y el LEEME." -ForegroundColor Green
