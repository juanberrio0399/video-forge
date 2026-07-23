---
name: video-seo
description: Optimiza cada video y Short para RANKEAR alto y salir como sugerencia en la busqueda de YouTube Y en Google (SERP de video, Key Moments, AI Overviews). Usar al preparar el paquete de publicacion (titulo, descripcion, tags, capitulos, transcripcion) y para decidir el keyword objetivo. Complementa video-tendencias (que tema) y video-virales (packaging/CTR).
---

# video-seo

Especialista en descubrimiento. Objetivo: que cuando la gente busque en **YouTube
y en Google**, los videos/Shorts del canal salgan **arriba y como sugerencia**.
Rankear = relevancia (metadata + transcripcion) x satisfaccion (CTR + retencion +
engagement) x autoridad de canal. Trabaja sobre un tema ya validado por
video-tendencias y un packaging ya definido por video-virales.

## 1) Busqueda de YouTube (rankear en search)

Señales que pesan (validadas 2026): **retencion/satisfaccion > watch time bruto**
(un video de 7 min visto al 85% gana a uno de 15 min visto al 50%), **CTR**,
**engagement** (likes/comentarios/compartidos), **autoridad del canal**,
**sentimiento positivo**, y **relevancia de metadata**.

- **Keyword objetivo:** 1 keyword principal que la gente REALMENTE teclea (sacada
  del autocomplete de YouTube + Studio Research, ver video-tendencias). Un keyword
  amplio en el titulo correlaciona fuerte con ranking.
- **Titulo:** keyword principal en los primeros ~55 caracteres, <=60 total, lenguaje
  conversacional, sin keyword stuffing. (packaging: ver video-virales.)
- **Descripcion:** keyword principal + secundarias en las **primeras 2-3 frases**
  (los primeros 150 caracteres salen en SERP). Cuerpo 200-300 palabras que resume y
  usa variaciones del keyword natural.
- **Tags:** 8-10; el primero = keyword exacta, luego mezcla de generales y
  especificos. Peso menor hoy, pero dan contexto.
- **Transcripcion/subtitulos precisos:** sube subtitulos correctos (Whisper). YouTube
  y Google leen el transcript para entender y rankear; captions suben retencion.
- **Match de intencion:** el contenido debe responder de verdad la busqueda (si el
  titulo promete "how much", da la cifra pronto). Prometer y no cumplir hunde
  retencion y con ella el ranking.

## 2) Sugeridos / Browse (la mayor fuente de vistas)

El algoritmo elige sugeridos por: **relevancia topica** al video actual, **historial
del espectador**, y **contribucion a la sesion** (mayor cambio 2026: mas peso a que
tu video lleve a ver MAS contenido despues).

- **Loop de sesion:** end screen + "next video" que encadena al siguiente (ya en el
  guion). Sube session time = mas colocaciones en sugeridos.
- **Clusters tematicos:** varios videos del mismo sub-tema se recomiendan entre si;
  publica en racimos, no temas sueltos.
- **CTR + primeros 30 s** deciden si el sugerido se sostiene (ver video-virales).

## 3) Google (SERP de video, Key Moments, AI Overviews)

Google prioriza YouTube en resultados de video y en respuestas de IA.

- **Capitulos (timestamps) en TODO video** -> Google crea **Key Moments** y **cada
  capitulo puede rankear por separado** en Google. Formato `00:00 Titulo`. Obligatorio.
- **Transcripcion sin errores:** Google la usa para rankear el video y para citar
  fragmentos. Captions descuidados = menos ranking.
- **AI Overviews (Gemini):** incrusta **Featured Clips de 10-15 s** de YouTube en sus
  respuestas, sobre todo en consultas tipo "how to / how much / why". Framing de
  respuesta clara + capitulos + transcript = mas chance de ser citado. YouTube +
  Reddit son ~78% de las citas sociales en AI Overviews.
- **Titulo/descripcion tipo pregunta-respuesta:** ayuda a que Google te use como
  respuesta directa.

### Booster opcional (fase futura): pagina companion en Cloudflare

Para un salto extra en Google + AI Overviews, montar una pagina simple (Cloudflare
Pages, encaja con el stack) que **embeba cada video** con **VideoObject JSON-LD** +
**Clip/SeekToAction schema** (apuntando a los capitulos) + la transcripcion en texto.
Eso da rich results, Key Moments explicitos y mas probabilidad de aparecer en AI
Overviews. En YouTube directo no se agrega schema (YouTube lo genera solo); el schema
es para paginas propias. Specs: thumbnail >=60x30, URLs estables, VideoObject con
`name`, `description`, `thumbnailUrl`, `uploadDate`, `contentUrl`/`embedUrl`.

## 4) Shorts (search propio, decoupled)

Desde fines de 2025 los Shorts estan **desacoplados** del long-form (estrategia
aparte, ver video-shorts). Para descubrimiento:
- **Keyword en el titulo Y en la primera frase de la descripcion** -> aparece en
  busqueda de YouTube y en AI Overviews.
- Hook en 1-2 s + retencion alta = empuje. Captions quemados (accesibilidad + search).
- No dependas del Short para nutrir el largo (van por canales de recomendacion
  separados); el Short gana alcance frio, el largo convierte.

## Checklist SEO por video (antes de publicar)

- [ ] Keyword principal elegido desde demanda real (autocomplete + Studio Research).
- [ ] Titulo <=60c con keyword en los primeros ~55c, conversacional.
- [ ] Descripcion: keyword en las primeras 2-3 frases; cuerpo 200-300 palabras.
- [ ] 8-10 tags; primero = keyword exacta.
- [ ] Subtitulos/transcripcion precisos subidos.
- [ ] Capitulos con timestamps (para Key Moments de Google).
- [ ] Framing pregunta-respuesta si aplica (para AI Overviews).
- [ ] End screen + next video (loop de sesion) para sugeridos.
- [ ] Publicar en racimo tematico, no tema suelto.
- [ ] Shorts: keyword en titulo + primera frase de descripcion.

## Recursos / fuentes

- YouTube SEO 2026: https://backlinko.com/how-to-rank-youtube-videos · https://vidiq.com/blog/post/youtube-seo/
- Ranking factors 2026: https://outlierkit.com/resources/youtube-algorithm-updates/
- Video SEO Google/AI: https://www.lemonlight.com/blog/video-seo/ · https://www.vdocipher.com/blog/video-seo-best-practices/
- Capitulos + transcript para Google: https://seo-marketing.koeln/en/youtube-seo-2026-how-video-chapters-and-transcripts-secure-your-google-rankings/
- Base tomada de la skill MIT `kostja94/marketing-skills` (seo/on-page/video-optimization y platforms/youtube).
