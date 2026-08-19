"""Busca videos LARGOS con licencia Creative Commons en YouTube y arma un TOP rankeado
para que Juan elija cual procesar (por numero). Solo metadata (no descarga) -> rapido.
"""
import json
import subprocess

from src import tools


def _run(args, timeout=90):
    r = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    return r.stdout, r.returncode


def _buscar_flat(tema: str, n: int) -> list:
    """Busca N candidatos (rapido, sin licencia todavia)."""
    out, rc = _run(tools.ytdlp() + [f"ytsearch{n}:{tema} creative commons", "--flat-playlist", "-J", "--no-warnings"])
    if rc != 0 or not out:
        return []
    try:
        data = json.loads(out)
    except Exception:
        return []
    res = []
    for e in (data.get("entries") or []):
        res.append({"id": e.get("id"), "url": f"https://www.youtube.com/watch?v={e.get('id')}",
                    "title": e.get("title", ""), "duration": e.get("duration") or 0,
                    "views": e.get("view_count") or 0, "channel": e.get("channel") or e.get("uploader") or "",
                    "tema": tema})
    return res


def _es_cc(vid_url: str) -> tuple:
    """Verifica licencia CC (una llamada de metadata). Devuelve (es_cc, meta_min)."""
    out, rc = _run(tools.ytdlp() + ["-J", "--no-warnings", "--skip-download", vid_url], timeout=60)
    if rc != 0 or not out:
        return False, {}
    try:
        m = json.loads(out)
    except Exception:
        return False, {}
    lic = (m.get("license") or "").lower().replace(" ", "")
    es = "creativecommon" in lic or lic == "cc-by"
    return es, {"duration": m.get("duration", 0), "views": m.get("view_count", 0),
                "channel": m.get("uploader", ""), "title": m.get("title", "")}


def top_videos(temas: list, por_tema: int, min_dur: int, cuantos: int) -> dict:
    """Devuelve {categorias, top}. 'top' = lista rankeada de videos CC largos (mejor primero)."""
    candidatos = []
    for t in temas:
        candidatos += _buscar_flat(t, por_tema)
    # Prioriza los mas largos para gastar menos llamadas de verificacion de licencia.
    candidatos = [c for c in candidatos if (c["duration"] or 0) >= min_dur]
    candidatos.sort(key=lambda c: c["duration"], reverse=True)

    verificados, vistos = [], set()
    for c in candidatos:
        if c["id"] in vistos:
            continue
        vistos.add(c["id"])
        es, meta = _es_cc(c["url"])
        if es:
            c.update({k: v for k, v in meta.items() if v})
            verificados.append(c)
        if len(verificados) >= cuantos * 2:  # buscamos el doble para poder rankear y quedarnos con lo mejor
            break

    # Ranking 0-100: mas duracion (mas material) + mas vistas (calidad probada).
    if verificados:
        dmax = max(v["duration"] for v in verificados) or 1
        vmax = max(v["views"] for v in verificados) or 1
        for v in verificados:
            score = round(60 * (v["duration"] / dmax) + 40 * (v["views"] / vmax))
            v["score"] = score
            horas = round(v["duration"] / 3600, 1)
            v["razon"] = f"{horas}h de material · {v['views']:,} vistas · {v['tema']}"
        verificados.sort(key=lambda v: v["score"], reverse=True)

    return {"categorias": temas, "top": verificados[:cuantos]}
