# YOUTUBE BRAIN OS — STEP 1: AUDIT (Current State Report)

> Fecha: 2026-09-10 · Repo: `juanberrio0399/video-forge` · Clon: `Documents/video-forge`
> Regla seguida: **auditar, NO implementar todavía**. Evolucionar el cerebro existente, no reemplazarlo.
> **Hallazgo clave:** el sistema ya implementa ~60% del "Brain OS". Existe un ciclo real
> Observar→Decidir→Producir→Publicar→Medir→Aprender corriendo 24/7 en la nube, gratis.

---

## 1. Repository Map (tamaño real)

- **106** scripts en `pipeline/` (`.mjs` + `.py`)
- **69** GitHub Actions workflows en `.github/workflows/`
- **2** archivos del Worker/bot en `bot/src/` (`index.js` = backend + API, `miniapp.js` = UI Telegram)
- **~40** archivos de estado (memoria) en R2 bajo `channel/` y `channel/auto2/`
- **13** docs en `docs/` · **0** tests automatizados ⚠️
- Infra: **Cloudflare Worker** (bot + Mini App) → **GitHub Actions** (cómputo) → **R2** (memoria/artefactos) → **YouTube Data + Analytics API**. Todo gratis.

## 2. Current Architecture (real, no conceptual)

```
Telegram (Juan) ──► Cloudflare Worker (bot/src/index.js)
                         │  /api/state  (ensambla el estado de ambos canales desde R2)
                         │  /api/dispatch (dispara workflows, allowlist)
                         ▼
                    GitHub Actions (69 workflows, cron + dispatch)
                         │  producen / publican / reportan / "piensan"
                         ▼
                    R2 (memoria persistente: channel/*.json, channel/auto2/*.json)
                         ▲
                         │  lee/escribe
                    YouTube Data API + YouTube Analytics API
```

El "cerebro" NO es un servicio central: hoy está **distribuido en workflows cron** que leen/escriben R2. `channel_brain.mjs` es el nodo más cercano a un orquestador cognitivo.

## 3. Current Brain Neurons (mapeo neurona-objetivo → archivo real)

| Neurona objetivo (§6) | Existe hoy | Archivo real | Estado |
|---|---|---|---|
| Cognitive Core / Decision | Parcial | `pipeline/channel_brain.mjs` (`channel_brain.yml`, diario) | reglas, sin BrainState |
| Learning Neuron | Sí | `pipeline/learnings.mjs` → `channel/learnings.json` | funciona |
| Error Learning | Sí | `pipeline/error_learn.mjs` → `channel/error_log.json` | funciona |
| Strategy optimizer | Sí | `pipeline/brain_optimize.mjs` → `channel/brain/strategy.json` + `aggressiveness.json` | funciona |
| Market Intelligence | Parcial | `pipeline/niche_radar.mjs`, `growth_radar.mjs` → `channel/niche_radar.json` | nichos sí, competidores no |
| Analytics Neuron | Sí | `channel_report.mjs`, `report_auto2.mjs`, `weekly_stats.mjs`, `yt_inventory_check.mjs` | views/watch/subs/likes; **falta retención** |
| Experimentation | Parcial | `pipeline/experiment_step.mjs` + `channel/experiments.json`, `channel/auto2/experiments_niche.json` | experimentos de nicho; **sin hipótesis formal** |
| Script Neuron (multi-formato) | Sí (fuerte) | `video_script.mjs`, `compilation_script.mjs`, `data_shock_script.mjs`, `history_script.mjs`, `space_short_script.mjs`, `recipe_plan.mjs` | robusto |
| Title / SEO Neuron | Sí | `publish_package.mjs`, `manual_seo.mjs`, `seo_regen.yml` | funciona (con puerta de aprobación) |
| Thumbnail Neuron | Sí | `make_thumbnail.mjs`, `thumb_text.mjs`, `youtube_thumbnail.mjs`, `gen_image.mjs` | funciona |
| Quality Control | Sí | `pipeline/review_video.mjs` (nota + auto-mejora, umbral 7.5) | funciona |
| Originality / Compliance | Sí | `pipeline/compliance_check.mjs` | funciona (fuentes con licencia) |
| Publishing | Sí | `youtube_upload/schedule/privacy/verify.mjs`, `short_publish.mjs` | funciona |
| **Hook Intelligence** | **NO** | — | falta |
| **Retention Intelligence** | **NO** | — | falta (curvas de retención) |
| **Audience Intelligence** | **Débil** | (implícito en niche_radar) | sin perfiles de audiencia por canal |
| **Cognitive Orchestrator / BrainState** | **NO** | — | falta el estado central |
| **Hypothesis Registry** | **NO** | — | falta |
| **Baselines** | **NO** | — | se juzga por umbrales absolutos (vpd), no relativo a la mediana |
| **Knowledge confidence** | **NO** | `learnings.json` sin `{confidence, sample_size, channel_scope}` | falta |

