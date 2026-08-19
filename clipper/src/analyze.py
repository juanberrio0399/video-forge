"""Paso 2 — Analisis: transcribe (faster-whisper, device auto) + la IA (Gemini) elige los mejores momentos.

Devuelve: segments con timestamps por PALABRA (para subtitulos karaoke) + los mejores clips 9:16.
"""
import json
import os

import google.generativeai as genai


def transcribir(video_path: str, hw: dict, idioma: str = "en") -> dict:
    """faster-whisper con el device/modelo que decidio detect_hardware."""
    from faster_whisper import WhisperModel
    model = WhisperModel(hw["whisper_model"], device=hw["device"], compute_type=hw["compute_type"])
    segments, info = model.transcribe(video_path, language=idioma, word_timestamps=True)
    words, texto = [], []
    for seg in segments:
        for w in (seg.words or []):
            words.append({"t0": round(w.start, 2), "t1": round(w.end, 2), "w": w.word.strip()})
        texto.append(seg.text.strip())
    return {"words": words, "texto": " ".join(texto), "duracion": round(info.duration, 1)}


def _prompt(texto: str, duracion: float, n: int, dmin: int, dmax: int) -> str:
    return (
        "Eres editor de Shorts virales. Te doy la TRANSCRIPCION de un video largo con sus tiempos. "
        f"Elige los {n} MEJORES momentos para un Short vertical (9:16), cada uno de {dmin} a {dmax} segundos, "
        "que enganchen en 2s (gancho/curiosidad/giro/emocion), auto-contenidos (que se entiendan solos). "
        "Devuelve SOLO JSON: {\"clips\":[{\"start\":<seg>,\"end\":<seg>,\"title\":\"titulo EN INGLES alto CTR (<=60)\",\"hook\":\"frase gancho\",\"score\":<0-100>,\"reason\":\"por que\"}]}.\n\n"
        f"Duracion total: {duracion}s.\nTranscripcion:\n{texto[:12000]}"
    )


def elegir_momentos(texto: str, duracion: float, n: int, dmin: int, dmax: int) -> list:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("Falta GEMINI_API_KEY en .env")
    genai.configure(api_key=key)
    for m in ("gemini-flash-latest", "gemini-2.5-flash", "gemini-1.5-flash"):
        try:
            model = genai.GenerativeModel(m, generation_config={"response_mime_type": "application/json"})
            r = model.generate_content(_prompt(texto, duracion, n, dmin, dmax))
            data = json.loads(r.text)
            clips = [c for c in (data.get("clips") or []) if c.get("start") is not None and c.get("end") is not None]
            if clips:
                return clips[:n]
        except Exception as e:
            print(f"   Gemini {m}: {e}")
    return []


def analizar(video_path: str, hw: dict, cfg: dict) -> dict:
    idioma = cfg.get("idioma", "en")
    d = cfg.get("duracion_short", {})
    print("   transcribiendo (Whisper " + hw["whisper_model"] + " / " + hw["device"] + ")...")
    tr = transcribir(video_path, hw, idioma)
    print("   la IA elige los mejores momentos (Gemini)...")
    clips = elegir_momentos(tr["texto"], tr["duracion"], cfg.get("clips_per_video", 2),
                            d.get("min", 15), d.get("max", 55))
    return {"words": tr["words"], "clips": clips, "duracion": tr["duracion"]}
