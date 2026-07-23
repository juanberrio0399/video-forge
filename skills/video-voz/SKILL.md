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

## Recursos

- Kokoro comparativa: https://localaimaster.com/blog/kokoro-vs-xtts-vs-chatterbox · Piper: https://github.com/rhasspy/piper
- SSML/menos robotico: https://www.dupdub.com/blog/expressive-tts-ssml-guide · https://voice.ai/hub/tts/how-to-make-text-to-speech-sound-less-robotic/
- Musica/SFX: https://pixabay.com/music/ · https://freesound.org/ · https://mixkit.co/