## 4. Current Data Flow (loop real que ya existe)

`idea/tema (brain/radar)` → `*_script.mjs (guion)` → `voz (voice_parallel / kokoro / gemini_tts)` → `ensamblado (build_compilation / *_short)` → `review_video (calidad)` → `compliance_check (legal)` → `youtube_upload (privado)` → puerta SEO + aprobación de Juan → `youtube_schedule (mejor hora)` → `channel_report / weekly_stats (métricas)` → `learnings / channel_brain (aprende + decide)` → vuelve al inicio. **El loop existe.**

## 5. Current YouTube Pipeline
- **The Data Lens (YT1):** secrets `YT_*`; `channel_report.mjs` + `channelInventory` (bot) via Data API + Analytics.
- **Oddly Loop (YT2):** secrets `YT2_*`; `report_auto2.mjs`.
- Data API: canal, uploads, videos.list (status/statistics), privacy, upload, schedule.
- Analytics API: `weekly_stats.mjs` baja vistas/min/likes/subs por día → semanas ISO. **NO se baja `audienceRetention`** (curvas) → bloquea Hook/Retention neurons.

## 6. Existing Analytics
Views, impressions parcial, CTR ❌ (no se ingiere), watch_min, avg_sec, subs ±, likes, vistas/día (vpd), semana-a-semana (`weekly_stats.json`). **Faltan: CTR/impresiones, retención por segundo, fuentes de tráfico, returning viewers.**

## 7. Existing Memory (R2 = capa de persistencia)
- **Episódica (parcial):** `channel/monetization_history.json` (snapshot diario subs/vistas), `channel/history_map.json` (tema→video), `channel/videos.json` (etapas por video). **Falta un "episodio" por video con {hook, title_type, format, hypothesis, result}.**
- **Semántica (parcial):** `channel/learnings.json`, `channel/brain/strategy.json`, `channel/brain/learning.json`, `channel/craft_feedback.json`. Sin embeddings/vector DB (correcto: no hace falta aún).
- **Experimental (parcial):** `channel/experiments.json`, `channel/auto2/experiments_niche.json`. **Sin registro de hipótesis con estados/confianza/sample_size.**
- Separación por canal ✅ ya existe (`channel/` vs `channel/auto2/`) — coincide con el requisito de conocimiento por-canal (§9).

## 8. Existing Agents / Automation
69 workflows cron (produce, publish, report, brain, radar, clippers, etc.). Orquestación por `gh workflow run` encadenado + el bot. **repo-radar** (`radar_scan/groom/implement/purge`) es un meta-loop de auto-mejora del propio código (abre Issues + PRs).

## 9. Existing Prompts
Prompts **embebidos en los scripts** (`video_script.mjs`, `compilation_script.mjs`, `review_video.mjs`, `comment_reply.mjs`, etc.). **NO están versionados** en `prompts/vNNN.md` (gap vs §19). No hay evaluación A/B de prompts.

## 10. Bugs (reales, vistos esta sesión)
- 🔴 **Producción de Oddly falló hoy** (7 runs) — clips corruptos de fuente rompían el ensamblador. **Ya parcheado** (`build_compilation.mjs` valida descargas y captura stderr). Vigilar.
- 🟡 `channel_brain.mjs` mide Data Lens por categorías de **"Historia"** (`history_map.json`) que ya se pivotó a `data_shock` → el veredicto "REESTRUCTURAR" usa señal parcialmente obsoleta. Deuda de coherencia.
- 🟡 `thumbnail_only.yml` falla sin un video en el slot de producción (requisito no obvio).

