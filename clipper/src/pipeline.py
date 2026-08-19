"""Orquestador — corre TODO el flujo con el paso a paso en pantalla.

  DESCARGA (CC) -> ANALISIS (Whisper+Gemini) -> EDICION PRO -> QA -> PUBLICAR (privado a Oddly + bot)

Uso:  python -m src.pipeline            (usa config.json)
      python -m src.pipeline <url_cc>   (procesa esa URL)
"""
import json
import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src import analyze, detect_hardware, download, edit, publish, qa, search  # noqa: E402

load_dotenv()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def cargar_config() -> dict:
    with open(os.path.join(ROOT, "config.json"), encoding="utf-8") as f:
        return json.load(f)


def procesar_url(url: str, cfg: dict, hw: dict, procesados: set = None, music: str = None) -> list:
    procesados = procesados if procesados is not None else set()
    key = _source_key(url)
    if key in procesados:
        print(f"\n⏭️  Ya procesado antes (no duplico): {url}")
        return []
    work = os.path.join(ROOT, "work", "job")
    os.makedirs(work, exist_ok=True)
    print(f"\n📥 [1/5] Descargando (solo CC): {url}")
    d = download.descargar(url, work)
    if not d["ok"]:
        print(f"   ⏭️  {d['motivo']}")
        return []
    print(f"   ✓ {d['title']}  ({d['duracion']}s)")

    print("🧠 [2/5] Analizando (Whisper + Gemini)...")
    a = analyze.analizar(d["path"], hw, cfg)
    if not a["clips"]:
        print("   ⚠️ la IA no encontro momentos buenos en este video.")
        return []
    print(f"   ✓ Segun el analisis, de este video salen {len(a['clips'])} corto(s):")
    for j, c in enumerate(a["clips"], 1):
        seg = int(float(c.get("end", 0)) - float(c.get("start", 0)))
        print(f"       {j}. «{(c.get('title') or '')[:44]}» ({seg}s, score {c.get('score','?')})")

    resultados = []
    out_dir = os.path.join(ROOT, "out")
    os.makedirs(out_dir, exist_ok=True)
    for i, clip in enumerate(a["clips"], 1):
        try:
            print(f"✂️  [3/5] Editando Short {i}/{len(a['clips'])}: «{clip.get('title','')[:40]}»")
            out_mp4 = os.path.join(out_dir, f"short_{d['meta'].get('id','x')}_{i}.mp4")
            edit.editar(d["path"], clip, a["words"], cfg, out_mp4, music)

            print("🔎 [4/5] QA...")
            v = qa.revisar(out_mp4, cfg, d["atribucion"])
            if not v["ok"]:
                print(f"   ❌ QA rechazo: {', '.join(v['fallos'])} -> lo salto")
                continue
            print(f"   ✓ QA OK ({v['w']}x{v['h']}, {v['dur']}s)")

            print("📤 [5/5] Enviando a R2 (para que lo apruebes en el bot)...")
            titulo = (clip.get("title") or d["title"])[:100]
            p = publish.enviar_a_r2(out_mp4, titulo, d["atribucion"], clip, cfg, url)
            print(f"   ✅ En R2: «{titulo}» (categoria «{p['categoria']}») — apruébalo en el bot de Telegram")
            resultados.append({"titulo": titulo, "categoria": p["categoria"]})
        except Exception as e:
            print(f"   ❌ error en el Short {i}: {e}")
    publish.marcar_procesado(key)   # queda en el historial: no se vuelve a procesar
    procesados.add(key)
    return resultados


def _source_key(url: str) -> str:
    """Clave estable del video FUENTE (para el anti-duplicados)."""
    if "archive.org/details/" in url:
        return "archive:" + url.split("archive.org/details/")[1].split("/")[0].split("?")[0]
    if "watch?v=" in url:
        return "yt:" + url.split("watch?v=")[1].split("&")[0]
    if "youtu.be/" in url:
        return "yt:" + url.split("youtu.be/")[1].split("?")[0]
    return url


