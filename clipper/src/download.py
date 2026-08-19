"""Paso 1 — Descarga LOCAL de videos con licencia Creative Commons (yt-dlp).

Local para esquivar el bloqueo de YouTube en la nube. SOLO acepta videos CC-BY (verifica la
licencia); si no es CC, lo descarta (para no arriesgar copyright / desmonetizacion).
"""
import json
import os
import subprocess

from src import tools


def _meta(url: str) -> dict:
    """Metadata del video via yt-dlp (sin descargar)."""
    r = subprocess.run(tools.ytdlp() + ["-J", "--no-warnings", url], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(f"yt-dlp -J fallo: {r.stderr[:300]}")
    return json.loads(r.stdout)


def es_creative_commons(meta: dict) -> bool:
    lic = (meta.get("license") or "").lower()
    return "creativecommon" in lic.replace(" ", "") or lic == "cc-by" or "creative commons" in lic


def descargar(url: str, work_dir: str) -> dict:
    """Descarga el video si es CC. Devuelve {ok, path, meta, atribucion} o {ok:False, motivo}."""
    os.makedirs(work_dir, exist_ok=True)
    meta = _meta(url)
    if not es_creative_commons(meta):
        return {"ok": False, "motivo": f"NO es Creative Commons (license='{meta.get('license')}') -> descartado", "meta": meta}

    out = os.path.join(work_dir, "source.%(ext)s")
    r = subprocess.run(
        tools.ytdlp() + ["-f", "bv*[height<=1080]+ba/b[height<=1080]", "--merge-output-format", "mp4",
                         "-o", out, "--no-warnings", url],
        capture_output=True, text=True, timeout=1800,
    )
    if r.returncode != 0:
        return {"ok": False, "motivo": f"descarga fallo: {r.stderr[:300]}"}
    path = os.path.join(work_dir, "source.mp4")
    if not os.path.exists(path):
        # yt-dlp pudo dejar otra extension
        cand = [f for f in os.listdir(work_dir) if f.startswith("source.")]
        path = os.path.join(work_dir, cand[0]) if cand else path
    autor = meta.get("uploader") or meta.get("channel") or "autor original"
    atribucion = f'"{meta.get("title","")}" por {autor} — {url} (CC-BY).'
    return {"ok": True, "path": path, "meta": meta, "atribucion": atribucion,
            "title": meta.get("title", ""), "duracion": meta.get("duration", 0)}


if __name__ == "__main__":
    import sys
    print(json.dumps(descargar(sys.argv[1], "work"), indent=2, ensure_ascii=False, default=str)[:1000])
