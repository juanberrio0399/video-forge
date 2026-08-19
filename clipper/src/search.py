"""Busca videos LARGOS con licencia Creative Commons en YouTube y arma un TOP rankeado.

Usa el FILTRO NATIVO de YouTube "Creative Commons" (sp=EgIwAQ==) -> los resultados ya vienen
filtrados a CC (mucho mejor que buscar el texto 'creative commons' y verificar uno por uno).
download.py re-verifica la licencia real como candado final antes de descargar.
"""
import json
import subprocess
from urllib.parse import quote

from src import tools

# Codigo del filtro "Creative Commons" de la busqueda de YouTube (Filters -> Creative Commons).
YT_CC_FILTER = "EgIwAQ%3D%3D"


def _run(args, timeout=120):
    r = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    return r.stdout, r.returncode


def _buscar(tema: str, n: int) -> list:
    url = f"https://www.youtube.com/results?search_query={quote(tema)}&sp={YT_CC_FILTER}"
    out, rc = _run(tools.ytdlp() + ["--flat-playlist", "-J", "--no-warnings", "--playlist-end", str(n), url])
    if rc != 0 or not out:
        return []
    try:
        data = json.loads(out)
    except Exception:
        return []
    res = []
    for e in (data.get("entries") or []):
        if not e or not e.get("id"):
            continue
        res.append({"id": e["id"], "url": f"https://www.youtube.com/watch?v={e['id']}",
                    "title": e.get("title", ""), "duration": e.get("duration") or 0,
                    "views": e.get("view_count") or 0,
                    "channel": e.get("channel") or e.get("uploader") or "", "tema": tema})
    return res


def top_videos(temas: list, por_tema: int, min_dur: int, cuantos: int) -> dict:
    cand, seen = [], set()
    for t in temas:
        for c in _buscar(t, max(por_tema, 10)):
            if c["id"] in seen:
                continue
            seen.add(c["id"])
            cand.append(c)
    cand = [c for c in cand if (c["duration"] or 0) >= min_dur]
    cand.sort(key=lambda c: ((c["duration"] or 0), (c["views"] or 0)), reverse=True)
    top = cand[:cuantos]
    if top:
        dmax = max(v["duration"] for v in top) or 1
        vmax = max(v["views"] for v in top) or 1
        for v in top:
            v["score"] = round(60 * (v["duration"] / dmax) + 40 * (v["views"] / vmax))
            horas = round(v["duration"] / 3600, 1)
            v["razon"] = f"{horas}h . {v['views']:,} vistas . {v['tema']} . YouTube CC"
    return {"categorias": temas, "top": top}
