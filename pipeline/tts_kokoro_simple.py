# tts_kokoro_simple.py — narra un TEXTO plano con Kokoro TTS (open source, GRATIS y SIN CUOTA).
# Reemplaza a Gemini TTS para el short de espacio: no depende de cuota diaria y da voz calmada.
# Parte el texto en frases, narra cada una (voz calmada, ritmo lento), mete pausas suaves y exporta mp3.
#
# Uso: python pipeline/tts_kokoro_simple.py <texto.txt> <salida.mp3> [speed]
# Env: KVOICE (voz Kokoro, default af_heart = cálida). Requiere kokoro-v1.0.onnx + voices-v1.0.bin en cwd.
import sys, os, re
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

text_file = sys.argv[1]
out_mp3 = sys.argv[2]
speed = float(sys.argv[3]) if len(sys.argv) > 3 else 0.90  # <1.0 = más lento/calmado (sueño)
voice = os.environ.get("KVOICE", "af_heart")

text = open(text_file, encoding="utf-8").read().strip()
text = re.sub(r"\.\.\.+", ".", text)                       # quitar marcadores de pausa "..."
text = re.sub(r"[ \t]+", " ", text)
sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
if not sents:
    print("texto vacío"); sys.exit(1)
print(f"Kokoro TTS · voz {voice} · speed {speed} · {len(sents)} frases")

kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
SR = 24000
parts = []
for i, s in enumerate(sents):
    samples = None
    for attempt in range(3):  # un fallo transitorio no debe dejar un hueco mudo
        try:
            samples, sr = kokoro.create(s, voice=voice, speed=speed, lang="en-us")
            break
        except Exception as e:
            print(f"  frase {i} intento {attempt+1} falló -> {e}")
            samples = None
    if samples is None:
        continue
    parts.append(np.asarray(samples, dtype=np.float32))
    parts.append(np.zeros(int(SR * 0.38), dtype=np.float32))  # pausa suave entre frases (sueño)

if not parts:
    print("Kokoro no produjo audio"); sys.exit(1)
audio = np.concatenate(parts)
sf.write("kok_raw.wav", audio, SR)
# loudnorm calmado + a mp3
rc = os.system(f'ffmpeg -y -i kok_raw.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a libmp3lame -b:a 192k "{out_mp3}"')
if rc != 0 or not os.path.exists(out_mp3):
    print("ffmpeg falló al exportar mp3"); sys.exit(1)
print("audio ->", out_mp3)
