"""Paso 1 — Descarga LOCAL desde Archive.org, eligiendo la MEJOR resolucion (HD).

Fuente: archive.org (permite descargas directas, sin bloqueos). De cada item elige el
archivo de video de MAYOR resolucion disponible. NO descarta por licencia: solo la
etiqueta (informativo). Para URLs que no sean de archive.org usa yt-dlp como respaldo.
"""
import json
import os
import subprocess
from urllib.parse import quote

import requests

from src import licencia, tools

UA = {"user-agent": "oddly-clipper/1.0"}
VIDEO_EXTS = (".mp4", ".m4v", ".mkv", ".avi", ".mpeg", ".mpg", ".mov", ".webm", ".ogv")


def _archive_id(url: str) -> str:
    for marca in ("archive.org/details/", "archive.org/download/", "archive.org/embed/"):
        if marca in url:
            return url.split(marca)[1].split("/")[0].split("?")[0]
    return ""


def _num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _seg(v) -> float:
    """'H:MM:SS' o '123.4' -> segundos."""
    if v is None:
        return 0.0
    s = str(v)
    if ":" in s:
        p = [_num(x) for x in s.split(":")]
        while len(p) < 3:
            p.insert(0, 0.0)
        return p[0] * 3600 + p[1] * 60 + p[2]
    return _num(s)


def archive_meta(idf: str) -> dict:
    """Metadata completa del item (API de archive.org)."""
    r = requests.get(f"https://archive.org/metadata/{idf}", timeout=40, headers=UA)
    r.raise_for_status()
    return r.json()


def mejor_video(files: list) -> dict:
    """Devuelve el archivo de video de MAYOR resolucion (a igualdad, prefiere mp4 y mas grande)."""
    vids = []
    for f in files or []:
        name = f.get("name", "")
        if not name.lower().endswith(VIDEO_EXTS):
            continue
        h = int(_num(f.get("height")))
        size = int(_num(f.get("size")))
        fmt = (f.get("format") or "").lower()
        es_mp4 = name.lower().endswith((".mp4", ".m4v")) or "264" in fmt or "mpeg4" in fmt
        vids.append({"name": name, "h": h, "size": size, "es_mp4": es_mp4,
                     "dur": _seg(f.get("length"))})
    if not vids:
        return {}
    vids.sort(key=lambda v: (v["h"], v["es_mp4"], v["size"]), reverse=True)
    return vids[0]


def descargar(url: str, work_dir: str) -> dict:
    """Descarga el video y devuelve {ok, path, meta, atribucion, ...}."""
    os.makedirs(work_dir, exist_ok=True)
    idf = _archive_id(url)
    if idf:
        return _descargar_archive(idf, url, work_dir)
    return _descargar_ytdlp(url, work_dir)


def _descargar_archive(idf: str, url: str, work_dir: str) -> dict:
    try:
        meta = archive_meta(idf)
    except Exception as e:
        return {"ok": False, "motivo": f"no pude leer metadata de archive.org: {e}"}

    best = mejor_video(meta.get("files") or [])
    if not best:
        return {"ok": False, "motivo": "el item no tiene archivo de video descargable"}

    dl_url = f"https://archive.org/download/{idf}/{quote(best['name'])}"
    ext = os.path.splitext(best["name"])[1].lower() or ".mp4"
    path = os.path.join(work_dir, f"source{ext}")
    calidad = f"{best['h']}p" if best["h"] else "resolucion original"
    print(f"   bajando la mejor calidad disponible: {calidad}")
    try:
        with requests.get(dl_url, stream=True, timeout=1800, headers=UA) as r:
            r.raise_for_status()
            with open(path, "wb") as fh:
                for chunk in r.iter_content(chunk_size=1 << 20):
                    if chunk:
                        fh.write(chunk)
    except Exception as e:
        return {"ok": False, "motivo": f"descarga fallo: {e}"}

    md = meta.get("metadata", {}) or {}
    title = md.get("title") or idf
    if isinstance(title, list):
        title = title[0] if title else idf
    autor = md.get("creator") or md.get("uploader") or "Internet Archive"
    if isinstance(autor, list):
        autor = ", ".join(str(a) for a in autor)
    rights = md.get("rights", "")
    if isinstance(rights, list):
        rights = " ".join(str(x) for x in rights)
    lic = licencia.etiqueta(md.get("licenseurl", ""), md.get("possible-copyright-status", ""), rights)
    dur = int(best["dur"] or _seg(md.get("runtime")))
    return {
        "ok": True, "path": path,
        "meta": {"id": idf, "title": title, "duration": dur, "height": best["h"]},
        "atribucion": f'"{title}" — {autor}. Fuente: {url} ({lic}).',
        "title": title, "duracion": dur, "licencia": lic,
    }


# --- Respaldo yt-dlp (para URLs que no sean de archive.org) ---
def _meta_ytdlp(url: str) -> dict:
    r = subprocess.run(tools.ytdlp() + ["-J", "--no-warnings", url],
                       capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(f"yt-dlp -J fallo: {r.stderr[:300]}")
    return json.loads(r.stdout)


def _descargar_ytdlp(url: str, work_dir: str) -> dict:
    try:
        meta = _meta_ytdlp(url)
    except Exception as e:
        return {"ok": False, "motivo": str(e)}
    out = os.path.join(work_dir, "source.%(ext)s")
    r = subprocess.run(
        tools.ytdlp() + ["-f", "bv*[height<=1080]+ba/b[height<=1080]",
                         "--merge-output-format", "mp4", "-o", out, "--no-warnings", url],
        capture_output=True, text=True, timeout=1800)
    if r.returncode != 0:
        return {"ok": False, "motivo": f"descarga fallo: {r.stderr[:300]}"}
    path = os.path.join(work_dir, "source.mp4")
    if not os.path.exists(path):
        cand = [f for f in os.listdir(work_dir) if f.startswith("source.")]
        path = os.path.join(work_dir, cand[0]) if cand else path
    autor = meta.get("uploader") or meta.get("channel") or "autor original"
    lic = meta.get("license", "No especificada")
    return {"ok": True, "path": path, "meta": meta,
            "atribucion": f'"{meta.get("title","")}" por {autor} — {url} (Licencia: {lic}).',
            "title": meta.get("title", ""), "duracion": meta.get("duration", 0), "licencia": lic}


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Uso: python -m src.download <url> [work_dir]")
        sys.exit(1)
    wd = sys.argv[2] if len(sys.argv) > 2 else "work"
    print(json.dumps(descargar(sys.argv[1], wd), indent=2, ensure_ascii=False, default=str))
