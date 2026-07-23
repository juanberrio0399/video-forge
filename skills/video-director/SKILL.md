---
name: video-director
description: Convierte un guion (SCRIPT.md) en un STORYBOARD segundo a segundo para video de datos faceless — que se ve y que se anima en cada beat, "como pelicula". Usar SIEMPRE despues del guionista y antes de construir la composicion (HyperFrames/Remotion). Entrega STORYBOARD.md con beats, tipo de escena, animacion y sync a la voz.
---

# video-director

Director de arte + motion designer del canal. Tomas el guion y su pista de voz y
produces un **storyboard segundo a segundo**: cada beat dice que se VE, que se
MUEVE y como, sincronizado con la narracion. La animacion es lo ULTIMO; primero
decides que idea unica entrega cada segundo.

Orden de trabajo: **guion -> pista de voz (timing real) -> beats -> storyboard -> animacion.**

## Reglas de direccion/motion (validadas 2025-2026)

1. **Un beat = una idea.** Cada escena entrega UN mensaje visual. No compitas
   texto + narracion + animacion compleja a la vez.
2. **Motion con funcion:** toda animacion debe *revelar, enfatizar, etiquetar o
   transicionar*. Si no informa, distrae (es lo que separa pro de amateur).
3. **Regla del ~40%:** nunca muevas mas del 40% de los elementos a la vez, o el
   espectador deja de entender los datos.
4. **Entradas escalonadas (stagger 60-120 ms),** no todo de golpe: crea jerarquia
   temporal y sensacion coreografiada.
5. **Easing siempre, lineal casi nunca.** Entradas `power2/3.out`, salidas `.in`,
   continuo `.inOut`. El lineal SOLO para interpolar valores de datos.
6. **Pattern interrupt cada 30-60 s:** b-roll, punch-in, pop de texto, cambio de
   grafico o de musica. Aplana las caidas de retencion.
7. **La camara nunca duerme:** punch-ins sutiles, zoom lento, drift, aunque el
   plano sea estatico. Estatica >3-4 s en faceless mata la retencion.
8. **Ritmo de corte al servicio del guion:** rapido en hook y climax; lento donde
   hay que procesar una cifra. Sincroniza cortes con voz y beats de musica.
9. **Numeros que aterrizan:** contador/cifra clave llega con snap + tick de sonido
   y se sostiene 1-2 s antes de salir. El dato debe leerse y sentirse.
10. **Jerarquia visual explicita** por tamaño, color y peso (Gestalt). Sin
    jerarquia el frame se ve plano.
11. **No engañar:** ejes desde cero, escalas honestas, animar solo lo que
    representa datos reales. La credibilidad es el activo del canal.
12. **Elimina clutter:** sin rejillas pesadas, sombras, bordes, 3+ fuentes. El
    minimalismo es lo que se ve "caro".
13. **Consistencia de sistema:** misma paleta, tipografia, timing y transiciones
    en TODO el video. El "look" es un sistema, no adornos sueltos.
14. **Motion sincronizado a la voz/beat:** las palabras clave se animan al ritmo
    de la narracion. El sync audio-visual multiplica el impacto.

## Formato de STORYBOARD (campos por beat, unidad 2-8 s)

`beat_id` · `t_in/t_out` · `dur` · `voz_off` (linea exacta que suena) ·
`escena_tipo` (del catalogo) · `en_pantalla` (que se ve + texto) ·
`animacion` (elemento -> propiedad -> from/to -> ease -> dur -> stagger) ·
`entrada/salida` · `foco_visual` · `dato_clave` · `sfx/musica` · `camara` ·
`nota_produccion` (fuente del dato, asset, riesgo).

El storyboard se escribe **contra la pista de voz**: cada beat cuelga de una frase.

## Catalogo de escenas de datos (como animar cada una)

- **Contador / numero que sube:** interpola valor lineal 0->N en 0.8-1.5 s, escala
  del contenedor con ease-out, formatea miles en cada frame, termina con snap +
  tick, sosten 1-2 s.
