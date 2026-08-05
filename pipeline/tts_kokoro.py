# tts_kokoro.py — narra el video con Kokoro TTS (open source, gratis, sin cuota) como
# RESPALDO de Gemini. Produce el MISMO formato que tts_gemini_directed.mjs: un WAV por
# pedazo + <out>.timing.json con {sr, beats:[{index,tipo,text,dur}]}, para que la union
# y el render funcionen igual. Corre por PEDAZOS (como el pipeline de Gemini).
#
# Uso: python pipeline/tts_kokoro.py <voicemap.json> <out.wav> <chunkIndex> <numChunks>
# Env: KVOICE (voz Kokoro, default am_michael). Modelos: kokoro-v1.0.onnx + voices-v1.0.bin.
import json, sys, os, math
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

map_path, out_wav, ci, nc = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
voice = os.environ.get("KVOICE", "am_michael")
spec = json.load(open(map_path, encoding="utf-8"))
beats = spec.get("beats", spec) if isinstance(spec, dict) else spec
size = max(1, math.ceil(len(beats) / nc))
offset = ci * size
chunk = beats[offset:offset + size]
print(f"CHUNK {ci+1}/{nc}: {len(chunk)} beats (offset {offset}), voz Kokoro {voice}")

kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
SR = 24000
parts, timings = [], []
for i, b in enumerate(chunk):
    text = (b.get("text") or "").strip()
    if not text:
        continue
    samples, sr = None, SR
    for attempt in range(3):  # reintenta el beat: un fallo transitorio no debe dejar un hueco mudo
        try:
            samples, sr = kokoro.create(text, voice=voice, speed=1.0, lang="en-us")
            break
        except Exception as e:
            print("Kokoro fallo beat", offset + i, "intento", attempt + 1, "->", e)
            samples = None
    if samples is None:  # ultimo recurso: silencio corto (no esconde el fallo, pero no rompe la union)
        samples, sr = np.zeros(SR, dtype=np.float32), SR
    pause = int(round(float(b.get("pause_after", 0.25)) * sr))
    seg = np.concatenate([np.asarray(samples, dtype=np.float32), np.zeros(pause, dtype=np.float32)])
    parts.append(seg)
    dur = len(seg) / sr
    timings.append({"index": offset + i, "tipo": b.get("tipo", "-"), "text": text, "dur": round(dur, 3)})
    print(f"  beat {offset+i} [{b.get('tipo','-')}] -> {dur:.2f}s")

full = np.concatenate(parts) if parts else np.zeros(int(0.05 * SR), dtype=np.float32)
sf.write(out_wav, full, SR, subtype="PCM_16")
json.dump({"sr": SR, "beats": timings}, open(out_wav + ".timing.json", "w"))
print(f"OK chunk {ci}: {len(timings)} beats -> {out_wav}")
