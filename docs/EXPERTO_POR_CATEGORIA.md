# Ser experto en CADA categoría (no solo ASMR)

Regla de Juan: al trabajar una categoría se investiga **todo, al máximo**, igual que ASMR.
Ninguna categoría se da por lista con lo "básico". Este es el proceso repetible.

## Proceso de onboarding de una categoría (cada vez)

1. **Investigar a fondo** (WebSearch/WebFetch): qué hace virales a los mejores canales
   faceless de ese nicho — ganchos, ritmo, estructura, lenguaje visual, diseño de sonido,
   tácticas de retención, títulos/SEO. Anotar los hallazgos con fuente.
2. **Lenguaje visual**: lista rica de queries de stock (≥20) que capturen el nicho.
3. **Identidad de sonido** (biblioteca CC0): paleta (cama+acentos) para nichos de sonido, o
   cama atmosférica + stingers para nichos narrados. Reconstruir la biblioteca.
4. **Guion experto**: estilo del nicho + reglas de retención en el prompt del guionista.
5. **Producir demo privado**, escuchar/ver, **afinar** (volúmenes, stingers, ritmo) y repetir.
6. **Documentar** aquí lo aprendido del nicho.

## Pensar y editar como EDITOR CINEMATOGRÁFICO (todo, siempre)

Toda la producción (guion + ensamblaje) piensa como un editor de cine pro:
- **Arco emocional**: calma → tensión → clímax → resolución. Cada beat prepara el siguiente (transiciones motivadas).
- **Ritmo**: varía la duración de los planos y el largo de las frases; pausas/silencio antes de un momento fuerte; corta con el sonido.
- **Planos**: variedad (general → detalle → macro), tomas con movimiento y textura (cámara lenta, macro, dron), nunca estáticas ni genéricas. Contraste visual entre beats consecutivos.
- **Color (look fílmico)**: viñeta suave + micro-contraste + grano sutil; frío/dramático en narrativas, limpio y nítido en satisfying/naturaleza. En `build_compilation.mjs` (mapa `CINE` por nicho) y viñeta sutil en el render del canal principal.
- **Sonido**: diseño por nicho (paletas ASMR / cama+stingers), silencio estratégico, risers hacia los reveals.

Está encodado en los prompts (`compilation_script.mjs` EXPERT_RULES · `video_script.mjs`) y en el grade del ensamblador.

## Reglas de retención (todo guion narrado)

- **Primeros 2 s**: pattern interrupt / brecha de curiosidad / algo contraintuitivo. Nunca "in this video".
- Frases **cortas y rítmicas**, aptas para voz. Cero relleno.
- **Re-gancho a la mitad**: un cambio (revelación, ejemplo, giro) donde cae la audiencia.
- **Final fuerte**: giro, remate o CTA de 3 palabras (el final decide shares y completion).
- Pensar **3 ganchos** y elegir el mejor.
- **Captions palabra-por-palabra** (una palabra a la vez) suben retención — *mejora pendiente en el ensamblador*.

## Lo aprendido por categoría

### Narrativas (historia / traición-venganza)
- Gancho de intriga en 2 s; narración **tensa y ajustada**; cada beat **sube la apuesta**; **final con vuelta de tuerca**.
- Sonido: **drone** (desasosiego sostenido) + **riser** (algo se acerca) + **stinger** (golpe seco en el reveal) + **silencio estratégico** + motivo recurrente.
- Ya implementado: cama dark-ambient baja + stingers (impacto/riser/boom) en beats de reveal.

### Ciencia + humor (chistosos)
- Estructura de **chiste**: montaje serio/predecible → **giro absurdo** = punchline. **Timing**: pausa antes del remate.
- **Relatable/observacional**, no forzado. Ágil y punchy; en shorts, rapid-fire.
- La risa es la emoción **más compartible**.
- Ya implementado: stingers (ding/whoosh/pop) al soltar cada dato.

### Satisfying / ASMR
- El SONIDO y el VISUAL mandan; mezcla profesional por paletas (cama + acentos que combinan), loudnorm −14 LUFS.

### Naturaleza / relax
- Ritmo lento, imagen bella + dato; paleta bosque/océano/lluvia.

## Fuentes (investigación 2026-08-08)
- Retención/ganchos faceless: virvid.ai, fluxnote.io, flarecut.com
- Reddit/story pacing y captions: ghostshorts.com, brainrotshorts.com
- Diseño de sonido dramático (drone/riser/stinger): epidemicsound.com, add.app
- Comedia (setup→punchline, absurdo, relatable): revid.ai, filmora, flowshorts.app
