# video-forge

Fábrica de videos de YouTube que corre **100% en la nube** (nada se renderiza en el PC) con herramientas **gratis**. Opera **dos canales independientes**, controlados desde una **Telegram Mini App**. GitHub Actions produce, un Cloudflare Worker + R2 son el mando/estado, y Gemini/Kokoro/HyperFrames/Freesound hacen el contenido.

> **Para una IA que lee esto:** cada script en `pipeline/*.mjs` tiene un comentario de cabecera que explica qué hace y su uso. Cada workflow en `.github/workflows/*.yml` tiene un comentario arriba. Este README es el mapa; los docs en `docs/` son el detalle por tema.

## Los dos canales (100% separados)

Cada canal maneja sus estados, procesos, producción, agendado y credenciales **por aparte**. Nunca comparten datos.

| | **The Data Lens** | **Oddly Loop (Auto)** |
|---|---|---|
| Handle | `@TheDataLensHQ` | `@oddlyloophq` |
| Contenido | Datos/dinero, faceless, EN, mercado EE.UU. | ASMR / satisfying / compilaciones legales |
| Nichos | (uno, datos) | satisfying · narrativas · ciencia_humor · naturaleza_relax |
| Producción | **Por inactividad** (`daily_video.yml`, cada 6h): si +18h sin video y <3 pendientes, produce 1 (privado, Juan aprueba) | **Full-auto blitz** (`daily_oddly.yml`, 12:30 UTC): 8 Shorts + 1 largo/día, se programan solos |
| Render | HyperFrames (composición de datos) + viñeta fílmica | ffmpeg (clips legales + narración/sonido + grade cine) |
| Credenciales | `YT_*` | `YT2_*` |
| Storage R2 | `channel/…` | `channel/auto2/…` |
| Reporte | `channel_report.yml` (cada 6h) | `report_auto2.yml` (cada 6h) |
| Agendado | `nextBestSlot` (Worker) | `best_slot.mjs` + `scheduled_times.mjs` |

## Flujos principales

**The Data Lens (por inactividad, Juan aprueba):**
1. `daily_video.yml` (cada 6h) → `idle_check.mjs`: ¿+18h sin video y <3 pendientes? → produce.
2. `produce_video.yml` (guion IA con reglas de retención + editor cine) → `voice_parallel.yml` (Kokoro) → `render_phased.yml` (HyperFrames por fases + QA + música con ducking + viñeta + guarda de tamaño <300 MiB para R2).
3. Queda **privado para aprobar** en la app. Juan aprueba → `publish_youtube.yml` (SEO + miniatura) → `schedule_youtube.yml` (mejor hora).
4. Del video → `shorts_plan` → `shorts_final` (shorts de los mejores momentos).

**Oddly Loop (blitz de Shorts, full-auto):**
1. `daily_oddly.yml` (12:30 UTC = 7:30am Bogotá) lee `channel/auto2/cadence.seed.json` → arma el plan (Shorts por categoría + 1 largo rotado).
2. Por cada pieza, `produce_oddly.yml`: guion (`compilation_script.mjs`, variantes **puro**=sin voz / **narrado**) → voz (si narrado) → **biblioteca ASMR curada** (`build_asmr_library` en R2) → ensamblar (`build_compilation.mjs`: clips legales Pexels/Pixabay + mezcla de sonido por nicho + grade cine) → **puerta de compliance** (`compliance_check.mjs`, solo fuentes con licencia) → subir a YT2 (privado) → programar a la mejor hora.
3. `report_auto2.yml` refresca vistas/top/mejores-horas para la app.

## Sonido e imagen (nivel experto, por categoría)

- **Sonido ASMR** = mezcla profesional por **paletas curadas** (cama + acentos que combinan), **Freesound CC0** (`build_asmr_library.mjs` → R2). Nichos narrados (narrativas/ciencia) = cama atmosférica + **stingers** en los beats.
- **Pack de edición** (whooshes CC0) para el canal principal (`add_edit_sfx.mjs` en `render_phased`).
- **Look cinematográfico** por nicho en `build_compilation.mjs` (viñeta + micro-contraste + grano) y viñeta sutil en el render de The Data Lens.
- Guion como **editor de cine**: arco emocional, ritmo, planos con movimiento, transiciones motivadas (`EXPERT_RULES`).
- Ver `docs/EXPERTO_POR_CATEGORIA.md`.

