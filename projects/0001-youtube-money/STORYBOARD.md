# STORYBOARD — How Much Money Does YouTube Make Every Second?

proyecto: 0001-youtube-money · ~9 min · 1920x1080 · 30 fps · faceless data
Se lee CONTRA la pista de voz (Kokoro). Cada beat cuelga de una frase del SCRIPT.md.

## Sistema visual (consistente en TODO el video)

- **Fondo:** #070b16 con glows radiales cyan/green muy sutiles + grid tenue (64px).
- **Acentos:** cyan #22d3ee (principal), green #34d399 (positivo/creadores),
  amber #fbbf24 (dinero), purple #a78bfa, red #f87171 (Netflix/alerta).
- **Tipografia:** Inter 900 (numeros gigantes), 600 (titulos), 400 (apoyo);
  JetBrains Mono (contadores y cifras).
- **Motion defaults:** entradas `power3.out` 0.6-0.9s, stagger 0.10-0.12s; salidas
  `power2.in`; contadores `power1.out` + snap + tick SFX, sosten 1-2s; camara con
  punch-in/drift lento permanente (nunca estatica >3-4s). Regla del 40% en movimiento.
- **Musica:** bed cinematico -18/-22 LUFS con ducking bajo la voz; beat sube en
  reveals (CH4, CH6). Voz -14 LUFS. Fuentes: YouTube Audio Library / Pixabay CC0.
- **SFX:** tick en cada avance de contador; whoosh en transiciones de capitulo;
  "thunk" grave en el snap de la cifra clave.

Formato de cada beat: `id | t_in-t_out (dur) | escena_tipo | en_pantalla | animacion | foco | dato_clave | sfx/camara`

---

## COLD OPEN (0:00-0:12)

- **B01 | 0:00-0:05 (5s) | contador** | Pantalla casi negra; aparece un contador de
  dinero gigante en mono, subiendo rapido desde $0. | El contador cuenta 0 -> ~$10.000
  en 5s (lineal), escala del contenedor `from scale .96/opacity 0` power3.out 0.5s. |
  el numero | "~$10k en 5s" | tick rapido en loop / punch-in muy lento.
- **B02 | 0:05-0:12 (7s) | kinetic type** | Bajo el contador entra la frase clave
  "$1,900 every second" y luego la pregunta "where does it all go?" | mask-reveal por
  palabra (SplitText), stagger 0.12; la pregunta hace punch de escala. | la frase |
  "$1,900/second" | thunk grave en "$1,900".

## THESIS + STAKES (0:12-0:55)

- **B03 | 0:12-0:22 (10s) | title card** | "YOUTUBE'S MONEY MACHINE" centrado con
  gradiente cyan->green. | title `from y40/scale .94/opacity0` power3.out 0.9s;
  glow pulsa suave. | titulo | tema | whoosh de entrada.
- **B04 | 0:22-0:55 (33s) | mini-mapa de capitulos** | Fila de 5 chips que se iran
  "encendiendo": Per second · Ads · Subscriptions · vs Netflix · Where it goes. El
  ultimo (Where it goes) parpadea/teaser. | chips entran con stagger 0.12 power3.out;
  el chip 5 late (open loop). | los chips | promesa/roadmap | tick por chip.

## CHAPTER 1 — Scaling the number (0:55-2:15)

- **B05 | 0:55-1:05 (10s) | numero gigante** | "$60,000,000,000" aparece y se
  etiqueta "YouTube revenue · 2025". | conteo 0->60B con separadores de miles en cada
  frame, 1.4s power1.out; etiqueta fade+rise despues del snap. | la cifra | $60B/año |
  thunk en el snap / drift.
- **B06 | 1:05-1:25 (20s) | contador escalonado (dia)** | La cifra anual se "divide"
  y baja a "$164,000,000 / day". Texto de apoyo: "more than most companies make in a
  year". | transicion de $60B/yr -> $164M/day con morph de etiqueta; contador reajusta.
  | $/day | $164M/dia | tick + whoosh.
- **B07 | 1:25-1:45 (20s) | barras de escala** | 4 barras/tiles apiladas: HOUR
  $6.85M · MINUTE $114K · SECOND $1,900, revelando de mayor a menor. | tiles entran con
  stagger 0.12, cada contador corre al aparecer; resalta MINUTE con beat extra. | la
  columna | escala hora/min/seg | ticks encadenados.
- **B08 | 1:45-2:15 (30s) | contador en vivo + reloj** | Vuelve el contador por
  segundo, ahora con un reloj/heartbeat que NO para; texto "3AM · holidays · right now".
  | el contador sigue corriendo en loop; pulso sutil sincronizado al tick. | contador |
  "el reloj nunca para" | tick constante / punch-in leve.

## CHAPTER 2 — The ads (2:15-3:45)

- **B09 | 2:15-2:35 (20s) | barra unica** | "$36.4B — Ad revenue 2024" crece desde la
  base. | `scaleY` 0->1 power3.out 0.9s (origin abajo), etiqueta de valor entra al
  llegar. | la barra | $36.4B ads | thunk al tope.
- **B10 | 2:35-3:00 (25s) | barra por trimestres** | 4 barras Q1..Q4 2024; Q4 rompe
  la linea de $10B, resaltada en amber con un "1st time ever". | barras stagger 0.12;
  Q4 hace overshoot + glow; linea de $10B como umbral punteado. | Q4 | Q4 >$10B |
  tick x4 + thunk en Q4.
