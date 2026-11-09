# Operación

Volver al [README](../README.es.md). Qué corre solo, dónde mirar cuando algo falla y qué secretos necesita. Antes vivía en el README; se movió aquí y se puso al día con los crons reales.

## Lo que corre solo

Horas en UTC (Bogotá = UTC-5).

| Cuándo | Qué | Para qué |
|---|---|---|
| Cada 30 min | cron del Worker (`bot/wrangler.toml`) y `os_orchestrator.yml` (min 7 y 37) | El Orchestrator junta el estado de Video Forge, Viento y Radar en `os/global.json`; el Worker lo dispara y, en horas pares, también el cerebro, porque GitHub se salta crons frecuentes. |
| Cada 2 h | `report_auto2.yml` (en punto) → `brain_live.yml` (min 15) | Refresca las métricas de Oddly Loop y luego decide y produce. |
| Cada 6 h | `channel_report.yml`, `comment_reply.yml`, `telegram_broadcast.yml`, `schedule_backlog_oddly.yml` | Estado de The Data Lens (solo medición), respuestas a comentarios, difusión y re-agendado de lo que falló. |
| Tres veces al día (13, 19, 01) | `shorts_final.yml` | Genera los Shorts del plan que Juan aprobó y los sube privados. |
| Diario | `sync_playlists` (08:30) → `watchdog` (11:00) → `llm_test` (12:00, avisa si quedan menos de 2 proveedores de texto) → `daily_oddly` y `shorts_plan` (12:30) → `weekly_stats` (12:45) → `channel_brain` (13:00) → `episodes` (14:00) → `hypotheses` (14:30) → `retention` (15:00) → `monetization_report` (15:30) → `hooks` y `space_short` (16:00) → `alerts` (16:30) | La cadena de medición (cada paso corre después del que le da insumos), la cadencia de Oddly, el watchdog (R2, tokens de los dos canales y crons vivos) y un Short de espacio privado para revisar. |
| Lunes | `codeql` (06:00), `niche_radar` (11:00), `radar_scan` (13:00), `oddly_niche_review` (14:00); `brain_optimize` lunes y jueves (13:00) | Seguridad, radar de nichos, radar de mejoras de los repos, revisión de nichos de Oddly y el aprendizaje semanal del cerebro (`channel/brain/strategy.json`). |
| Miércoles | `opencut_watch` (14:00) | Vigila si OpenCut ya trae modo headless/MCP para integrarlo; solo avisa si hay algo nuevo. |
| Jueves | `radar_groom` (13:00) | Consolida lo que encontró el radar del lunes. |
| Domingo | `growth_radar` (13:00), `experiment_report` (17:00), `cross_validate` (18:00) | Investigación externa, reporte de experimentos y cruce de la investigación contra los datos propios. |

Lo que **no** corre solo: la producción de The Data Lens (`daily_video.yml`, `history_short.yml`, `data_shock.yml` y su `schedule_backlog_datalens.yml` quedaron en disparo manual desde que se apagó su producción, el 2026-10-04, #167) y `space_footage_test.yml`, `render_phased.yml` y los demás pasos que se encadenan por `workflow_dispatch`.

## Dónde mirar cuando algo falla

1. **Telegram** es la primera señal: el watchdog y las alertas avisan ahí, en silencio entre 11 p. m. y
   5 a. m. de Bogotá (`pipeline/notify_telegram.sh`).
2. **Actions** guarda el log completo de cada paso: `gh run list --workflow=<archivo>.yml` y
   `gh run view <id> --log-failed`. Un "success" no prueba nada: hay que leer el log.
3. **La Mini App** (`/os`) muestra qué está corriendo; `/cerebro` tiene la bitácora del cerebro y el
   ledger de decisiones con sus aciertos y fallos.
4. **R2** tiene el estado crudo: `channel/tools_health.json` dice qué herramienta está caída
   (`preflight.mjs`) y `channel/error_log.json` guarda causa y arreglo de los fallos anteriores
   (`error_learn.mjs`).

Fallos conocidos y su manejo están en [CONFIABILIDAD_24_7.md](CONFIABILIDAD_24_7.md): el sistema
reanuda renders caídos, salta un tema que falla 3 veces y corta el circuito antes de entrar en bucle.
Las trampas del día a día están en [PLAN.md](../PLAN.md#trampas-conocidas).

## Secretos y variables

En **GitHub → Settings → Secrets and variables → Actions** (solo nombres; los valores nunca van al repo):

| Secreto | Para qué |
|---|---|
| `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` | OAuth de The Data Lens. |
| `YT2_CLIENT_ID`, `YT2_CLIENT_SECRET`, `YT2_REFRESH_TOKEN` | OAuth de Oddly Loop (ver [SEGUNDO_CANAL_OAUTH.md](SEGUNDO_CANAL_OAUTH.md)). |
| `GEMINI_API_KEY`, `GEMINI_API_KEY2` | Guion, SEO y análisis. Dos llaves para repartir la cuota gratis. |
| `PEXELS_API_KEY`, `PIXABAY_API_KEY` | Footage con licencia. |
| `FREESOUND_API_KEY` | Biblioteca de sonido CC0. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Desplegar los Workers, leer/escribir R2 y usar Workers AI como respaldo de texto. |
| `GH_TOKEN` | PAT fine-grained para que un workflow encadene al siguiente, el Worker dispare la fábrica y el radar trabaje en los otros repos. |
| `TELEGRAM_BOT_TOKEN`, `OWNER_CHAT_ID` | Avisos al chat. |
| `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CEREBRAS_API_KEY`, `SAMBANOVA_API_KEY` | Opcionales. `pipeline/llm.mjs` los usa como relevo cuando Gemini se queda sin cuota; los que no tengan llave se saltan solos. |

En el Worker, con `wrangler secret put`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
`OWNER_CHAT_ID`, `GH_TOKEN`. Los bindings (R2, servicios, Durable Object) están en `bot/wrangler.toml`.
Los pasos completos de alta del bot están en [bot/README.md](../bot/README.md).