## Programación por datos + monetización

- **Mejores horas por DATOS** del propio canal (`best_hours.json`, calculado en los reportes por vistas/día por hora); si no hay datos, horas de research. Reparto en huecos + **tope 2/hora**, 6 franjas/día.
- **Top 3 + "lo que más rinde"** para replicar el contenido ganador (en la app).
- **Estrategia audaz = Shorts-first**: la vía rápida a monetizar es 10M vistas de Shorts en 90 días. Blitz de Shorts en Oddly Loop.
- **Declaración de IA** (`containsSyntheticMedia: true`) en TODAS las subidas.
- **Horas de silencio** de Telegram 11pm–5am Bogotá (`notify_telegram.sh`): mensajes llegan silenciosos.

## Estructura

- `bot/src/index.js` — Cloudflare Worker: API `/api/*`, construye el estado del canal desde R2 + YouTube, agenda (`nextBestSlot`).
- `bot/src/miniapp.js` — Telegram Mini App: 5 pestañas (**inicio · producir · agenda · analitica · mas**) + selector de canal (data-lens / auto2), todo separado por canal.
- `.github/workflows/*.yml` — los 31 workflows (la fábrica).
- `pipeline/*.mjs` / `*.py` — 61 scripts (guion, voz, render, ensamblaje, sonido, YouTube, reportes, auto-recuperación). Cada uno con cabecera explicativa.
- `channel/` — semillas del estado; `channel/auto2/` = Oddly Loop (sources, cadence, branding, paletas).
- `docs/` — detalle por tema.

## Motores / fuentes (todo gratis)

- **HyperFrames** (HTML→MP4, render por fases) · **Kokoro TTS** (voz self-hosted) · **Gemini** (guion/SEO/análisis, multi-llave) · **Pexels/Pixabay** (video stock con licencia) · **Freesound CC0** (sonido) · **Cloudflare Worker + R2** (mando + estado) · **Telegram** (control).

## Documentación (por tema)

| Doc | Qué contiene |
|---|---|
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Componentes, flujo end-to-end, estado en R2, crons, auto-recuperación. |
| [docs/CANAL_AUTOMATICO.md](docs/CANAL_AUTOMATICO.md) | Blueprint de Oddly Loop (compilaciones legales), nichos, sonido, fases. |
| [docs/EXPERTO_POR_CATEGORIA.md](docs/EXPERTO_POR_CATEGORIA.md) | Proceso para trabajar cada categoría a nivel experto + editor de cine. |
| [docs/SEGUNDO_CANAL_OAUTH.md](docs/SEGUNDO_CANAL_OAUTH.md) | Crear el 2º canal (Brand Account) + OAuth `YT2_*`. |
| [docs/CONFIABILIDAD_24_7.md](docs/CONFIABILIDAD_24_7.md) | Mapa de fallos, colapsos, soluciones, veredicto 24/7. |
| [docs/CAPACIDAD_Y_EXPERIMENTOS.md](docs/CAPACIDAD_Y_EXPERIMENTOS.md) | Capacidad diaria y rampa de duración. |
| [docs/CRECIMIENTO.md](docs/CRECIMIENTO.md) | Palancas de suscriptores: encadenar videos, CTA, tono. |
| [docs/HISTORIAS_USUARIO.md](docs/HISTORIAS_USUARIO.md) | Historias de usuario con criterios de aceptación. |

## Secretos (GitHub Actions)

`YT_CLIENT_ID/SECRET/REFRESH` (Data Lens) · `YT2_*` (Oddly Loop) · `GEMINI_API_KEY(2)` · `PEXELS_API_KEY` · `PIXABAY_API_KEY` · `FREESOUND_API_KEY` · `CLOUDFLARE_API_TOKEN` · `CLOUDFLARE_ACCOUNT_ID` · `GH_TOKEN` (encadena workflows) · `TELEGRAM_BOT_TOKEN` · `OWNER_CHAT_ID`.
