# Historias de usuario — video-forge

**Sistema:** fábrica 100% en la nube de videos para YouTube (canal *The Data Lens*, `@TheDataLensHQ`, nicho: datos que explican el mundo, faceless, en inglés). El cómputo pesado corre en GitHub Actions y Cloudflare (Worker + R2); nada se renderiza en el PC.

**Usuario:** Juan, dueño y operador único. Controla todo desde una **Telegram Mini App** (pestañas: Canal, Videos, Agenda, Control, Shorts, Crear) y recibe avisos por el chat del bot. El otro "actor" es **el sistema**: los workflows que producen, publican, programan y se auto-recuperan sin que nadie los dispare.

Estas historias están basadas en lo que el código realmente hace hoy (`bot/src/miniapp.js` + los workflows en `.github/workflows/`). No incluyen features futuras.

---

## 1. Producción automática

**HU-01** — Como sistema, quiero producir 1 video al día por cron sin que nadie lo dispare, para que el canal tenga cadencia sin depender de Juan ni de Telegram.
- Criterios:
  - `daily_video.yml` corre por cron (10:00 UTC) y por disparo manual.
  - Elige el próximo tema de la cola (`upcoming`) que no esté producido y vaya por delante de los públicos.
  - **Guarda 1:** si hay un video sin aprobar (`render_pending`), no produce y avisa por chat.
  - **Guarda 2:** si ya hay una producción/render en curso, no encima otra.
  - Si la cola está vacía, avisa que generará más temas en el próximo reporte.

**HU-02** — Como Juan, quiero disparar la producción de un video concreto desde la app, para arrancar la fábrica cuando yo decida.
- Criterios:
  - En Control, "▶️ Producir este video" lanza `produce_video.yml` con `topic` y `n`.
  - La IA escribe el guion del tema y lo guarda en el slot del proyecto en R2.
  - Encadena solo: guion → voz (`voice_parallel`) → render por fases → entrega a Control.
  - Mientras corre, la app muestra "⏳ Produciendo…" y el estado en "⚡ En proceso ahora".

**HU-03** — Como sistema, quiero renderizar el video largo por fases en paralelo, para que quepa en el runner gratis y salga parejo.
- Criterios:
  - `render_phased.yml` parte la narración en fases (~120 s) y renderiza cada una en paralelo.
  - Cada fase pasa su propia puerta de calidad (hasta 3 intentos, umbral 7.5).
  - Al final une las fases en el video completo.
  - Permite re-renderizar solo fases concretas (`only_phases`) reutilizando un run previo (`base_run_id`).

**HU-04** — Como Juan, quiero ver en qué paso va la producción, para saber cuánto falta sin abrir GitHub.
- Criterios:
  - Control muestra el flujo de 6 pasos (Guion → Voz → Render → Aprobar → Publicar → Shorts) con el paso actual marcado.
  - "⚡ En proceso ahora" lista los workflows activos con su etapa y barra de progreso.
  - El estado global se ve arriba en todas las pestañas cuando algo corre.

---

## 2. Revisión y aprobación del video

**HU-05** — Como Juan, quiero revisar el video renderizado y su nota de calidad IA antes de subir nada, para no publicar algo malo.
- Criterios:
  - Cuando hay `render_pending`, Control muestra "🎬 Video listo — revísalo y aprueba".
  - Botón "▶️ Ver el video" abre el preview; se muestra la duración y avisos (p. ej. video corto).
  - Muestra la nota IA `/10` con color según umbral.

**HU-06** — Como Juan, quiero aprobar o regenerar el video con un toque, para avanzar o repetir sin fricción.
- Criterios:
  - "✅ Aprobar" lanza `publish_youtube.yml` (sube y prepara el SEO).
  - "🔁 Regenerar el video" (con confirmación) relanza `render_phased.yml`.

---

## 3. SEO y publicación

**HU-07** — Como sistema, quiero generar el paquete SEO con IA y subir el video a YouTube como privado, para que Juan lo revise antes de hacerlo público.
- Criterios:
  - `publish_youtube.yml` genera título, descripción, tags, capítulos y subtítulos con IA.
  - Sube el video a YouTube en **privado** (OAuth: `YT_CLIENT_ID`/`SECRET`/`REFRESH_TOKEN`).
  - Guarda el paquete SEO y el `video_id` en R2 para poder regenerar el SEO después.

