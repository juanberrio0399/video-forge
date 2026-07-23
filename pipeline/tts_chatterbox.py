#!/usr/bin/env python3
"""
tts_chatterbox.py - Voz en off mas humana con Chatterbox (Resemble AI, MIT, gratis).

Chatterbox tiene control de expresividad (exaggeration) y mejor pacing que Kokoro.
Lee un texto plano (un parrafo por bloque) y produce un WAV. Un paso posterior de
ffmpeg lo normaliza a -14 LUFS y lo pasa a MP3.

Uso:
    python pipeline/tts_chatterbox.py <texto.txt> <salida.wav>

Env opcionales:
    CB_EXAGGERATION  (default 0.6)  - mas alto = mas dramatico/expresivo
    CB_CFG           (default 0.3)  - mas bajo = pacing mas natural/expresivo
    CB_VOICE_PROMPT  (opcional)     - ruta a un WAV de 5-10s para clonar timbre
"""
import os
import re
import sys
import numpy as np
import torch
import soundfile as sf
from chatterbox.tts import ChatterboxTTS

GAP = 0.35  # silencio entre parrafos (s)


def split_sentences(paragraph: str) -> list[str]:
    # Chatterbox rinde mejor por oracion; corta en . ! ? manteniendo signos.
    parts = re.split(r"(?<=[.!?])\s+", paragraph.strip())
    return [p for p in parts if p.strip()]


def main() -> int:
    if len(sys.argv) < 3:
        print("uso: python tts_chatterbox.py <texto.txt> <salida.wav>")
        return 2

    text_path, out_path = sys.argv[1], sys.argv[2]
    exaggeration = float(os.environ.get("CB_EXAGGERATION", "0.6"))
    cfg = float(os.environ.get("CB_CFG", "0.3"))
    voice_prompt = os.environ.get("CB_VOICE_PROMPT") or None

    with open(text_path, encoding="utf-8") as fh:
        raw = fh.read()
    paragraphs = [p.strip() for p in raw.split("\n\n") if p.strip()]
    if not paragraphs:
        print("ERROR: texto vacio")
        return 1

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Chatterbox: device={device} exaggeration={exaggeration} cfg={cfg} "
          f"clone={'si' if voice_prompt else 'no'} parrafos={len(paragraphs)}")
    model = ChatterboxTTS.from_pretrained(device=device)
    sr = model.sr
    gap = np.zeros(int(GAP * sr), dtype=np.float32)

    kwargs = {"exaggeration": exaggeration, "cfg_weight": cfg}
    if voice_prompt:
        kwargs["audio_prompt_path"] = voice_prompt

    parts: list[np.ndarray] = []
    for i, para in enumerate(paragraphs, 1):
        for sent in split_sentences(para):
            wav = model.generate(sent, **kwargs)          # tensor [1, N]
            parts.append(wav.squeeze(0).cpu().numpy().astype(np.float32))
        parts.append(gap)
        print(f"  parrafo {i}/{len(paragraphs)} listo")

    full = np.concatenate(parts)
    sf.write(out_path, full, sr)
    dur = len(full) / sr
    print(f"OK: {out_path}  ({dur/60:.2f} min, {dur:.1f} s, sr={sr})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
