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
from src import analyze, detect_hardware, download, edit, publish, qa  # noqa: E402

load_dotenv()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def cargar_config() -> dict:
    with open(os.path.join(ROOT, "config.json"), encoding="utf-8") as f:
        return json.load(f)


def procesar_url(url: str, cfg: dict, hw: dict, music: str = None) -> list:
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
        print("   ⚠️ la IA no encontro clips utiles.")
        return []
    print(f"   ✓ {len(a['clips'])} momentos elegidos")

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

            print("📤 [5/5] Publicando PRIVADO a Oddly Loop...")
            titulo = (clip.get("title") or d["title"])[:100]
            p = publish.publicar(out_mp4, titulo, d["atribucion"], cfg)
            print(f"   ✅ Subido: {p['url']}  (privado, categoria «{cfg.get('categoria')}»)")
            resultados.append({"url": p["url"], "titulo": titulo})
        except Exception as e:
            print(f"   ❌ error en el Short {i}: {e}")
    return resultados


def main():
    cfg = cargar_config()
    print("🖥️  Detectando hardware...")
    hw = detect_hardware.detectar()
    print("   " + hw["nota"])

    urls = []
    if len(sys.argv) > 1:
        urls = [sys.argv[1]]
    else:
        urls = list(cfg.get("sources") or [])
        # (La busqueda por tema se agrega en la siguiente version; por ahora usa 'sources'.)
    if not urls:
        print("\n⚠️ No hay URLs. Pon videos CC en config.json -> 'sources', o pasa una URL:")
        print("   python -m src.pipeline \"https://www.youtube.com/watch?v=...\"")
        return

    music = os.path.join(ROOT, "assets", "music.mp3")
    music = music if os.path.exists(music) else None
    total = []
    for u in urls:
        total += procesar_url(u, cfg, hw, music)

    print("\n" + "=" * 50)
    if total:
        print(f"✅ Listo: {len(total)} Short(s) PRIVADOS en Oddly Loop. Aprueba desde el bot de Telegram.")
        for t in total:
            print(f"   • {t['titulo']}  {t['url']}")
    else:
        print("Sin Shorts producidos esta corrida (revisa el log de arriba).")


if __name__ == "__main__":
    main()
