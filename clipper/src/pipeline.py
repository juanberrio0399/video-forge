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


def _buscar_nuevos(cfg: dict, excluir: set) -> list:
    """Busca en la fuente configurada y devuelve candidatos que NO esten en 'excluir'. No guarda."""
    s = cfg.get("search", {})
    fuente = (s.get("fuente") or "archive").lower()   # "archive" | "youtube" | "ambos"
    temas = s.get("temas", [])
    por = s.get("por_tema", 8)
    mind = s.get("duracion_min_video", 60)
    ntop = cfg.get("mostrar_top", 8)
    tops = []
    if fuente in ("archive", "ambos"):
        from src import search_archive
        print("\n🔎 Buscando en Archive.org (HD)...")
        tops += (search_archive.top_videos(temas, por, mind, ntop).get("top") or [])
    if fuente in ("youtube", "ambos"):
        print("\n🔎 Buscando en YouTube...")
        tops += (search.top_videos(temas, por, mind, ntop).get("top") or [])
    tops.sort(key=lambda v: v.get("score", 0), reverse=True)
    out, ya = [], set(excluir)
    for t in tops:
        k = _source_key(t.get("url", ""))
        if k in ya:
            continue
        ya.add(k)
        out.append(t)
    return out


def seleccionar_interactivo(cfg: dict) -> list:
    """Muestra el TOP: reusa tu lista anterior y la RELLENA con nuevos hasta completar.
    Eliges cuales apruebas; luego te muestra los NO aprobados por si quieres OMITIR alguno
    (para que no vuelva). Los omitidos se guardan; los demas siguen para la proxima."""
    proc = publish.cargar_procesados()
    desc = publish.cargar_descartados()
    excluidos = proc | desc
    ntop = cfg.get("mostrar_top", 8)

    # 1) Reusar lo anterior (quitando ya procesados y omitidos)
    top = [t for t in publish.cargar_top() if _source_key(t.get("url", "")) not in excluidos]
    reusados = len(top)
    if reusados:
        print(f"\n📋 Retomo tu lista anterior: {reusados} video(s) pendiente(s).")

    # 2) Rellenar hasta 'mostrar_top' con nuevos (si faltan)
    if len(top) < ntop:
        ya = excluidos | {_source_key(t.get("url", "")) for t in top}
        nuevos = _buscar_nuevos(cfg, ya)[: ntop - len(top)]
        if reusados and nuevos:
            print(f"   (+ agrego {len(nuevos)} nuevo(s) para completar el TOP)")
        top += nuevos
    top = top[:ntop]

    if not top:
        print("   No hay videos para mostrar. Ajusta los temas en config.json -> search.temas.")
        return []

    publish.guardar_top(top)   # guarda el TOP actualizado para reusarlo la proxima vez

    # 3) Mostrar y pedir APROBACION
    print("\n🏆 TOP videos (Archive.org, el mejor primero):\n")
    for i, v in enumerate(top, 1):
        print(f"  {i}. [{v.get('score','')}/100] {v['title'][:62]}")
        print(f"       {v.get('razon','')}")
        print(f"       ▶ VERLO: {v['url']}")
    print("\n👉 Que numero(s) APRUEBAS para procesar?  (ej: 1   o   1,3   ·   'todos'   ·   ENTER = el #1)")
    print("   (abre el link 'VERLO' en tu navegador para revisarlo antes de elegir)")
    try:
        sel = input("   > ").strip().lower()
    except EOFError:
        sel = ""
    if sel == "":
        aprob_idx = [1]
    elif sel in ("todos", "all"):
        aprob_idx = list(range(1, len(top) + 1))
    else:
        aprob_idx = [int(x) for x in sel.replace(" ", "").split(",")
                     if x.isdigit() and 1 <= int(x) <= len(top)] or [1]
    aprobados = [top[i - 1] for i in aprob_idx]

    # 4) Mostrar los NO aprobados y ofrecer OMITIR (para que no vuelvan)
    no_aprob = [i for i in range(1, len(top) + 1) if i not in aprob_idx]
    if no_aprob:
        print("\n🚫 No aprobaste estos (siguen en tu lista para la proxima):")
        for i in no_aprob:
            print(f"  {i}. {top[i - 1]['title'][:62]}")
        print("👉 Quieres OMITIR alguno para que NO vuelva a salir?  (numeros · ENTER = ninguno)")
        try:
            som = input("   > ").strip()
        except EOFError:
            som = ""
        omit_idx = [int(x) for x in som.replace(" ", "").split(",")
                    if x.isdigit() and int(x) in no_aprob]
        if omit_idx:
            keys = [_source_key(top[i - 1].get("url", "")) for i in omit_idx]
            publish.marcar_descartados(keys)
            print(f"   ✓ Omiti {len(keys)} video(s): no volveran a salir en el TOP.")

    print(f"\n✓ Procesando {len(aprobados)} video(s): " + ", ".join(f"#{i}" for i in aprob_idx))
    return [e["url"] for e in aprobados]


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