## 11. Technical Debt (clasificada)
- **Crítica:** 0 tests (0 archivos) para 106 scripts + un Worker en producción → cualquier cambio es a ciegas. Sin baselines → decisiones sobre umbrales arbitrarios.
- **Alta:** prompts no versionados; sin BrainState central (estado disperso en ~40 JSON); memoria episódica incompleta; hipótesis sin registro formal.
- **Media:** deriva de coherencia (brain mide "historia" vs dirección data_shock); conocimiento sin confianza/sample_size; observabilidad parcial (logs `[api]`/`[t]` añadidos hoy, pero sin decision-trace).
- **Baja:** duplicación menor entre `aiImage()` en varios scripts vs `gen_image.mjs`.

## 12. Security Risks
Auditoría de seguridad **ya hecha hoy** (ver `docs`/commits): 0 críticos; secretos solo en GitHub/Wrangler; auth del Worker por HMAC de Telegram + puerta OWNER; anti prompt-injection en el auto-respondedor; CodeQL + Dependabot activos; token de Cloudflare mínimo; R2 sin acceso público. **Postura sólida.** Pendiente menor: verificar scopes de PATs.

## 13. Missing Components (vs Target Brain)
1. **Cognitive Orchestrator + BrainState** (§10) — estado central legible.
2. **Baseline Neuron** (§15) — mediana por canal → rendimiento relativo.
3. **Episodic Memory schema** (§7) — un episodio por video.
4. **Hypothesis Registry** (§17) — con estados/confianza/evidencia.
5. **Experiment Engine formal** (§6.10) — control vs variante + confianza.
6. **Retention + Hook Intelligence** (§6.4/6.5) — requiere ingesta de `audienceRetention`.
7. **Knowledge confidence** (§41) — envolver learnings con {confidence, sample_size, scope}.
8. **Tests + observabilidad/decision-trace** (§25/§27).
9. **Monetization Readiness Dashboard** (§36) — hay base (`monetTrack` ya calcula gap/ritmo/proyección) pero no como panel de 1ª clase.
10. **60-Day War-Room mode + Daily/Weekly Brain Report** (§37/§38) — el pulso diario de Telegram es un embrión.

## 14. Architecture Gap Analysis (Current Brain vs Target Brain)

| Capa (§61) | Target | Hoy | Brecha |
|---|---|---|---|
| Perception | Analytics+Trends+Audience+Competitors | Analytics+Trends | falta audiencia, competidores, retención, CTR |
| Memory | Episodes+Semantic+Experiments+Knowledge Graph | R2 JSON parciales | falta esquema episódico, hipótesis, confianza, grafo |
| Reasoning | Hypothesis+Decision+Prediction | reglas en `channel_brain` | falta registro de hipótesis, decision-trace, explore/exploit |
| Creative | Hook+Script+Title | Script+Title+Thumb (fuerte) | falta Hook neuron |
| Quality | scoring + explicación | `review_video` (sí) | ok, sumar evaluadores por dimensión |
| Publish/Analytics/Learning | loop cerrado | **loop cerrado ✅** | formalizar, no reconstruir |

**Conclusión:** los FUNDAMENTOS (producción, publicación, memoria en R2, loop de aprendizaje, separación por canal, seguridad) **ya existen y funcionan**. La evolución es hacia la **formalización cognitiva**, no un reemplazo.

## 15. Quick Wins (alto impacto / bajo esfuerzo / bajo riesgo)
- **QW1 — Baselines por canal:** calcular mediana de views/vpd/retención por canal y guardarla (`channel/baseline.json`). Desbloquea juicio relativo en todo el cerebro. *(fundamento de §15)*
- **QW2 — Knowledge confidence wrapper:** añadir `{confidence, sample_size, channel_scope, last_updated}` a `learnings.json`/`strategy.json`. *(§41)*
- **QW3 — Coherencia del Cerebro:** que `channel_brain.mjs` mida Data Lens por su dirección VIVA (`direction.json` = data_shock), no por `history_map.json` obsoleto. *(fix de deuda media)*
- **QW4 — Decision-trace mínimo:** que `channel_brain` escriba `channel/brain/decisions.jsonl` (por qué decidió, evidencia, confianza). *(§27)*

