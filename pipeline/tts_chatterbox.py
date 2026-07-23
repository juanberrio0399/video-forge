#!/usr/bin/env python3
"""
tts_chatterbox.py - Voz en off mas humana con Chatterbox (Resemble AI, MIT, gratis).

Soporta ingles (modelo base) y multilingue (español, etc.) con clonacion de voz
por audio de referencia. Lee un texto plano (un parrafo por bloque) y produce un
WAV. Un paso posterior de ffmpeg lo normaliza a -14 LUFS y lo pasa a MP3.

Uso:
    python pipeline/tts_chatterbox.py <texto.txt> <salida.wav>

Env opcionales:
    CB_LANG          (default en)   - idioma: en, es, pt, fr, ...  (!=en usa multilingue)
    CB_EXAGGERATION  (default 0.5)  - mas alto = mas dramatico/expresivo
    CB_CFG           (default 0.3)  - mas bajo = pacing mas natural/expresivo
    CB_VOICE_PROMPT  (opcional)     - ruta a un WAV de referencia para clonar timbre
"""
import os
import re
import sys
import numpy as np
import torch
import soundfile as sf

GAP = 0.45        # silencio entre parrafos (s)
SENT_GAP = 0.14   # micro-pausa entre oraciones (s) -> ritmo mas natural, menos "IA"


def split_sentences(paragraph: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", paragraph.strip())
    return [p for p in parts if p.strip()]


def load_model(lang: str, device: str):
    """Devuelve (model, gen_fn). gen_fn(sent) -> tensor [1, N]."""
    exaggeration = float(os.environ.get("CB_EXAGGERATION", "0.5"))
    cfg = float(os.environ.get("CB_CFG", "0.3"))
    voice_prompt = os.environ.get("CB_VOICE_PROMPT") or None

    if lang and lang != "en":
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        try:
            model = ChatterboxMultilingualTTS.from_pretrained(device=device, t3_model="v3")
        except TypeError:
            model = ChatterboxMultilingualTTS.from_pretrained(device=device)

        def gen(sent: str):
            kw = {"language_id": lang}
            if voice_prompt:
                kw["audio_prompt_path"] = voice_prompt
            try:
                return model.generate(sent, exaggeration=exaggeration, cfg_weight=cfg, **kw)
            except TypeError:
                return model.generate(sent, **kw)
    else:
        from chatterbox.tts import ChatterboxTTS
        model = ChatterboxTTS.from_pretrained(device=device)

        def gen(sent: str):
            kw = {}
            if voice_prompt:
                kw["audio_prompt_path"] = voice_prompt
            return model.generate(sent, exaggeration=exaggeration, cfg_weight=cfg, **kw)

    return model, gen


def main() -> int:
    if len(sys.argv) < 3:
        print("uso: python tts_chatterbox.py <texto.txt> <salida.wav>")
        return 2

    text_path, out_path = sys.argv[1], sys.argv[2]
    lang = (os.environ.get("CB_LANG") or "en").strip().lower()

    with open(text_path, encoding="utf-8") as fh:
        raw = fh.read()
    paragraphs = [p.strip() for p in raw.split("\n\n") if p.strip()]
    if not paragraphs:
        print("ERROR: texto vacio")
        return 1

    device = "cuda" if torch.cuda.is_available() else "cpu"
    clone = os.environ.get("CB_VOICE_PROMPT") or None
    print(f"Chatterbox: lang={lang} device={device} "
          f"clone={'si' if clone else 'no'} parrafos={len(paragraphs)}")
    model, gen = load_model(lang, device)
    sr = model.sr
    gap = np.zeros(int(GAP * sr), dtype=np.float32)
    sent_gap = np.zeros(int(SENT_GAP * sr), dtype=np.float32)

    parts: list[np.ndarray] = []
    for i, para in enumerate(paragraphs, 1):
        for sent in split_sentences(para):
            wav = gen(sent)  # tensor [1, N]
            parts.append(wav.squeeze(0).cpu().numpy().astype(np.float32))
            parts.append(sent_gap)
        parts.append(gap)
        print(f"  parrafo {i}/{len(paragraphs)} listo")

    full = np.concatenate(parts)
    sf.write(out_path, full, sr)
    dur = len(full) / sr
    print(f"OK: {out_path}  ({dur/60:.2f} min, {dur:.1f} s, sr={sr})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