**HU-08** — Como Juan, quiero ver el SEO propuesto (con su nota y problemas) y regenerarlo con comentarios, para publicar con un SEO que me convenza.
- Criterios:
  - Control muestra título, descripción, tags y una vista previa tipo tarjeta de YouTube.
  - Muestra nota global del SEO y la lista de problemas si los hay.
  - Un textarea de comentarios + "🔁 Regenerar SEO" lanza `seo_regen.yml` con las notas.

**HU-09** — Como Juan, quiero aprobar el SEO y que se agende solo en la mejor hora, para publicar sin elegir horario a mano.
- Criterios:
  - "✅ Aprobar y programar (mejor hora)" llama a `/api/approve`, que agenda en la próxima franja libre (EEUU).
  - Si no encuentra franja, ofrece "📅 Programar" y "🌍 Publicar ahora" como alternativas.
  - Confirma en un toast la hora programada (ET + hora local).

**HU-10** — Como Juan, quiero publicar el video de inmediato como público, para saltarme la mejor hora cuando lo necesite.
- Criterios:
  - "🌍 Publicar ahora" (con confirmación) lanza `set_privacy.yml` con `privacy=public`.
  - También disponible por fila en la matriz de Control ("＋ Hacer" en 🌍 Público).

**HU-11** — Como Juan, quiero revisar la miniatura antes de ponerla, para no publicar una imagen que no me gusta.
- Criterios:
  - Control muestra la miniatura pendiente con "✅ Aprobar" o "🔁 Rehacer otra".
  - Generar/rehacer lanza `thumbnail_only.yml` en modo `generate`; publicarla lanza modo `apply`.
  - Aprobar la marca vía `/api/thumb-approve`; publicarla no cambia lo ya en vivo salvo esa imagen.

---

## 4. Agenda y calendario

**HU-12** — Como Juan, quiero un calendario día a día con 2 franjas por día en las mejores horas, para ver qué sale y qué queda libre (meta 2/día).
- Criterios:
  - Agenda muestra cada día con sus franjas llenas/libres y un badge de progreso (`x/2`).
  - Al aprobar un video o short, se agenda solo en la próxima franja libre.
  - Marca las franjas con hora manual (`off_slot`).

**HU-13** — Como Juan, quiero ver los videos/shorts ya programados con su hora exacta, para saber qué se va a publicar solo.
- Criterios:
  - Agenda lista los programados con hora en ET + hora local.
  - Al publicarse, YouTube los pasa a público y desaparecen de la lista.

**HU-14** — Como Juan, quiero una guía de las mejores horas para publicar (audiencia EEUU), para subir en el momento que más empuja el algoritmo.
- Criterios:
  - Tabla semanal con la ventana óptima por día en ET y convertida a hora local (maneja el DST solo).
  - Marca los mejores días (★) y recomienda "publicar ahora / próxima buena hora".

**HU-15** — Como sistema, quiero dejar el video privado con `publishAt`, para que YouTube lo haga público solo a la hora programada.
- Criterios:
  - `schedule_youtube.yml` recibe `video_id` + `publish_at` (ISO UTC) y corre `youtube_schedule.mjs`.
  - Avisa por chat el resultado y remite a la app (Control → Programados).

---

## 5. Análisis del canal

**HU-16** — Como Juan, quiero ver las métricas del canal en vivo (subs, vistas, min vistos, videos), para saber cómo va de un vistazo.
- Criterios:
  - Pestaña Canal muestra KPIs del canal completo y analytics de YouTube.
  - Gráfica de vistas por día (últimos 7 días) con eje Y numérico.
  - Advierte del retraso de ~1-2 días de YouTube Analytics y del scope OAuth si falta.

**HU-17** — Como Juan, quiero seguir el progreso hacia la monetización (YPP), para saber cuánto me falta.
- Criterios:
  - Barras de suscriptores (/1000) y horas vistas (/4000).
  - Indica si el canal es elegible o no para monetizar.

**HU-18** — Como Juan, quiero ver todos mis videos con sus shorts anidados, vistas y minutos, para analizar el rendimiento por pieza.
- Criterios:
  - Pestaña Videos: árbol de cada largo con sus shorts debajo y fila de Total.
  - Distingue público/privado y muestra "min vistos" solo si hay permiso de Analytics.

