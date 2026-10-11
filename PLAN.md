# Plan — video-forge

Actualizado: 2026-10-11 · Estado: **activo** (Oddly Loop) · **en pausa** (The Data Lens, solo métricas)

El cómo está en el [README](README.md) y en [`docs/`](docs/). Este archivo dice dónde está el proyecto y qué sigue.

## De qué trata

Una fábrica de Shorts de YouTube que corre sola en la nube, sin PC ni servidor: escribe el guion, narra, ensambla, verifica licencias, sube, programa, mide y decide qué producir después. Alimenta dos canales separados de punta a punta:

- **Oddly Loop** (`@oddlyloophq`): ASMR y satisfying con fuentes licenciadas. Full-auto. **Es el foco.**
- **The Data Lens** (`@TheDataLensHQ`): historia y datos. Producción apagada desde el 2026-10-04 (#167); se re-pivota a clipping fuera de este repo. Aquí solo se sigue midiendo.

Meta: que Oddly encuentre un formato que el algoritmo distribuya. YPP es la consecuencia, no el plan.

## Cómo funciona hoy

| Paso | Dónde | Cuándo |
|---|---|---|
| Cerebro: juzga decisiones vencidas y arma el plan de hoy y mañana | `brain_live.yml` → `pipeline/brain_live.mjs`, `pipeline/lib/lineup.mjs` | cada 2 h |
| Cadencia por nicho (satisfying 6 + animales 6, alternando variantes) | `daily_oddly.yml`, estado vivo en R2 `channel/auto2/cadence.json` | diario |
| Producción: guion (Gemini) → voz (Kokoro) → clips → ensamblaje | `produce_oddly.yml`, `compilation_script.mjs`, `build_compilation.mjs` | lo dispara el cerebro |
| Puerta de licencias | `compliance_check.mjs` + `channel/auto2/sources.seed.json` | antes de subir |
| Subida privada + mejor franja libre | `youtube_upload.mjs`, `best_slot.mjs` | tras producir |
| Medición: episodios, score, A/B, retención | `episodes.yml` y la cadena diaria (ver README) | diario |
| Mando e interfaz | Worker `bot/` + Mini App en Telegram; R2 `video-forge` es la memoria | siempre |

La fuente de verdad del estado es **R2**, no el repo: `channel/auto2/state.json` (Oddly) y `channel/state.json` (Data Lens). Los `*.seed.json` del repo solo se usan si R2 no responde.

## Qué se necesita

- **GitHub Actions**: el repo es público, los minutos no cuestan.
- **Cloudflare** (plan gratis): Worker del bot + R2. La cuenta tiene un tope de 5 cron triggers (hoy se usan 3).
- **YouTube Data API**: OAuth por canal (`YT_*` Data Lens, `YT2_*` Oddly). El refresh token no caduca porque la app está "In production".
- **IA gratis**: Gemini (`GEMINI_API_KEY`, `GEMINI_API_KEY2`), con Groq, Cerebras, OpenRouter, SambaNova y GitHub Models como respaldo; Kokoro para la voz.
- **Fuentes de clips**: Pexels, Pixabay, NASA, Wikimedia, Archive, Freesound.
- **Telegram**: `TELEGRAM_BOT_TOKEN`, `OWNER_CHAT_ID`.
- **`GH_TOKEN`** (PAT): encadena workflows por `workflow_dispatch`.
- Costo mensual: **0**.

## Cómo debe funcionar

- Oddly produce y programa a diario sin intervención, con cola de 1–2 días y 2 piezas por hora como tope.
- Cada pieza queda como decisión con métrica, plazo y criterio; el cerebro la juzga sola.
- El cerebro decide por aritmética: si el volumen no alcanza la meta, pide **cambiar el formato**, no producir más.
- Ninguna conclusión con muestra chica: menos de 5 videos por brazo = "todavía no se sabe".
- Si algo falla, se nota: workflow rojo o aviso en Telegram, nunca un verde que no hizo nada.

**Señal de que va bien:** el A/B de formato da ganador y la mediana de vistas por Short sube de las ~46 actuales (al 2026-10-03).

## Qué se hizo

| Fecha | Qué | PR |
|---|---|---|
| 2026-09-10/14 | Brain OS fases 0–4, AI OS en Telegram, cerebro en vivo, pausa de Data Lens | #57–#117 |
| 2026-09-29 | Shorts finales y su plan por cron, con guardas contra duplicados | #147–#149 |
| 2026-09-29 | LICENSE Apache 2.0 completo (estaba truncado) | #150 |
| 2026-10-03 | Cerebro: volumen vs formato por aritmética; subtítulos que ya no se cortan | #157 |
| 2026-10-03 | **Experimento de formato** `un_hecho` vs lista (narrado), en el mismo nicho | #158, #159 |
| 2026-10-03 | Outliers corregidos por tasa base; veredicto honesto; aviso de muestra chica | #160, #161 |
| 2026-10-03 | Antiduplicados de títulos (Oddly y Data Lens) | #162, #163 |
| 2026-10-04 | Inventario de Data Lens desde `state.json`; largos arreglados y apagados a propósito | #164–#166 |
| 2026-10-04 | Data Lens fuera del foco: producción apagada, cerebro solo para Oddly | #167, #168 |
| 2026-10-08 | `episodes.yml` volvió a correr (llevaba 2 días caído) + test que valida el bash de los workflows | #172, #174 |
| 2026-10-09/10 | El plan ya no tapa franjas de animales con satisfying; `un_hecho` sin ideas de lista | #175, #176 |

## Qué falta

**Ahora**
1. **Veredicto del A/B de formato.** Se espera entre el 14 y el 17 de octubre, cuando haya 5 videos maduros por brazo. Si gana `un_hecho`, se escala; si no, el problema está más arriba que el formato.
2. **#151:** Oddly choca con el límite diario de subidas de YouTube (`uploadLimitExceeded`) y pierde piezas.

**Después**
3. #153: avisos de Node 20 deprecado (actions `download-artifact@v4`, `setup-python@v5`).
4. #152: CLI de HyperFrames 41 versiones atrás.
5. #143: un render que cae por timeout no se reanuda solo.
6. Issues del radar sin priorizar: #144 (Kokoro sin PyTorch), #145 (`@google/genai`), #146 (cuota concurrente), #122, #123, #132, #133, #134, #45.

**Depende de Juan**
- Decidir qué pasa con The Data Lens tras el clipping: reactivar, dejar solo métricas o cerrar.
- Encender los largos si algún día se quieren: `channel/largos.json` → `"activo": true`.

## Trampas conocidas

- **La verdad está en R2.** `sync_cadence.yml` pisa la cadencia viva con el seed del repo: poner el seed al día **antes** de dispararlo.
- **Un "success" no prueba nada.** Hay que leer el log. Ojo al buscar en logs de Actions: incluyen la definición de cada comando (parece que todo corrió) y `429` aparece dentro de las marcas de tiempo.
- **Workflows deshabilitados desde la interfaz** no se arreglan editando el YAML: hay que habilitarlos (`gh workflow enable`).
- **YAML válido no es bash válido.** `tests/workflows_bash.test.mjs` pasa cada `run:` por `bash -n`.
- **`inventory_cache.json` no es fuente**: lo escribe el bot solo al abrir la app y 7 workflows lo borran a propósito.
- **Los tests deben usar la forma real de los datos.** En `state.json`, `shorts` es un conteo, no una lista.
- **Protección de `main`**: rama al día (`strict`) y conversaciones resueltas; CodeQL abre hilos que bloquean el merge.
- **Los dos canales nunca comparten** estado, credenciales ni agendado.
