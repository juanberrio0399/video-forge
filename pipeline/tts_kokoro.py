#!/usr/bin/env python3
"""
tts_kokoro.py - Genera la voz en off del canal con Kokoro-82M (Apache 2.0, gratis).

Lee un archivo de narracion (texto plano, un parrafo por bloque) y produce un WAV
a 24 kHz. Un paso posterior de ffmpeg lo normaliza a -14 LUFS y lo pasa a MP3.

Uso:
    python pipeline/tts_kokoro.py <narration.txt> <salida.wav> [voz]

Voz por defecto: af_heart (US English, calidad alta). Alternativas: af_bella,
am_michael, bm_george (UK). Ver la skill video-voz.
"""
import sys
import numpy as np
import soundfile as sf
from kokoro import KPipeline

SAMPLE_RATE = 24000
GAP_BETWEEN_PARAGRAPHS = 0.35  # segundos de silencio entre parrafos (respiracion)


def main() -> int:
    if len(sys.argv) < 3:
        print("uso: python tts_kokoro.py <narration.txt> <salida.wav> [voz]")
        return 2

    narration_path = sys.argv[1]
    out_path = sys.argv[2]
    voice = sys.argv[3] if len(sys.argv) > 3 else "af_heart"

    with open(narration_path, encoding="utf-8") as fh:
        raw = fh.read()

    # Un "parrafo" = bloque separado por linea en blanco. Da pausas naturales.
    paragraphs = [p.strip() for p in raw.split("\n\n") if p.strip()]
    if not paragraphs:
        print("ERROR: narracion vacia")
        return 1

    print(f"Kokoro: voz={voice}  parrafos={len(paragraphs)}")
    pipeline = KPipeline(lang_code="a")  # 'a' = American English

    gap = np.zeros(int(GAP_BETWEEN_PARAGRAPHS * SAMPLE_RATE), dtype=np.float32)
    parts: list[np.ndarray] = []

    for i, para in enumerate(paragraphs, 1):
        seg_count = 0
        for _gs, _ps, audio in pipeline(para, voice=voice, speed=1.0):
            parts.append(np.asarray(audio, dtype=np.float32))
            seg_count += 1
        parts.append(gap)
        print(f"  parrafo {i}/{len(paragraphs)} -> {seg_count} segmento(s)")

    full = np.concatenate(parts)
    sf.write(out_path, full, SAMPLE_RATE)
    dur = len(full) / SAMPLE_RATE
    print(f"OK: {out_path}  ({dur/60:.2f} min, {dur:.1f} s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