**HU-19** — Como Juan, quiero un análisis IA de qué replicar y de tendencias, para decidir con datos qué contenido hacer.
- Criterios:
  - "🧠 Analizar qué replicar" (`/api/insights`) explica qué videos rinden y por qué.
  - "🔥 Analizar tendencias" (`/api/trends`) evalúa si la cola está alineada con lo que sube.

**HU-20** — Como sistema, quiero jalar las métricas reales de cada video publicado y actualizar el estado del canal, para alimentar la app y los reportes.
- Criterios:
  - `channel_report.yml` trae subs, vistas, likes y monetización, actualiza `state.json` en R2 y manda reporte al chat.
  - Botón "🔄 Refrescar métricas" lo dispara desde la app.

---

## 6. Shorts

**HU-21** — Como sistema, quiero que la IA analice el último video y proponga shorts (cuántos, momentos, largo, hashtags), para no decidirlo a mano.
- Criterios:
  - `shorts_plan.yml` analiza guion + tiempos y guarda el plan en R2 (no genera video aún).
  - Estampa de qué `video_id` es el plan para no re-sugerir.
  - Avisa por chat cuántos sugiere y remite a la app para aprobar.

**HU-22** — Como Juan, quiero aprobar o saltar cada short sugerido, y regenerar las sugerencias con comentarios, para quedarme solo con los que valen.
- Criterios:
  - Pestaña Shorts lista los pendientes con título, corte (desde el minuto X), gancho y caption.
  - "✅ Aprobar" / "❌ Saltar" por short (`/api/short`).
  - Textarea + "🔁 Regenerar sugerencias" relanza `shorts_plan.yml` con las notas.

**HU-23** — Como sistema, quiero generar los shorts aprobados en formato pro y subirlos, para publicar verticales de calidad sin trabajo manual.
- Criterios:
  - "🎬 Generar los aprobados" lanza `shorts_final.yml`.
  - Formato 9:16 con logo audio-reactivo, karaoke palabra x palabra, voz TTS y música con ducking.
  - Sube los shorts a YouTube como privados.

**HU-24** — Como Juan, quiero que los shorts no se publiquen hasta que su video padre sea público, para que no lleven a un video que nadie ve.
- Criterios:
  - Si el padre no es público, la app bloquea la publicación y muestra "⏳ Esperando que se publique el video".
  - Con el padre público, "📅 Programar" agenda el short (`/api/schedule`).

---

## 7. Auto-mejora y aprendizaje

**HU-25** — Como sistema, quiero aprender del render anterior y aplicarlo al siguiente, para que cada video salga mejor que el previo.
- Criterios:
  - Control muestra "🔧 Auto-mejora": última nota, gancho, footage a mejorar y ajustes (luz/saturación/contraste/ritmo).
  - Esos ajustes se aplican automáticamente al próximo render.

**HU-26** — Como sistema, quiero analizar el rendimiento real de lo ya publicado y meterlo en el próximo guion, para orientar el contenido por datos.
- Criterios:
  - Control muestra "📈 Qué estamos mejorando" con un brief y los videos que más rinden.
  - Indica la fuente (métricas reales / tendencias / buenas prácticas) según haya datos y OAuth.

**HU-27** — Como sistema, quiero identificar, clasificar y aprender de los errores, para reintentar lo transitorio solo y sacar a la luz lo recurrente.
- Criterios:
  - Canal muestra "🛠️ Aprendizajes de errores": incidentes categorizados (transitorio/config/código/datos) con causa y fix.
  - Los patrones recurrentes salen como chips con su conteo.

---

## 8. Auto-recuperación 24/7

**HU-28** — Como sistema, quiero detectar corridas colgadas y auto-curarme, para que la fábrica no se quede trabada sin que Juan mire.
- Criterios:
  - `watchdog.yml` corre por cron (cada 15 min) con permiso `actions: write`.
  - `watchdog.mjs` cancela lo colgado, avisa a Juan y reintenta el render.

**HU-29** — Como sistema, quiero un pre-vuelo que valide las herramientas antes de producir, para no arrancar una producción con una API crítica caída.
- Criterios:
  - `produce_video.yml` corre `preflight.mjs`; si una herramienta crítica está caída, aborta y avisa por chat.
  - Guarda el estado en `tools_health.json` en R2 para verlo en la app.
  - Canal muestra "🧰 Herramientas diarias" con OK/degradado/crítico y hora de validación.