- **Barras que crecen:** `scaleY`/height desde la base (transform-origin abajo),
  ease-out, stagger 80-120 ms; etiquetas de valor entran DESPUES de llegar la
  barra; eje desde cero.
- **Bar chart race:** valores lineales, reordena posiciones con FLIP (deslizan, no
  saltan), contador de fecha en esquina, max 8-12 barras.
- **Lineas / series temporales:** traza con DrawSVG (stroke-dashoffset) L->R 1.5-3 s
  sync a la voz; marcador en la punta; callouts al llegar.
- **Mapa:** zoom/pan suave a la region, puntos con stagger radial, color = magnitud
  (choropleth) con leyenda que se construye sola, arcos con DrawSVG.
- **Comparacion A vs B:** entran desde lados opuestos en paralelo; beat extra
  destaca al "ganador" (escala/color) tras el empate visual.
- **Proporcion (dona/waffle/treemap):** barrido de arco o llenado con stagger, %
  central contando en paralelo, max 4-5 categorias (resto = "otros").
- **Timeline:** eje se dibuja, hitos entran uno por frase con punch-in, cabeza
  lectora avanza.
- **Diagrama de flujo/sistema:** nodos en orden causal, conectores DrawSVG en la
  direccion del flujo, resalta el camino activo mientras la voz lo describe.
- **Kinetic typography:** palabra clave grande con mask-reveal (SplitText), punch
  de escala, sync por silaba con la voz.
- **Icon array / pictograma:** rejilla que se rellena con stagger para "N de cada M".

## Render con codigo — GSAP seek-safe (determinista)

- Timeline con `{ paused: true }`. En cada frame `tl.seek(frame / fps)`. NUNCA el
  ticker en tiempo real (corre a wall-clock y desincroniza el render batch).
- Interpola valores con la posicion de la timeline (o `interpolate()` en Remotion).
  Nada de `Date.now()` ni `Math.random()` sin seed.
- Evita eases no reproducibles (`RoughEase`, `CustomWiggle` sin seed); usa
  `power/expo/back` (funciones puras del progreso).
- `SplitText` (reveal por char/word), `DrawSVG` (lineas/mapas), `MorphSVG` (formas)
  son ideales: dependen solo del progreso => determinan igual cada frame.
- Aplica en HyperFrames (HTML+GSAP, timeline en `window.__timelines`) y Remotion.

## Errores que se ven amateur

- Todo entra a la vez sin stagger. Lineal en todo (robotico). >40% en movimiento.
- Ejes que no arrancan en cero. Cifras que pasan sin sostenerse ni sonorizarse.
- Demasiado texto compitiendo con la voz. Transiciones genericas sin sync.
- Clutter (rejillas, sombras, 3+ fuentes). Paleta incoherente. Camara estatica 8 s.
- Animar "por animar". Timing uniforme sin acelerar el hook ni respirar en los datos.

## Recursos GRATIS

- GSAP Eases (visualizador): https://gsap.com/docs/v3/Eases/ · Timeline: https://gsap.com/docs/v3/GSAP/Timeline/
- HyperFrames vs Remotion (por que GSAP pausado+seek es determinista): https://hyperframes.heygen.com/guides/hyperframes-vs-remotion
- Dataviz en motion: https://www.numberanalytics.com/blog/data-visualization-in-motion-graphics
- Limites perceptivos (regla 40%, slow-in): https://link.springer.com/article/10.1186/s41235-026-00724-y
- Retention editing: https://pixflow.net/blog/youtube-video-retention-editing/
- Kinetic typography: https://www.digitalsilk.com/web-design/web-trends/kinetic-typography/
- Storytelling with Data (6 principios): https://medium.com/analytics-vidhya/key-points-from-the-book-storytelling-with-data-by-cole-nussbaumer-knaflic-8c0a7b08960
- Prototipar: Flourish bar chart race https://flourish.studio/visualisations/bar-chart-race/ · The Pudding https://pudding.cool
- Deconstruir el "look": Wendover, PolyMatter, Half as Interesting, Vox.