def _buscar_top(cfg: dict, proc: set) -> list:
    """Busca (segun fuente), quita los ya procesados, guarda el TOP en R2 y lo devuelve."""
    s = cfg.get("search", {})
    fuente = (s.get("fuente") or "youtube").lower()   # "youtube" | "archive" | "ambos"
    temas = s.get("temas", [])
    por = s.get("por_tema", 8)
    mind = s.get("duracion_min_video", 60)
    ntop = cfg.get("mostrar_top", 8)
    tops = []
    if fuente in ("archive", "ambos"):
        from src import search_archive
        print("\n🔎 Buscando en Archive.org (CC / dominio publico)...")
        tops += (search_archive.top_videos(temas, por, mind, ntop).get("top") or [])
    if fuente in ("youtube", "ambos"):
        print("\n🔎 Buscando en YouTube (filtro Creative Commons)...")
        tops += (search.top_videos(temas, por, mind, ntop).get("top") or [])
    tops.sort(key=lambda v: v.get("score", 0), reverse=True)
    antes = len(tops)
    tops = [t for t in tops if _source_key(t.get("url", "")) not in proc]
    if antes > len(tops):
        print(f"   (omiti {antes - len(tops)} video(s) que ya habias procesado antes)")
    top = tops[:ntop]
    if top:
        publish.guardar_top(top)   # guarda el TOP para reusar los pendientes la proxima corrida
    return top


def seleccionar_interactivo(cfg: dict) -> list:
    """TOP de videos para elegir por numero. Si quedan PENDIENTES del ultimo TOP, ofrece esos
    (sin re-buscar); si no, busca nuevos. 'nuevos' fuerza otra busqueda."""
    proc = publish.cargar_procesados()
    ntop = cfg.get("mostrar_top", 8)
    pendientes = [t for t in publish.cargar_top() if _source_key(t.get("url", "")) not in proc]
    reusando = bool(pendientes)
    if reusando:
        top = pendientes[:ntop]
        print(f"\n📋 Retomando tu ultima lista: {len(top)} video(s) que faltaban de tu TOP anterior.")
    else:
        top = _buscar_top(cfg, proc)
    if not top:
        print("   No hay videos para mostrar. Ajusta los temas en config.json -> search.temas.")
        return []
    while True:
        print("\n🏆 TOP videos (el mejor primero):\n")
        for i, v in enumerate(top, 1):
            print(f"  {i}. [{v.get('score','')}/100] {v['title'][:62]}")
            print(f"       {v.get('razon','')}")
            print(f"       ▶ VERLO: {v['url']}")
        extra = "   ·   'nuevos' = buscar otra lista" if reusando else ""
        print(f"\n👉 Que numero(s) apruebas?  (ej: 1   o   1,3   ·   'todos'   ·   ENTER = el #1{extra})")
        print("   (abre el link 'VERLO' en tu navegador para revisarlo antes de elegir)")
        try:
            sel = input("   > ").strip().lower()
        except EOFError:
            sel = ""
        if sel == "nuevos" and reusando:
            top = _buscar_top(cfg, proc)
            reusando = False
            if not top:
                print("   No encontre nuevos videos.")
                return []
            continue
        break
    if sel == "":
        elegidos = [top[0]]
    elif sel in ("todos", "all"):
        elegidos = top
    else:
        idxs = [int(x) for x in sel.replace(" ", "").split(",") if x.isdigit() and 1 <= int(x) <= len(top)]
        elegidos = [top[i - 1] for i in idxs] or [top[0]]
    print(f"\n✓ Procesando {len(elegidos)} video(s): " + ", ".join(f"#{top.index(e) + 1}" for e in elegidos))
    return [e["url"] for e in elegidos]


def main():
    cfg = cargar_config()
    print("🖥️  Detectando hardware...")
    hw = detect_hardware.detectar()
    print("   " + hw["nota"])

    if len(sys.argv) > 1:
        urls = [sys.argv[1]]
    elif cfg.get("sources"):
        urls = list(cfg["sources"])
    elif cfg.get("search", {}).get("enabled"):
        urls = seleccionar_interactivo(cfg)
    else:
        urls = []
    if not urls:
        print("\n⚠️ No hay videos para procesar. Pon URLs CC en config.json -> 'sources', o activa 'search'.")
        return

    music = os.path.join(ROOT, "assets", "music.mp3")
    music = music if os.path.exists(music) else None
    procesados = publish.cargar_procesados()   # historial anti-duplicados (R2)
    total = []
    for u in urls:
        total += procesar_url(u, cfg, hw, procesados, music)

    print("\n" + "=" * 50)
    if total:
        print(f"✅ Listo: {len(total)} Short(s) enviados a R2. Ábrelos y APRUEBA en el bot de Telegram.")
        for t in total:
            print(f"   • {t['titulo']}  [{t['categoria']}]")
    else:
        print("Sin Shorts producidos esta corrida (revisa el log de arriba).")


if __name__ == "__main__":
    main()