- **B11 | 3:00-3:45 (45s) | diagrama attention->money** | Icono de "viewer/attention"
  -> flecha -> "$" hacia YouTube; nota "YouTube built the stage, you make the show".
  El "skip in 5s" aparece y se convierte en dinero. | flujo con DrawSVG de la flecha;
  "skip 5s" -> monedas caen. | el flujo | atencion = producto | whoosh + coins SFX.

## CHAPTER 3 — Subscriptions (3:45-5:15)

- **B12 | 3:45-4:05 (20s) | tres columnas** | Premium · Music · YouTube TV entran como
  3 tarjetas. | tarjetas stagger 0.12 power3.out; la de YouTube TV crece mas (teaser).
  | las 3 | los buckets de suscripcion | tick x3.
- **B13 | 4:05-4:40 (35s) | contador multiplicacion** | "10,000,000 subscribers x
  $82.99/mo" y el resultado corre a ">$830,000,000 / month". | dos numeros entran, signo
  x, contador de resultado 0->830M power1.out 1.5s; luego etiqueta "~$10B / year". |
  el resultado | YouTube TV ~$10B/año | thunk en $830M.
- **B14 | 4:40-5:15 (35s) | reveal + CTA interno** | Frase "YouTube secretly sells
  cable" en grande; abajo prompt de comentario "Did you know? Drop a 'no' 👇". | frase
  mask-reveal; el prompt de comentario hace punch al final. | la frase | reveal + CTA |
  whoosh; camara punch-in.

## CHAPTER 4 — Bigger than Netflix (5:15-6:20)

- **B15 | 5:15-5:45 (30s) | comparacion A vs B** | Dos barras: YouTube (cyan) vs
  Netflix (red), etiqueta "total revenue 2025". | ambas crecen en paralelo; YouTube
  ADELANTA a Netflix con overshoot + glow y un marcador "2025". | el cruce | YT > Netflix
  | riser musical + thunk en el cruce.
- **B16 | 5:45-6:20 (35s) | contraste conceptual** | Split: izq "Netflix: studios,
  actors, scripts" / der "YouTube: bedrooms, phones". YouTube gana el tamaño. | iconos
  entran por lados opuestos; el lado YouTube escala al final. | el contraste |
  amateurs > profesionales | whoosh.

## CHAPTER 5 — Re-hook (6:20-6:50)

- **B17 | 6:20-6:50 (30s) | pila que se divide (teaser)** | Una gran pila de dinero
  "Google" crece... y empieza a agrietarse/partirse justo al final (teaser del reparto).
  | pila crece; al segundo ~25 aparece una linea de fractura que insinua el split. | la
  pila | "no se queda en Google" | musica baja/tension; camara acerca.

## CHAPTER 6 — The twist (6:50-8:10)

- **B18 | 6:50-7:20 (30s) | rio de dinero 45/55** | El flujo se divide: 45% -> Google,
  55% -> Creators (green, mas grueso). | split animado del caudal; etiquetas 45%/55%
  cuentan; el lado creadores destaca. | el 55% | 55% a creadores | thunk + coins.
- **B19 | 7:20-7:55 (35s) | numero gigante $100B** | "$100,000,000,000 paid to
  creators (4 years)" con subtexto "artists & media too". | conteo 0->100B 1.8s
  power1.out; separadores; glow green en el snap. | la cifra | $100B en 4 años |
  thunk grave + riser.
- **B20 | 7:55-8:10 (15s) | icon array humano** | Rejilla de iconos "persona + phone"
  que se encienden -> "rent · new camera · full-time job". | iconos se rellenan con
  stagger radial; 3 etiquetas entran. | la rejilla | gente real | ticks suaves.

## SYNTHESIS (8:10-8:45)

- **B21 | 8:10-8:45 (35s) | contador en vivo + 55%** | Vuelve el contador por segundo,
  ahora con un segundo contador "55% -> creators" corriendo al lado; resumen en chips
  (ads · subs · cable · > Netflix · $100B). | dos contadores en paralelo; chips del
  mini-mapa se marcan como "vistos". | contador dual | recap | tick constante.

## CTA + SESSION LOOP (8:45-9:05)

- **B22 | 8:45-9:05 (20s) | end screen** | "Subscribe · new money breakdowns weekly" +
  card del siguiente video "How much does 1M views actually pay?". | subscribe pulsa;
  card del next video entra por la derecha (end screen zone). | el next video | loop de
  sesion | whoosh final; musica resuelve.

---

## Notas de produccion

- **Motor:** HyperFrames (HTML+GSAP) para la mayoria; Remotion como refuerzo si un
  beat necesita React/particulas. Timeline `{paused:true}` + `seek(frame/fps)` (determinista).
- **Contadores:** interpolar valor por posicion de timeline (no Date.now); formatear
  miles en cada frame; snap final + tick SFX.
- **Duracion total objetivo** ~9:05; ajustar micro-holds al medir la voz real.
- **Subtitulos** (Whisper): quemar en el largo opcional; en Shorts SIEMPRE (karaoke).
- **Momentos [SHORT] marcados en el guion** (B01, B07, B14, B15, B19) -> candidatos a
  cortar con video-shorts.
