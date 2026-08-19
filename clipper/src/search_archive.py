"""Busca videos en Internet Archive (archive.org) con licencia SEGURA (CC-BY / CC0 / dominio publico).

Contenido legal para reusar y editar. Rechaza SA/NC/ND (no sirven para monetizar/editar).
Devuelve el mismo formato que el buscador de YouTube para que el TOP funcione igual.
"""
import requests


def _lic_ok(u: str) -> bool:
    u = (u or "").lower()
    if not u:
        return False
    if any(x in u for x in ["by-nc", "by-nd", "by-sa", "/sa", "/nc", "/nd", "noncommercial", "noderiv", "sharealike"]):
        return False
    return "creativecommons" in u or "publicdomain" in u


def _buscar(tema: str, n: int) -> list:
    q = (f"({tema}) AND mediatype:movies AND licenseurl:(*creativecommons* OR *publicdomain*) "
         "AND NOT collection:(feature_films OR classic_tv OR film_noir OR silent_films OR prelinger OR sci-fi_horror)")
    params = [("q", q), ("sort[]", "downloads desc"), ("rows", str(n)), ("output", "json"),
              ("fl[]", "identifier"), ("fl[]", "title"), ("fl[]", "licenseurl"),
              ("fl[]", "creator"), ("fl[]", "downloads")]
    try:
        r = requests.get("https://archive.org/advancedsearch.php", params=params, timeout=40,
                         headers={"user-agent": "oddly-clipper/1.0"}).json()
    except Exception as e:
        print(f"   archive.org error: {e}")
        return []
    out = []
    for d in (r.get("response", {}).get("docs") or []):
        if not _lic_ok(d.get("licenseurl")):
            continue
        idf = d.get("identifier")
        title = d.get("title")
        if isinstance(title, list):
            title = title[0] if title else idf
        out.append({"id": idf, "url": f"https://archive.org/details/{idf}",
                    "title": title or idf, "duration": 0,
                    "views": int(d.get("downloads") or 0),
                    "channel": d.get("creator") or "archive.org", "tema": tema,
                    "licenseurl": d.get("licenseurl")})
    return out


def top_videos(temas: list, por_tema: int, min_dur: int, cuantos: int) -> dict:
    cand, seen = [], set()
    for t in temas:
        for c in _buscar(t, max(por_tema * 3, 15)):
            if c["id"] in seen:
                continue
            seen.add(c["id"])
            cand.append(c)
    cand.sort(key=lambda c: c["views"], reverse=True)
    top = cand[:cuantos]
    if top:
        vmax = max(v["views"] for v in top) or 1
        for v in top:
            v["score"] = round(100 * (v["views"] / vmax))
            v["razon"] = f"{v['views']:,} descargas . {v['tema']} . archive.org (CC/dominio publico)"
    return {"categorias": temas, "top": top}
