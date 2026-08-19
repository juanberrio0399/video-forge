"""Paso 4 — QA: valida el Short antes de subirlo (duracion, formato 9:16, archivo OK, atribucion)."""
import json
import os
import subprocess


def _probe(path: str) -> dict:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height,duration", "-show_entries", "format=duration",
                        "-of", "json", path], capture_output=True, text=True, timeout=60)
    return json.loads(r.stdout or "{}")


def revisar(short_path: str, cfg: dict, atribucion: str) -> dict:
    fallos = []
    if not os.path.exists(short_path) or os.path.getsize(short_path) < 20000:
        return {"ok": False, "fallos": ["el archivo no existe o esta vacio"]}
    info = _probe(short_path)
    st = (info.get("streams") or [{}])[0]
    w, h = st.get("width", 0), st.get("height", 0)
    dur = float(st.get("duration") or (info.get("format", {}) or {}).get("duration") or 0)

    if h == 0 or abs((w / h) - (9 / 16)) > 0.02:
        fallos.append(f"no es 9:16 ({w}x{h})")
    d = cfg.get("duracion_short", {})
    if dur and not (d.get("min", 15) - 2 <= dur <= d.get("max", 55) + 3):
        fallos.append(f"duracion fuera de rango ({round(dur,1)}s)")
    if not atribucion:
        fallos.append("falta la atribucion CC")
    return {"ok": not fallos, "fallos": fallos, "w": w, "h": h, "dur": round(dur, 1)}
