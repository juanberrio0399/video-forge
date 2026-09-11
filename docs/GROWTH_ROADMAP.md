# 🚀 Growth Roadmap — video-forge (Oddly Loop + The Data Lens)

Mapa vivo del sistema de crecimiento, basado en el framework "YouTube Growth & Content
Intelligence Agent" (agresivo / experimental / data-driven / automejorable). Objetivo:
**monetizar sí o sí** (ruta Shorts 10M vistas/90d o estándar 1.000 subs + 4.000h). Filosofía:
`RESEARCH → IDEATE → PRIORITIZE → CREATE → PUBLISH → MEASURE → ANALYZE → LEARN → ITERATE → SCALE`.
Todo en la nube (GitHub Actions + R2 + Telegram), sin PC, sin rutinas en la nube compartida de Claude.

## ✅ Fase 0 — Base (HECHO)
- Auto-optimizador de Oddly (`rebalance_oddly.mjs` + `oddly_niche_review.yml`, lunes): cadencia por datos, sube ganador, corta flojo, slot de experimento.
- **El Cerebro** (`channel_brain.mjs` + `channel_brain.yml`, diario): salud de los 2 canales, mide qué rinde, escala a "reestructurar" si nada funciona. No producir masivo sin probar.
- The Data Lens **pivotado** (nicho $ saturado → 3 formatos: rankings / relatable / escala), `direction.json` configurable; viejo oculto.
- **Mis Clips**: subir video IA desde la Mini App → SEO IA → Oddly → programa → playlist.
- **Resumen** (ventana principal): los 2 canales de un vistazo + 👀 pendientes por aprobar + 🎯 meta de monetización con ritmo.

## 🔭 Fase 1 — Growth Radar (EN CONSTRUCCIÓN)
Investigación semanal (GitHub Actions + Gemini con búsqueda): tendencias, competencia, **OUTLIERS**, algoritmo/políticas, IA/contenido reutilizado, **verificar requisitos YPP actuales**. Clasifica por evidencia (OFICIAL/FUERTE/EXPERIMENTAL/HIPÓTESIS/RUMOR) y propone **experimentos** (hipótesis · variable · métrica · criterio de éxito). → Telegram + R2 + alimenta al Cerebro.
- Archivos: `pipeline/growth_radar.mjs`, `.github/workflows/growth_radar.yml`, `channel/growth_radar.json` (R2).

## ✅ Fase 2 — Score universal + Matriz de outliers (HECHO)
- `lib/video_score.mjs` + `video_scores.mjs` (en `episodes.yml`): score 0-100 por video (rendimiento vs baseline + retención/hook + engagement, ponderado por confianza) → veredicto **SCALE / ITERATE / TEST_AGAIN / STOP**.
- **Outliers propios** (`findOutliers`): maduros con vistas suficientes que superan la mediana → extrae patrón (hook/formato) → sugiere experimento. R2: `channel/scores.json` + `channel/auto2/scores.json`.

## ✅ Fase 3 — A/B systematic + banco de creativos (HECHO)
- **Banco de creativos** (`lib/creative_bank.mjs`): ideas/hooks/títulos con estado (BACKLOG→TESTING→WINNER/KILLED) y prioridad `IMPACTO × PROBABILIDAD × VELOCIDAD ÷ COSTE` → P0/P1/P2/P3/KILL. Se auto-siembra desde los outliers de Fase 2. R2: `channel/brain/creative_bank.json`.
- **A/B por cohortes** (`lib/ab_test.mjs` + `ab_tests.mjs` en `episodes.yml`): una variable a la vez (hook), sobre videos REALES ya scoreados; agrupa por variante, mide vs baseline, decide GANADOR con muestra+lift (sin p-values falsos). R2: `channel/*/ab_tests.json`.
- **Reporte semanal de experimentos** (`lib/experiment_report.mjs` + `experiment_report.yml`, domingos): ensambla monetización/veredictos/ganadores/outliers/hipótesis/**A/B**/próximo-a-probar/plan → Telegram + `channel/*/experiment_report.json`.

## ✅ Fase 4 — Alertas (HECHO)
- `lib/alerts.mjs` + `alerts.mjs` + `alerts.yml` (diario): reglas puras sobre la memoria existente — **crecimiento cayendo** (subs/vistas 7d vs 7d previos), **saturación de formato** (cohorte reciente vs vieja), **dependencia de un nicho** (concentración del reparto), **pipeline parado** (sin publicar hace >4d), **meta atrasada**. Avisa por Telegram SOLO warn/critical (sin ruido). R2: `channel/*/alerts.json`.
- Pendiente (necesita datos que aún no guardamos): caída de retención/CTR con histórico propio, competidor acelerando, "reutilizado".

## ✅ Fase 5 — Protocolo de 2 agentes (HECHO)
- `lib/cross_validate.mjs` + `cross_validate.mjs` + `cross_validate.yml` (domingos): cruza el **Growth Radar** (externo, `channel/growth_radar.json`) con la **evidencia interna** medida (hipótesis + A/B + outliers) por canal. Extrae afirmaciones tagueadas por evidencia, las matchea por keywords (sinónimos ES/EN de las palancas) y clasifica **CONFIRMADA / PROBABLE / CONTRADICTORIA / REQUIERE_EXPERIMENTO / INCIERTA**. Avisa por Telegram lo accionable → `channel/*/cross_validation.json`. Nunca da por cierto un "hack" externo sin cruzarlo con datos.

**ROADMAP GROWTH COMPLETO (Fases 0-5).**

## Modos (siempre disponibles en el chat, sin build)
- **WAR ROOM** → estrategia máxima 72h: TOP 5 acciones/experimentos/videos/hooks/formatos.
- **POST-MORTEM** → autopsia de un video que falló (qué falló / por qué / qué probar).
- **SCALE** → tomar un formato con evidencia y crear 10 variaciones + serie + siguiente experimento.

## Reglas permanentes
- **Investigar antes de recomendar** (fuentes oficiales primero) y verificar lo ACTUAL (YouTube cambia).
- **No enamorarse de ideas**: decide por datos (KEEP/ITERATE/KILL).
- **Nada de atajos destructivos** (bots, views/subs comprados, contenido robado, reuploads sin transformación, evadir políticas). Crecimiento agresivo pero sostenible.
- **Cada publicación** debe dar WIN / LEARNING / SIGNAL; si no, analizar por qué.
- **Series > videos sueltos** cuando conviertan mejor.
- **Nunca "esto se hará viral"** → hablar de potencial/probabilidad/evidencia.
