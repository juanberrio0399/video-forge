# Canal automático #2 — compilaciones transformadas (blueprint)

Segundo canal de YouTube **100% automático** (sin aprobación de Juan), de **compilaciones/formatos faceless transformados** en nichos de **muchas vistas + buena rentabilidad**. Usa **fuentes con licencia** (opción B) + **narración/edición IA** (opción C) para ser legal y no quemarse. **Separado** del canal actual (*The Data Lens*) en toda la app.

## 1. Concepto y diferencias con el canal actual

| | The Data Lens (actual) | Canal automático #2 |
|---|---|---|
| Modo | **Semi-auto** (Juan aprueba) | **Full-auto** (sin aprobación) |
| Cadencia | ~1 largo/día + shorts | **3 videos/día** en mejores horas |
| Contenido | Datos explicados (original) | Compilaciones transformadas (stock/CC + guion IA) |
| Fuente | Stock/IA para b-roll | Clips **con licencia** + stock + CC |

## 2. Estrategia de nichos — PORTAFOLIO + radar semanal

En vez de apostar a un solo nicho, arrancamos con **2-3 candidatos** validados (muchas vistas + rentables + automatizables + seguros) y dejamos que **la IA mida cuál rinde** y concentre esfuerzo:

- **Satisfying / ASMR** — máximas vistas, ~$10-11 RPM, 100% stock (bajo riesgo).
- **Narrativas cortas (traición/venganza, historias)** — crecimiento 21x, guion IA + b-roll stock.
- **Ciencia/datos con humor** — crece 16x, cerca del ADN del canal actual.

**Radar de nichos (semanal):** un análisis IA que cada semana mira vistas/retención/subs por nicho y **recomienda seguir, escalar o pivotar**. Así "sabemos si seguimos con lo mismo".

## 3. Inventario de herramientas

### ✅ Lo que YA tenemos (reutilizable ~90%)
Orquestación en la nube (Actions) · Worker + R2 + Mini App Telegram · subir/programar/privacidad YouTube · **programador de mejores horas** · **watchdog + auto-recuperación** · **QA** · **learnings** (aprende de métricas) · render HyperFrames + ffmpeg · voz Kokoro · guion Gemini · **SEO packaging + CTA retador** · shorts · miniaturas.

### 🔧 Lo que FALTA (a construir)
| Pieza | Qué es | Notas |
|---|---|---|
| **2º canal + OAuth** | Un canal/Brand Account nuevo + sus secrets | **Lo crea Juan** (manual). Secrets `YT2_*`. |
| **Multi-canal en R2** | Estado separado por canal (`ch/<canal>/…`) | Refactor para no mezclar. |
| **Ingesta de clips** | `yt-dlp` (descarga) + **compliance check** (fuente con licencia/CC) | Solo fuentes vetadas, no scraping ciego. |
| **Ensamblador de compilación** | Une clips + narración IA + intro/outro + transiciones | Base: `recipe_assemble`/`build_composition`. |
| **Editor auto** | `auto-editor` (corta silencios) + ffmpeg | Gratis, CLI. |
| **Playlists** | Crear/gestionar listas por API (`playlists.insert`) | Organiza el canal → más vistas/sesión. |
| **Radar de nichos** | IA semanal que detecta el nicho ganador | Nuevo workflow (cron semanal). |
| **App multi-canal** | Selector + análisis + reclamaciones | Ver sección 5. |

## 4. Fuentes y cumplimiento (para NO quemarse)

- **Fuentes (B):** Pexels/Pixabay/Dareful/Videvo (gratis/CC) · **Storyblocks** (~$30/mes, stock viral) · brokers **ViralHog/Jukin/Storyful/Clip Tiger** (licencia real). CC-BY con atribución.
- **Compliance check (antes de publicar):** la fuente debe ser licencia/CC/permitida + transformación mínima (guion/edición) + disclosure de voz IA. Sin eso, no publica.
- **No se hace:** re-subir clips ajenos sin licencia ni trucos para "esquivar" Content ID.

## 5. La app (sin mezclar los dos canales)

- **Selector de canal** arriba: *The Data Lens* ⟷ *Auto #2*. Cada uno con su propio estado.
- **Canal automático:** stats **generales** (videos, cantidad, minutos vistos, vistas/subs) + tarjeta **"¿mejorando o no?"** (tendencia semana a semana) + el **radar de nichos**.
- **Canal actual:** nueva pestaña **"Análisis del canal"** →
  - Salud global + **qué tan prometedor se ve** (score IA: crecimiento, retención, consistencia).
  - **Reclamaciones/problemas:** marca videos con estado de subida anómalo. *Límite honesto:* la API de YouTube expone si un video fue **rechazado** (motivo: copyright/duplicado/legal/tos) y su estado de procesamiento; los **reclamos de Content ID completos solo están en Studio** (no hay API pública para canales normales). Traigo todo lo que la API da y lo marco claro.

## 6. Playlists automáticas
Cada video se agrega a una **lista por nicho/serie** (`playlists.insert` + `playlistItems.insert`). Beneficio: reproducción encadenada → más watch-time → más recomendación → más suscriptores.

## 7. Fases de construcción (todo conectado)

0. **Estructura** (este doc) ✅
1. **App multi-canal** ✅ — app rediseñada por 5 flujos (Inicio/Producir/Agenda/Analítica/Más) + selector de canal (Data Lens / Auto #2) + pestaña **Análisis del canal** (score prometedor + reclamaciones vía API) + **radar de nichos** (workflow semanal `niche_radar.yml` + vista en Auto #2, en modo "recolectando datos" hasta que el auto publique).
2. **Plomería del 2º canal** — OAuth/secrets (**Juan crea el canal**), namespacing en R2 (`channel/auto2/…`, `niche_map.json`), config por canal. *(Siguiente.)*
3. **Ingesta + ensamblador** — `yt-dlp` + compliance + `auto-editor` + compilación + playlists.
4. **Producción full-auto** — 3/día en mejores horas + radar de nichos (cron semanal).
5. **Análisis y mejora** — "¿está mejorando?" + iterar sobre el nicho ganador.

**Dependencia de Juan:** crear el **2º canal (Brand Account)** y sacar su **refresh token OAuth** (como el actual). Sin eso, el canal #2 no puede publicar — pero las Fases 0-1 (estructura + app) se hacen sin eso.

*Documento vivo — actualizar según avancemos.*
