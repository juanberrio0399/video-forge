---
name: video-shorts
description: Saca YouTube Shorts (9:16) de los momentos "wow" de un video largo del canal de datos, con captions virales y verticalizacion correcta. Usar despues de producir el video largo. Entrega los clips elegidos + spec de captions/reframe + plan de publicacion. Integra ai-youtube-shorts-generator.
---

# video-shorts

Editor de Shorts. De cada video largo sacas 3-5 clips de los momentos wow para
ganar alcance y llevar suscriptores al canal. El Short capta alcance frio; el
long-form retiene y convierte.

## Reglas de Shorts que convierten (2025-2026)

1. **Hook en 1-2 s** (el numero/dato mas loco va PRIMERO). 50-60% abandona en los
   primeros 3 s: arranca con tu mejor momento, sin intro.
2. **Jolt visual en el primer 0.5 s** (movimiento, cambio de color, algo que no
   encaja) para frenar el scroll.
3. **Gap de curiosidad, no resumen:** "Este pais gasta mas en X que todos sus
   vecinos juntos — y no es el que crees."
4. **Longitud 15-30 s** (sweet spot; tips 15-20, story 30-45). Maximiza el % de
   completado (>60% bajo 30 s), señal fuerte del algoritmo.
5. **Disena el loop:** el final encadena con el inicio; YouTube cuenta rewatches.
6. **Teasea el pago desde el inicio, revela al final** ("al final el dato que rompe todo").
7. **Subtitulos quemados SIEMPRE, grandes** (+15-25% retencion; mucha gente ve sin sonido).
8. **Regla audio-OFF:** que se entienda sin sonido (dato + grafica se leen solos).
9. **Un corte/beat cada 2-4 s** (5-7 s si es narrativo).
10. **Un Short = UNA idea/dato.** No metas tres estadisticas.
11. **Llena toda la pantalla 9:16.** Barras negras o 16:9 centrado = amateur.
12. **Numeros animados en pantalla,** no solo hablados (contador, barra que crece).
13. **CTA suave al final** ("la historia completa esta en el canal" / pin en comentarios).
14. **Publica constante, no en rafaga:** 3-5/semana; +de 4-5 da retornos decrecientes.

## Elegir el clip ganador de un video largo

Prioriza el segmento con: el numero mas extremo/contraintuitivo · el reveal/plot
twist (dato que contradice lo esperado) · el climax narrativo · una frase citable
de una linea · conflicto/comparacion (A vs B) · valor practico inmediato.
Requisitos: **autocontenido** (se entiende sin ver el resto) y con **hook natural
en su primer segundo**. Descarta lo que necesite >5 s de contexto. **Calidad, no
cantidad:** publica solo los que superen tu umbral.

## Captions + reframe (spec)

**Captions estilo viral (quemados):**
- Tamaño grande **90-100px+** en canvas 1080x1920 (legible en movil pequeño).
- Posicion tercio central / medio-inferior, dentro de la thumb-zone, evitando la
  franja inferior que tapa la UI de YouTube.
- **Karaoke:** aparicion palabra por palabra / frase por frase, sync al habla.
- Alto contraste, bold sans, contorno o caja detras; resalta el numero en otro
  color; max ~2 lineas visibles.

**Reframe 16:9 -> 9:16:**
- Canvas 1080x1920, llenar toda la pantalla (sin barras negras).
- Estructura vertical: **titular/hook arriba -> grafica/dato al centro -> captions abajo.**
- Para dashboards horizontales: recorta a la region del dato clave o rehaz la
  grafica en vertical; no reduzcas todo el 16:9 a una franja.
- Diseño mobile-first: prueba en pantalla de telefono antes de publicar.

## Estrategia de publicacion (crecer el canal)

- 3-5 Shorts por cada video largo. Cadencia 2-3/semana sostenible (hasta 4-5 si el
  pipeline aguanta) + 1-2 long-form al mes.
- **MISMO canal** (no separado): Shorts + long-form juntos crecen subs ~3x mas
  rapido y 2.5x mas watch-time el primer año.
- **Enlaza el Short al largo:** funcion "Related video", mencion en pantalla, pin
  del link en comentarios.
- **Goteo:** publica el largo y suelta los Shorts los dias siguientes, no todos el mismo dia.
- Itera con data: el hook que retiene >70% pasado el seg. 3, replicalo.

## Herramienta: ai-youtube-shorts-generator (SamurAIGPT, MIT)

Alternativa gratis a OpusClip/Klap. Transcribe con Whisper -> un LLM clasifica cada
segmento por *revelations, conflict, quotables, story peaks, practical value, hooks,
emotional peaks* -> candidatos rankeados con **score 0-100 + frase-hook + explicacion**.
Videos >30 min -> chunks con solape + dedup.

Modo local (gratis/headless): Python 3.10+, ffmpeg, yt-dlp, **faster-whisper**
(CPU/GPU) para transcripcion local, OpenCV para reframe, y API de LLM (**Gemini free
tier**) SOLO para el ranking. Sin suscripcion, sin marca de agua.
```
git clone https://github.com/SamurAIGPT/AI-Youtube-Shorts-Generator.git
pip install -r requirements.txt -r requirements-local.txt
python main.py "<url>" --mode local
```
Nota: su logica de ranking coincide con los criterios de "elegir el clip ganador"
de arriba — puedes replicar ese prompt aunque no uses el repo.

## Recursos GRATIS

- Repo: https://github.com/SamurAIGPT/AI-Youtube-Shorts-Generator · faster-whisper: https://github.com/SYSTRAN/faster-whisper
- Long -> Shorts (oficial): https://blog.youtube/creator-and-artist-stories/transitioning-your-long-form-content-to-youtube-shorts/
- Best practices 2026: https://miraflow.ai/blog/youtube-shorts-best-practices-2026-complete-guide · https://upmyviews.com/youtube-shorts-strategy-2026/
- Longitud/retencion: https://www.opus.pro/blog/ideal-youtube-shorts-length-format-retention
- Reframe/captions gratis: CapCut, YouTube "Edit into a Short".
