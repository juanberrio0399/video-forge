---
name: video-voz
description: Genera la voz en off (TTS gratis, calidad narracion) y la mezcla de audio del video del canal faceless. Usar en la produccion para convertir el guion en voiceover y mezclarlo con musica/SFX libres de copyright. Motor por defecto Kokoro (Apache 2.0); Piper de respaldo. Entrega el audio narrado normalizado a -14 LUFS.
---

# video-voz

Productor de audio del canal. Conviertes el guion en voz en off natural con TTS
GRATIS y de licencia segura, y lo mezclas con musica/SFX libres de copyright,
normalizado al estandar de YouTube.

## Motor TTS — decision (validada 2025-2026)

| Opcion | Calidad | Voces EN | Headless/CI | Licencia comercial | Veredicto |
|---|---|---|---|---|---|
| **Kokoro-82M** | Muy alta (#1 TTS Arena) | af_heart, af_bella, am_michael, bm_george | Si, CPU, offline | **Apache 2.0 (libre)** | **DEFAULT** |
| **Piper** | Media-alta | en_US-lessac, en_US-ryan, en_GB-alba | Si, rapidisima CPU, offline | **MIT (libre)** | **Respaldo** |
| edge-tts | Alta | AriaNeural, GuyNeural | Si, pero **necesita red** | **Zona gris: Microsoft NO autoriza comercial** | Solo prototipo |
| Coqui/XTTS v2 | Muy alta + clon | cualquiera | Pesado (GPU) | **CPML: NO comercial** | **PROHIBIDO** |

**Regla:** default **Kokoro** (calidad top, Apache 2.0, corre en CPU en GitHub
Actions, sin costo ni riesgo). Respaldo **Piper**. **Nunca** XTTS/Coqui en contenido
monetizado. **Evita** edge-tts para el canal (licencia + dependencia de red); solo
para prototipos rapidos.

## Narracion (que no suene robotica)

- **Ritmo 140-160 WPM**; para datos, 140-150. Baja + pausa justo en la cifra clave.
- Escribe conversacional: contracciones ("it's", "you'll"), frases cortas, una idea
  por oracion. La puntuacion es tu primer control de pausas.
- **SSML** donde el motor lo soporte: `<break time="0.4s"/>` entre frases, ~0.8 s
  entre secciones (no >3-4 seguidos). `<emphasis>` en la palabra del dato.
- **Pausa antes del numero clave** para que aterrice; micro-pausa despues.
- Un solo locutor por video; varia pitch/velocidad leve entre secciones.
- Kokoro/Piper controlan pausas por puntuacion; edge-tts/Azure aceptan SSML completo.

## Mezcla de audio

- **Loudness objetivo: -14 LUFS** integrado (estandar YouTube). True-peak <= -1 dBTP.
  Normaliza con `ffmpeg loudnorm` (I=-14) o Audacity.
- **Ducking:** musica a **-18 a -22 LUFS** bajo la voz; sidechain/auto-duck baja
  ~6-10 dB cuando habla el locutor.
- Voz al frente; musica solo ambienta; SFX cortos para transiciones/reveals.
- Limpia la voz TTS: high-pass ~80 Hz + compresion leve.

## Musica / SFX GRATIS (sin riesgo Content ID)

| Fuente | Que | Licencia |
|---|---|---|
| **YouTube Audio Library** (en Studio) | Musica + SFX | La mas segura en YouTube; algunas piden credito |
| **Pixabay Music / SFX** | Musica + SFX | Libre comercial, sin atribucion (DEFAULT) |
| **Freesound** | SFX/loops | Filtrar **CC0** (sin atribucion); evitar Noncommercial |
| **Mixkit** | Musica + SFX | Libre comercial, sin atribucion |
| Uppbeat / NCS / Bensound | Musica | Gratis pero exigen credito |

Regla: para monetizado usa **YouTube Audio Library + Pixabay (CC0)** -> cero riesgo.

## Direccion de voz por BEAT (que no suene plano / a IA)

El error #1 que delata a un TTS es leer TODO con la misma energia y ritmo. La
solucion: **cada beat se genera como su propio clip** con su energia, ritmo y
pausas, y se concatenan con silencios. Flujo:
**guion -> mapa de voz por beat (JSON) -> un clip Chatterbox por beat -> concatenar
con silencios -> atempo global de ajuste fino.**

### Mapa por momento (pace / energia / pausa)

| Momento | WPM | Energia (1-5) | Pausa | Tono |
|---|---|---|---|---|
| Hook (0-12s) | 160-180 | 5 | corta antes del gancho | rapido, curioso, promesa arriba |
| Contexto/setup | 140-150 | 3 | fin de frase | conversacional, calido |
| Dato complejo | 120-140 | 3 | media antes de definir | lento, articulado, autoridad |
| Numero clave | 130 con freno | 4 | **dramatica ANTES (~500ms)** | enfatiza la cifra, baja al final |
| Reveal/climax | 150-165 | 5 | silencio antes, energia despues | pico de expresividad |
| Sintesis | 130-140 | 3 | media entre ideas | reflexivo |
| CTA | 145-160 | 4 | corta antes del pedido | directo, calido, cierre descendente |

Bandas: general 130-145 WPM, entretenimiento 140-150, alta energia 170+, techo de
comprension ~190 WPM.

### Traduccion a parametros Chatterbox

Energia -> `exaggeration`: 1=0.30-0.40 · 2=0.40-0.45 · 3(base)=0.45-0.55 ·
4=0.60-0.68 · 5(pico)=0.70-0.80.
Pace -> `cfg_weight` (+ atempo global): muy_lento=0.30-0.35 (atempo 0.92-0.95) ·
lento=0.35-0.45 · medio=0.50 (1.0) · rapido=0.55-0.60 (1.02-1.05) ·
muy_rapido=0.60-0.65 (1.05-1.08).

Combinaciones clave:
- **Reveal:** exaggeration ~0.72 + cfg ~0.32 (emotivo pero no atropellado).
- **Dato complejo:** exaggeration ~0.40 + cfg ~0.33 + atempo 0.94 (lento y claro).
- **Hook:** exaggeration ~0.70 + cfg ~0.58 (energico y agil).
- **NUNCA** exaggeration alto Y cfg alto a la vez: se acelera y se traga palabras.

### Reglas de locucion

1. Rapido en el hook (~10-15% mas que el cuerpo), energia 5.
2. **Pausa dramatica ANTES del numero/reveal, no despues** (~500ms).
3. Baja el ritmo al explicar lo complejo; subelo en ejemplos/accion.
4. Sube energia en el reveal (contraste = climax).
5. Enfatiza SOLO 1-2 palabras clave por frase (jerarquia).
6. Varia el ritmo cada 20-40s; cierra cada bloque con micro-pregunta abierta.
7. Entonacion DESCENDENTE al final de afirmaciones (autoridad, no up-talk).
8. Calidez > hype: entusiasmo genuino, no griteria.
9. Frases <22 palabras (el TTS respira mal en frases largas). Lee el guion en voz
   alta: si tropiezas tu, tropieza el TTS.

### Pausas (Chatterbox no soporta SSML break)

- Micro 200-300ms = coma. Media 400-500ms = guion largo (—) o punto y aparte.
- Dramatica 600-900ms = **partir el clip e insertar silencio** (pausa_antes_ms).
- Enfasis de palabra: aislar la frase del reveal como su propio clip con
  exaggeration +0.1, y coma-pausa antes de la palabra clave.

### Formato del mapa de voz (JSON por beat)

`{ text, tipo, exaggeration, cfg, pause_before, pause_after, enfasis[] }` — lo
consume `pipeline/tts_chatterbox_directed.py`, que genera un clip por beat con sus
params y concatena con los silencios. Ajuste fino global con `atempo` en el workflow.

## Recursos

- Config Chatterbox (exaggeration/cfg): https://yocxy2-chatterboxyocxy.mintlify.app/guides/configuration · Extended (chunks/silencios): https://github.com/petermg/Chatterbox-TTS-Extended
- Voz IA de alta retencion (WPM, pausas): https://narrationbox.com/blog/ai-voices-for-high-retention-youtube-videos-2025
- Narracion documental (pausa, enfasis, autoridad): https://voicebros.com/en/blog/documentary-narration-techniques
- Velocidad de habla y persuasion/memoria: https://tctecinnovation.com/blogs/daily-blog/how-your-speaking-speed-affects-what-people-remember
- Kokoro comparativa: https://localaimaster.com/blog/kokoro-vs-xtts-vs-chatterbox · Piper: https://github.com/rhasspy/piper
- SSML/menos robotico: https://www.dupdub.com/blog/expressive-tts-ssml-guide · https://voice.ai/hub/tts/how-to-make-text-to-speech-sound-less-robotic/
- Musica/SFX: https://pixabay.com/music/ · https://freesound.org/ · https://mixkit.co/