## 16. Critical Fixes
- **CF1 — Red de tests de regresión:** vitest para los ~10 scripts críticos (parseo de Analytics, `weekly_stats`, `build_compilation`, `channelInventory`, `monetTrack`) para no romper producción a ciegas. *(§25, deuda crítica)*
- **CF2 — Ingesta de retención** (`audienceRetention` de Analytics API) → habilita Hook/Retention neurons (lo que MÁS mueve el CTR/retención en 60 días).

## 17. Recommended Roadmap (adaptado al sistema existente — NO el template genérico)

> Cada fase = 1 rama, con objetivo, tests, doc, criterios de aceptación y rollback. Prioridad por Impacto/Esfuerzo/Riesgo/Valor-de-aprendizaje.

- **FASE 0 — Estabilizar (0-2 días)** · rama `chore/stabilize-and-test-scaffold`
  Vigilar el fix de Oddly; QW3 (coherencia del cerebro); scaffold de tests (vitest) + CI. **Sin lógica nueva.**
- **FASE 1 — Fundamentos de medición (3-7 días)** · rama `feature/baselines-observability`
  QW1 (baselines por canal) + QW2 (knowledge confidence) + QW4 (decision-trace). Es el cimiento de TODO lo demás (§15).
- **FASE 2 — Memoria episódica + BrainState (8-14 días)** · rama `feature/episodic-memory`
  Esquema de "episodio" por video (`channel[/auto2]/episodes/*.json`) + un `BrainState` de solo-lectura que unifique los ~40 JSON dispersos para que el bot/cerebro lean un estado coherente.
- **FASE 3 — Experiment Engine + Hipótesis (15-21 días)** · rama `feature/experiment-engine`
  Registro de hipótesis (`channel/brain/hypotheses.json`) con estados/confianza/evidencia + formalizar control vs variante sobre `experiment_step.mjs`. Anti-confirmation bias (§40).
- **FASE 4 — Retención + Hook Intelligence (22-30 días)** · rama `feature/retention-hook-intel`
  Ingerir `audienceRetention` (CF2) → RetentionNeuron (puntos de abandono) + HookNeuron (memoria de hooks ganadores/fallidos) + prompts versionados (§19).
- **FASE 5 — Decision Engine + explore/exploit (31-45 días)** · rama `feature/decision-engine`
  Motor de decisión (expected_value/confidence/risk/cost/learning_value) + Thompson/bandit para elegir nicho/formato con recompensa rica (retención+CTR+subs). El Creative consulta memoria antes de idear.
- **FASE 6 — War Room 60 días + Monetization Dashboard (46-60 días)** · rama `feature/60day-warroom`
  Modo 60-DÍAS (prioriza watch/subs/retención/velocidad) + Daily/Weekly Brain Report formal + Monetization Readiness Dashboard (status/gap/trayectoria/riesgo/próxima acción) sobre lo que ya calcula `monetTrack`.

## 18. Git Branch Strategy
`main` (producción, protegida) ← PRs revisados. Ramas por feature (arriba). Convención: `feature/*`, `fix/*`, `chore/*`. Cada PR: objetivo + tests + doc + criterios de aceptación + plan de rollback. **Nada grande directo a main.** (El repo ya tiene CodeQL/Dependabot en cada PR.)

## 19. FIRST BRANCH TO CREATE
**`feature/baselines-observability`** (Fase 1).
- **Por qué primero:** los baselines (§15) son el cimiento de todo juicio del cerebro; hoy se decide por umbrales absolutos. Alto impacto, bajo riesgo (solo AÑADE `channel/baseline.json` + envuelve learnings; no toca producción).
- **Antes de arrancarla:** completar Fase 0 (scaffold de tests) para no volar a ciegas.

## 20. Definición de "hecho" (§54) — se aplicará a cada neurona
`code + tests + logging + docs + integración + manejo de errores + métricas`. Una neurona no está lista solo porque "corre".

---

**READY FOR PHASE 1**

(No inicio Fase 1 hasta que revises y apruebes este AUDIT. La secuencia sugerida arranca por Fase 0 — estabilizar + scaffold de tests — y luego la rama `feature/baselines-observability`.)
