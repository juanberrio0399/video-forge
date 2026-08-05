# video-forge

Fábrica de videos para YouTube que corre **100% en la nube** — nada se renderiza en el PC. El canal **The Data Lens** (`@TheDataLensHQ`) publica solo: datos/dinero, faceless, en inglés, mercado EE.UU. Todo con herramientas **gratis**.

Es semi-automática: **GitHub Actions** produce (guion → voz → render por fases → control de calidad), un **Cloudflare Worker** + **Telegram Mini App** son el mando y control, y **Juan aprueba** con un toque — el sistema programa a la mejor hora de EE.UU. El **watchdog** vigila cada 15 min y reanuda lo que se caiga.

## Documentación

| Doc | Qué contiene |
|---|---|
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Componentes, flujo end-to-end (diagrama), estado en R2, crons, auto-recuperación. |
| [docs/HISTORIAS_USUARIO.md](docs/HISTORIAS_USUARIO.md) | 35 historias de usuario con criterios de aceptación. |
| [docs/CONFIABILIDAD_24_7.md](docs/CONFIABILIDAD_24_7.md) | Mapa de fallos, colapsos, soluciones y el veredicto 24/7. |
| [docs/CAPACIDAD_Y_EXPERIMENTOS.md](docs/CAPACIDAD_Y_EXPERIMENTOS.md) | Capacidad diaria de la fábrica y la rampa de duración de los videos. |
| [docs/CRECIMIENTO.md](docs/CRECIMIENTO.md) | Palancas de suscriptores: encadenar videos, CTA retador y tono configurable. |

## Cómo funciona (resumen)

1. **Cron** (`daily_video.yml`, 10:00 UTC + rescate 15:00) elige el próximo tema de la cola.
2. **`produce_video.yml`** valida herramientas (preflight), evita duplicados, escribe el guion con IA y aplica los aprendizajes del canal.
3. **`voice_parallel.yml`** genera la voz (Kokoro), y **`render_phased.yml`** renderiza por fases con control de calidad (QA).
4. El video queda **pendiente de aprobar** en la Mini App. Juan lo aprueba → **`publish_youtube.yml`** lo sube privado con SEO + miniatura → **`schedule_youtube.yml`** lo programa a la mejor hora.
5. Al publicarse, se pueden generar sus **shorts** (`shorts_plan` → `shorts_final`).

## Estructura

- `bot/src/` — Cloudflare Worker: API `/api/*` + Telegram Mini App (`miniapp.js`).
- `.github/workflows/` — los ~23 workflows (la fábrica).
- `pipeline/` — scripts de producción, voz, render, YouTube y auto-recuperación (`watchdog.mjs`, `preflight.mjs`, `qa_check.mjs`).
- `channel/` — semillas del estado del canal.

## Motores

- **HyperFrames** (Apache 2.0, gratis) — HTML → MP4, render por fases.
- **Kokoro TTS** (gratis, self-hosted) — voz sin límite de tasa.
- **Gemini** (gratis) — guion, SEO, análisis (multi-modelo, sin 404).

## Operación

Todo se controla desde la **Telegram Mini App** (pestañas: Canal, Videos, Agenda, Control, Shorts, Crear). No requiere PC ni sesión abierta: la fábrica corre sola en la nube y Juan aprueba desde el móvil.
