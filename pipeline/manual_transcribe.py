# manual_transcribe.py — transcribe un clip a TEXTO PLANO (insumo del SEO).
# Uso: python pipeline/manual_transcribe.py <video> [out.txt]
# Si el clip no tiene dialogo, deja el archivo vacio (el SEO usa la pista/caption).
import sys

from faster_whisper import WhisperModel

video = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "transcript.txt"

model = WhisperModel("base", device="cpu", compute_type="int8")
segments, info = model.transcribe(video)
texto = " ".join(s.text.strip() for s in segments).strip()

with open(out, "w", encoding="utf-8") as f:
    f.write(texto)

print(f"idioma={info.language} chars={len(texto)}")
