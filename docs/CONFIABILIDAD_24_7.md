# Confiabilidad 24/7 — video-forge

Auditoría del flujo completo (23 workflows, ~50 scripts, el Worker) para responder una sola pregunta: **¿funcionará 24/7 sin quedarse trancado, colapsar o quedar en limbo?**

> **Veredicto:** el sistema se auto-cura muy bien **dentro del render** (checkpoints por fase, watchdog, QA con cortacircuitos, fallback ffmpeg). La autonomía end-to-end depende de dos cosas externas que hay que cuidar: el **OAuth de YouTube** (acción manual) y los **límites del Worker** (ya mitigado). Ninguna falla hoy — el trabajo fue cerrarlas antes de que fallen.

## Estado real (evidencia operativa)

| Señal | Estado | Nota |
|---|---|---|
| Watchdog | ✅ 27/27 éxitos | dispara cada 15 min, puntual |
| Render | ✅ estable | 6 renders seguidos OK; los cancelados fueron antes del arreglo de timeout y el watchdog los recuperó |
| OAuth YouTube | ✅ funcionando | publicaciones recientes exitosas |
| Anti-huecos | ✅ operando | los N re-encolados (Netflix/McDonald's/Spotify) se están produciendo |

## Mapa de fallos

Severidad: 🔴 **Bloqueante** (rompe el 24/7) · 🟠 **Degrada** (limbo/pérdida parcial) · ⚪ **Menor**.

### 🔴 Bloqueantes

**1. OAuth de YouTube caduca cada 7 días** — *acción manual de Juan*
Si la app OAuth de Google está en modo **“Testing”**, Google revoca el refresh token cada 7 días. Muere subir/programar/privacidad/shorts, y la guarda del video diario congela toda la producción.
**Solución:** Google Cloud Console → *APIs & Services → OAuth consent screen* → si dice *Testing*, botón **“PUBLISH APP → In production”**. Con eso los tokens dejan de expirar.
**Estado:** ⏳ pendiente (solo lo puede hacer Juan).

**2. El Worker revienta al crecer el canal (~20-25 videos)** — *código*
`bot/src/index.js` — `video_matrix` hacía un `R2.head` por cada video largo, **sin cache, en cada `/api/state`**. En plan free (50 subrequests) eso rompía de forma permanente al acumular videos.
**Solución aplicada:** ✅ las miniaturas se resuelven **una vez** dentro de `inventory_cache` (cacheado 10 min), no en cada request. Además `r2Usage` se acotó (cache 6h, tope 12 páginas) y `r2json` es resiliente a blips de R2.

### 🟠 Degradan / limbo

**3. El watchdog era ciego a parte de la cadena** — *código*
Solo vigilaba voz→render. La ventana de rescate se cerraba a los 120 min (abandonaba videos con un cron atrasado).
**Solución aplicada:** ✅ ventana de rescate ampliada a **6 h**; y los disparos entre workflows (daily→produce, guion→voz, regen-QA→voz) ahora **reintentan** (4 intentos), que era donde la cadena se rompía en silencio con `|| true`.

**4. Sin reintento el mismo día** — *código*
Un solo cron de producción (10:00 UTC); un fallo antes del render perdía el día.
**Solución aplicada:** ✅ **cron de rescate a las 15:00 UTC**. Las guardas (`render_pending` / producción en curso) evitan pisar: si la mañana dejó algo, el rescate no hace nada.

**5. Sin timeout en fetches externos** — *código, pendiente*
Ni el Worker ni los scripts usan `AbortController`. Una API **lenta** (no caída) arrastra `/api/state` o gasta el job.
**Solución propuesta:** `AbortSignal.timeout()` en cada fetch externo. *(Degrada, no bloqueante — pendiente.)*

**6. El PAT de GitHub / los crons pueden morir en silencio** — *código, pendiente*
Toda la orquestación cuelga del `GH_TOKEN`; GitHub deshabilita crons tras 60 días de inactividad del repo (mitigado: el repo tiene actividad diaria).
**Solución propuesta:** check de validez del PAT en `tools_health` con alarma de expiración. *(Pendiente.)*

**7. Subida a YouTube sin reintento ante blips** — *código, pendiente*
`youtube_upload.mjs` sube ~300 MB en un intento; un 429/corte transitorio falla. (`invalidPublishAt` ya se maneja soft ✅.)
**Solución propuesta:** backoff en 429/5xx y reanudar el PUT desde `Range`.

### ⚪ Menores
- Un beat suelto de Kokoro mete 1 s de silencio en vez de reintentar (pasa QA si son pocos).
- El cortacircuitos del watchdog reenvía el mismo aviso cada 15 min.
- El Worker pide el token OAuth dos veces por request (1 subrequest evitable).

## Lo que ya estaba bien (confirmado)
Multi-modelo Gemini (sin 404) · QA advisory (sin loop infinito) · `invalidPublishAt` soft · anti-huecos ("producido = publicado") · anti-limbo (salta tras 3 intentos) · checkpoints por fase + fallback ffmpeg · auth owner-only del Worker · `/api/*` en try/catch · `no-store` anti-cache de Telegram.

## Pendientes priorizados
1. 🔴 **Juan:** pasar la app OAuth a “In production” (elimina la caída cada 7 días).
2. 🟠 Timeouts (`AbortSignal`) en fetches externos.
3. 🟠 Check del PAT de GitHub + reintento de subida a YouTube.

*Última auditoría: 2026-08-05.*
