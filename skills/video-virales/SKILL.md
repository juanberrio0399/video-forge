---
name: video-virales
description: Analiza por que un video se vuelve viral y disena el packaging (titulo + miniatura de alto CTR); hace ingenieria inversa ETICA de competidores para replicar el formato (no el contenido). Usar para definir titulo/miniatura antes de publicar y para estudiar outliers del nicho. Integra claude-video-vision para analisis frame-a-frame.
---

# video-virales

Experto en viralidad y packaging. **CTR abre la puerta; la retencion gana la
siguiente impresion.** Con CTR alto pero retencion baja, YouTube deja de
recomendar. Disenas titulo+miniatura como UNA unidad y sacas el patron de los
outliers del nicho — replicas formato, nunca contenido.

## Reglas de viralidad + packaging (2025-2026)

1. **CTR alto + retencion:** CTR solo prueba el empaque; la retencion prueba que
   cumple. Benchmarks: CTR <4% pobre, 7% bueno, 9-10%+ excepcional.
2. **La "satisfaccion" es señal #1** (encuestas 1-5 estrellas), no el watch time
   bruto. Un video que gusto 4 min gana a uno tolerado 8 min.
3. **Optimiza session contribution:** que el viewer vea 2+ videos despues del tuyo.
   El algoritmo premia extender la sesion.
4. **Primeras 24-48 h = test:** sube a subs + micro-audiencia; si CTR/retencion son
   fuertes, expande 7-14 dias.
5. **Titulo + miniatura = UNA unidad:** la miniatura muestra lo que el titulo NO
   dice, y viceversa. Duplicar desperdicia la mitad del gancho.
6. **Hook 0-15 s = punto de quiebre.** Mayor caida entre seg. 10-20; ~55% se pierde
   al minuto 1 con intro debil. Estructura: pattern interrupt (0-5s) -> promesa
   especifica (5-15s) -> stakes/hook de compromiso (15-30s). Nada de "hola, suscribete".
7. **Abre un open loop:** pregunta sin responder, afirmacion audaz, o mostrar el
   resultado ANTES de explicarlo.
8. **Faceless: nunca estatica >3-4 s.** Anima/cambia el visual cada pocos segundos.
9. **CTR alto + salida inmediata = bandera roja** (YouTube lo lee como gaming y lo
   entierra). El clickbait que no cumple hunde el video.
10. **Contraste extremo suple la ausencia de cara** en la miniatura: 1 sujeto
    dominante, fondo limpio, texto que carga la emocion.
11. **Test & Compare (nativo, gratis):** hasta 3 miniaturas; YouTube elige por share
    de watch time en hasta 14 dias.

## Formulas de titulo (alto CTR) + checklist de miniatura

**Titulos (~50-60 caracteres, 1 idea, numero concreto):**
- Curiosity gap honesto: "The YouTube rule nobody talks about that's burying faceless videos"
- Outcome + timeframe: "How I Cleaned 2M Rows in 10 Minutes"
- Contrarian: "Everyone's Wrong About [tema]"
- Experimento/stakes: "I Tried [X] for 30 Days — Here's What the Data Showed"
- Numero + contraste: "$0 vs $10,000 Data Stack — The Difference Surprised Me"
- Power words con moderacion (Secret, Hidden, Proven, Surprising). PROHIBIDO
  prometer lo que el video no paga (hunde retencion -> entierro).

**Miniatura de alto CTR (faceless/data):**
- [ ] 1 sola idea / foco dominante; max 2-3 elementos.
- [ ] Texto <=3-4 palabras, legible al tamaño de una uña (movil).
- [ ] Contraste extremo (p.ej. amarillo sobre negro).
- [ ] Muestra el resultado/transformacion/gancho visual (grafico impactante, cifra gigante, antes/despues).
- [ ] Emocion/tension (flecha, circulo rojo, numero creciente).
- [ ] NO duplica el texto del titulo.
- [ ] Prueba 3 variantes con Test & Compare.

## Ingenieria inversa ETICA de un competidor

1. **Identifica outliers, no promedios** (videos que superan MUCHO la media del
   canal). Gratis: YouTube Studio -> Trends (breakouts, gaps) y Autonolab Outlier
   Finder; freemium: vidIQ Outlier, OutlierKit, 1of10, TubeLab.
2. **Diagnostica el packaging:** que formula de titulo, que idea unica en la
   miniatura, cual es el gap de curiosidad.
3. **Disecciona los primeros 30 s:** que pattern interrupt abre, a que segundo la
   promesa, que open loop deja abierto.
4. **Mapea estructura y ritmo:** cada cuantos segundos corta/cambia visual, cuando
   entra texto, como encadena datos.
5. **Extrae el PATRON, no el contenido.** Anota la plantilla reutilizable.
6. **Reconstruye con tu angulo/datos** y valida con Test & Compare.

**Etica:** replicar formato, estructura de hook, ritmo y tipo de packaging = OK.
Copiar guion, narracion o assets = plagio. Extrae el patron, reconstruye propio.

## Analisis frame-a-frame con claude-video-vision

Plugin de Claude Code (github.com/jordanrendric/claude-video-vision): usa ffmpeg
para extraer frames + yt-dlp para bajar el video + transcribir (captions/Whisper/
Gemini). Claude interpreta los frames.
- Instalar: `/plugin marketplace add https://github.com/jordanrendric/claude-video-vision` -> `/plugin install claude-video-vision`
- Uso: `/watch-video <url> "analiza el hook, el ritmo de corte y el texto en pantalla"`
- Pidele: momentos de corte, timestamps de texto en pantalla, estructura del hook.
- Requisitos: Node 20+, ffmpeg; backend de audio Whisper local o Gemini (free tier).

## Errores de packaging que hunden un video

- Clickbait que engaña (alta salida -> entierro). Titulo y miniatura que dicen lo
  mismo. Texto de miniatura largo/ilegible en movil. Miniatura recargada sin foco.
- Intro con "hola, suscribete" o contexto largo. Estatica >3-4 s en faceless.
- Dar el payoff despues del seg. 15. CTR alto sin sustancia. Copiar contenido ajeno.

## Recursos GRATIS

- Algoritmo 2026: https://vidiq.com/blog/post/understanding-youtube-algorithm/ · https://outlierkit.com/resources/youtube-algorithm-updates/
- Titulos 8%+: https://fluxnote.io/guides/how-to-write-viral-youtube-titles-2026 · Primeros 30 s: https://prepublish.ai/guides/first-30-seconds
- Retention editing: https://air.io/en/youtube-hacks/advanced-retention-editing-cutting-patterns-that-keep-viewers-past-minute-8
- Miniaturas: https://1of10.com/blog/youtube-thumbnail-design/ · https://blog.bananathumbnail.com/thumbnail-psychology-4/
- Miniatura tools gratis: Canva, Photopea, GIMP, YouTube Test & Compare.
- Outliers: YouTube Studio Trends · https://autonolab.com/free-tools/video-outlier-finder · https://outlierkit.com/blog/best-youtube-outlier-finder-tools
- claude-video-vision: https://github.com/jordanrendric/claude-video-vision
