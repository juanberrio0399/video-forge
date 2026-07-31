# kokoro_sample.py — genera un EJEMPLO corto de una voz Kokoro (para el selector del bot).
# Uso: python pipeline/kokoro_sample.py <voz> <salida.wav>
import sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

voice, out = sys.argv[1], sys.argv[2]
text = "This is The Data Lens. Here is how much money that really makes."
k = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
samples, sr = k.create(text, voice=voice, speed=1.0, lang="en-us")
sf.write(out, np.asarray(samples, dtype=np.float32), sr, subtype="PCM_16")
print("sample:", voice, "->", out)
