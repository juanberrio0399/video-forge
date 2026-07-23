#!/usr/bin/env python3
"""
tts_chatterbox_directed.py - Voz DIRIGIDA por beat con Chatterbox.

En vez de leer todo con la misma energia (lo que delata al TTS), cada beat se
genera como su propio clip con su expresividad, ritmo y pausas, y se concatenan
con silencios. Asi el hook va energico, hay pausa dramatica antes del numero,
el reveal sube, etc. Ver la skill video-voz.

Entrada: un mapa de voz JSON:
{
  "lang": "en",
  "voice_ref": "assets/voice/ref_juan_es.mp3",
  "defaults": { "exaggeration": 0.5, "cfg": 0.4, "pause_after": 0.25 },
  "beats": [
    { "text": "...", "tipo": "hook", "exaggeration": 0.70, "cfg": 0.58,
      "pause_before": 0.0, "pause_after": 0.35 },
    ...
  ]
}

Uso:
    python pipeline/tts_chatterbox_directed.py <voicemap.json> <salida.wav>
"""
import json
import re
import sys
import numpy as np
import torch
import soundfile as sf


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p.strip()]


def main() -> int:
    if len(sys.argv) < 3:
        print("uso: python tts_chatterbox_directed.py <voicemap.json> <salida.wav>")
        return 2

    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    out_path = sys.argv[2]
    lang = (spec.get("lang") or "en").strip().lower()
    voice_ref = spec.get("voice_ref") or None
    defaults = spec.get("defaults", {})
    beats = spec.get("beats", [])
    if not beats:
        print("ERROR: mapa sin beats")
        return 1

    # Modo "pedazo": genera solo una rebanada contigua de beats, para correr en
    # paralelo. Uso: ... <out.wav> <chunk_index> <num_chunks>
    if len(sys.argv) >= 5:
        import math
        ci, nc = int(sys.argv[3]), int(sys.argv[4])
        size = math.ceil(len(beats) / nc)
        beats = beats[ci * size:(ci + 1) * size]
        print(f"CHUNK {ci + 1}/{nc}: {len(beats)} beats de este pedazo")
        if not beats:
            # pedazo vacio (menos beats que chunks): escribe un wav de silencio corto.
            sf.write(out_path, np.zeros(int(0.05 * 24000), dtype=np.float32), 24000)
            print("pedazo vacio -> silencio")
            return 0

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Directed: lang={lang} device={device} beats={len(beats)} "
          f"clone={'si' if voice_ref else 'no'}")

    if lang != "en":
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        try:
            model = ChatterboxMultilingualTTS.from_pretrained(device=device, t3_model="v3")
        except TypeError:
            model = ChatterboxMultilingualTTS.from_pretrained(device=device)
        multilingual = True
    else:
        from chatterbox.tts import ChatterboxTTS
        model = ChatterboxTTS.from_pretrained(device=device)
        multilingual = False
    sr = model.sr

    def gen(text: str, exaggeration: float, cfg: float):
        kw = {"exaggeration": exaggeration, "cfg_weight": cfg}
        if voice_ref:
            kw["audio_prompt_path"] = voice_ref
        if multilingual:
            kw["language_id"] = lang
        try:
            return model.generate(text, **kw)
        except TypeError:
            kw.pop("exaggeration", None)
            kw.pop("cfg_weight", None)
            return model.generate(text, **kw)

    def silence(sec: float) -> np.ndarray:
        return np.zeros(int(max(0.0, sec) * sr), dtype=np.float32)

    parts: list[np.ndarray] = []
    for i, beat in enumerate(beats, 1):
        text = (beat.get("text") or "").strip()
        if not text:
            continue
        exaggeration = float(beat.get("exaggeration", defaults.get("exaggeration", 0.5)))
        cfg = float(beat.get("cfg", defaults.get("cfg", 0.4)))
        pause_before = float(beat.get("pause_before", 0.0))
        pause_after = float(beat.get("pause_after", defaults.get("pause_after", 0.25)))

        parts.append(silence(pause_before))
        # una oracion por clip -> el modelo se mantiene estable
        for sent in split_sentences(text):
            wav = gen(sent, exaggeration, cfg)
            parts.append(wav.squeeze(0).cpu().numpy().astype(np.float32))
            parts.append(silence(0.12))
        parts.append(silence(pause_after))
        print(f"  beat {i}/{len(beats)} [{beat.get('tipo','-')}] "
              f"ex={exaggeration} cfg={cfg} listo")

    full = np.concatenate(parts)
    sf.write(out_path, full, sr)
    dur = len(full) / sr
    print(f"OK: {out_path}  ({dur/60:.2f} min, {dur:.1f} s, sr={sr})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
