"""Busca videos en Internet Archive (archive.org) y arma un TOP.

Ordena por popularidad (descargas + reviews) y PREFIERE los de mayor resolucion (HD).
Etiqueta la licencia de cada uno (solo informativo). NO descarta por licencia.
"""
import requests

from src import download, licencia

UA = {"user-agent": "oddly-clipper/1.0"}


def _buscar(tema: str, n: int) -> list:
    q = f"({tema}) AND mediatype:movies"
    params = [
        ("q", q), ("sort[]", "downloads desc"), ("rows", str(n)), ("output", "json"),
        ("fl[]", "identifier"), ("fl[]", "title"), ("fl[]", "licenseurl"),
        ("fl[]", "creator"), ("fl[]", "downloads"), ("fl[]", "num_reviews"),
    ]
    try:
        r = requests.get("https://archive.org/advancedsearch.php", params=params,
                         timeout=40, headers=UA).json()
    except Exception as e:
        print(f"   archive.org error: {e}")
        return []

    out = []
    for d in (r.get("response", {}).get("docs") or []):
        idf = d.get("identifier")
        if not idf:
            continue
        title = d.get("title")
        if isinstance(title, list):
            title = title[0] if title else idf
        downloads = int(d.get("downloads") or 0)
        reviews = int(d.get("num_reviews") or 0)
        out.append({
            "id": idf, "url": f"https://archive.org/details/{idf}",
            "title": title or idf, "duration": 0, "views": downloads, "reviews": reviews,
            "popularity": downloads + reviews * 10, "channel": d.get("creator") or "archive.org",
            "tema": tema, "licenseurl": d.get("licenseurl"),
        })
    return out


def _enriquecer(c: dict) -> bool:
    """Consulta metadata: mejor resolucion (HD) + etiqueta de licencia + duracion real.
    Devuelve True si el item tiene un video descargable."""
    try:
        meta = download.archive_meta(c["id"])
    except Exception:
        return False
    best = download.mejor_video(meta.get("files") or [])
    if not best:
        return False
    md = meta.get("metadata", {}) or {}
    rights = md.get("rights", "")
    if isinstance(rights, list):
        rights = " ".join(str(x) for x in rights)
    c["height"] = best["h"]
    c["duration"] = int(best["dur"])
    c["licencia_label"] = licencia.etiqueta(
        c.get("licenseurl", ""), md.get("possible-copyright-status", ""), rights)
    return True


def top_videos(temas: list, por_tema: int, min_dur: int, cuantos: int) -> dict:
    cand, seen = [], set()
    for t in temas:
        for c in _buscar(t, max(por_tema * 3, 15)):
            if c["id"] in seen:
                continue
            seen.add(c["id"])
            cand.append(c)
    cand.sort(key=lambda c: c["popularity"], reverse=True)

    # Verificamos los mas populares (metadata) hasta llenar el TOP (tope de 40 consultas).
    top, revisados = [], 0
    for c in cand:
        if len(top) >= cuantos or revisados >= 40:
            break
        revisados += 1
        if not _enriquecer(c):
            continue
        if min_dur and c["duration"] and c["duration"] < min_dur:
            continue
        top.append(c)

    # Los HD (>=720p) primero; a igualdad, los mas populares.
    top.sort(key=lambda v: (1 if (v.get("height") or 0) >= 720 else 0, v["popularity"]), reverse=True)

    if top:
        vmax = max(v["popularity"] for v in top) or 1
        for v in top:
            v["score"] = round(100 * (v["popularity"] / vmax))
            res = f"{v['height']}p" if v.get("height") else "orig"
            v["razon"] = (f"{v['views']:,} descargas . {v['reviews']} reviews . "
                          f"{res} . {v.get('licencia_label', '')} . archive.org")

    return {"categorias": temas, "top": top}