**HU-30** — Como Juan, quiero ver los problemas de las últimas 24 h y reintentar o abrir el log, para resolver fallos desde la app.
- Criterios:
  - Canal/Control muestran "⚠️ Problemas" con el paso donde falló cada uno.
  - "🔁 Reintentar" relanza el workflow; "📋 Ver el error" trae el detalle (`/api/error-detail`); "↗ Log completo" abre GitHub.

**HU-31** — Como Juan, quiero vigilar el uso de R2 (almacenamiento gratis), para liberar espacio antes de pasarme del límite.
- Criterios:
  - Canal muestra GB usados/límite, nº de archivos y barra de progreso.
  - Al ≥80% avisa en ámbar que hay que borrar renders/audios viejos.

---

## 9. Control y creación desde la app

**HU-32** — Como Juan, quiero ver la matriz "qué le falta a cada video" y completarlo con un toque, para no perder de vista lo pendiente.
- Criterios:
  - Control muestra por video el estado de 🌍 Público / 🖼️ Miniatura / 🎬 Shorts.
  - "＋ Hacer" dispara la acción que falta; los videos completos no aparecen.

**HU-33** — Como Juan, quiero escuchar y elegir la voz del canal, para fijar la voz de los próximos videos.
- Criterios:
  - Pestaña Crear muestra las voces con reproductor de muestra y marca la actual.
  - "Usar" fija la voz (`/api/voice`); las muestras las genera `voice_samples.yml`.

**HU-34** — Como Juan, quiero subir una foto para retocar, una receta o una nota de voz, para tareas de contenido puntuales desde el móvil.
- Criterios:
  - "Editar foto" sube imagen + prompt (`/api/upload`, kind `photo`) → `photo_edit.yml`.
  - "Reel de receta" sube fotos/videos + texto (kind `recipe`) → `recipe_reel.yml`.
  - "Subir nota de voz" guarda un audio con nombre (kind `voice`); el resultado llega al chat.

**HU-35** — Como Juan, quiero que la app se refresque sola y me guíe por pestañas, para operar todo sin recargar ni perder lo que escribo.
- Criterios:
  - Auto-refresco rápido (9 s) cuando algo corre y lento (25 s) cuando no.
  - No refresca la pestaña Crear ni mientras escribo, para no borrar texto a medias.
  - Cada pestaña muestra una ayuda corta de qué hace.

---

## Resumen

| HU | Área | Estado |
|----|------|--------|
| HU-01 | Producción automática | Hecho |
| HU-02 | Producción automática | Hecho |
| HU-03 | Producción automática | Hecho |
| HU-04 | Producción automática | Hecho |
| HU-05 | Revisión y aprobación | Hecho |
| HU-06 | Revisión y aprobación | Hecho |
| HU-07 | SEO y publicación | Hecho |
| HU-08 | SEO y publicación | Hecho |
| HU-09 | SEO y publicación | Hecho |
| HU-10 | SEO y publicación | Hecho |
| HU-11 | SEO y publicación (miniatura) | Hecho |
| HU-12 | Agenda y calendario | Hecho |
| HU-13 | Agenda y calendario | Hecho |
| HU-14 | Agenda y calendario | Hecho |
| HU-15 | Agenda y calendario | Hecho |
| HU-16 | Análisis del canal | Parcial (depende de datos/permiso Analytics) |
| HU-17 | Análisis del canal | Hecho |
| HU-18 | Análisis del canal | Parcial (min. vistos requieren scope Analytics) |
| HU-19 | Análisis del canal | Hecho |
| HU-20 | Análisis del canal | Hecho |
| HU-21 | Shorts | Hecho |
| HU-22 | Shorts | Hecho |
| HU-23 | Shorts | Hecho |
| HU-24 | Shorts | Hecho |
| HU-25 | Auto-mejora y aprendizaje | Hecho |
| HU-26 | Auto-mejora y aprendizaje | Parcial (mejor con métricas reales + OAuth) |
| HU-27 | Auto-mejora y aprendizaje | Hecho |
| HU-28 | Auto-recuperación 24/7 | Hecho |
| HU-29 | Auto-recuperación 24/7 | Hecho |
| HU-30 | Auto-recuperación 24/7 | Hecho |
| HU-31 | Auto-recuperación 24/7 | Hecho |
| HU-32 | Control desde la app | Hecho |
| HU-33 | Control / creación | Hecho |
| HU-34 | Control / creación | Hecho |
| HU-35 | Control desde la app | Hecho |
