"""Paso 3 — Edicion PRO (ffmpeg): recorta el momento, reencuadra a 9:16 y quema subtitulos
estilo CapCut (frases grandes, centradas, con contorno). Musica de fondo opcional.

v1 = reframe por recorte central + subtitulos por frase. (Face-tracking y b-roll = mejoras siguientes.)
"""
import os
import subprocess

W, H = 1080, 1920  # 9:16


def _fmt_ts(t: float) -> str:
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"


def _ass(words: list, start: float, end: float, out_ass: str):
    """Genera un .ass con subtitulos por FRASE (3-4 palabras), estilo grande centrado."""
    ws = [w for w in words if w["t1"] > start and w["t0"] < end]
    header = (
        "[Script Info]\nScriptType: v4.00+\nPlayResX: %d\nPlayResY: %d\n\n"
        "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Outline, Shadow, Alignment, MarginV\n"
        "Style: Cap,Arial,96,&H00FFFFFF,&H00000000,&H64000000,1,6,2,2,220\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Text\n" % (W, H)
    )
    lines, group = [], []
    for w in ws:
        group.append(w)
        if len(group) >= 4 or w["w"].endswith((".", "!", "?", ",")):
            t0 = max(0.0, group[0]["t0"] - start)
            t1 = max(t0 + 0.3, group[-1]["t1"] - start)
            txt = " ".join(g["w"] for g in group).upper().replace("\n", " ")
            lines.append(f"Dialogue: 0,{_fmt_ts(t0)},{_fmt_ts(t1)},Cap,,{{\\an2}}{txt}")
            group = []
    if group:
        t0 = max(0.0, group[0]["t0"] - start)
        t1 = max(t0 + 0.3, group[-1]["t1"] - start)
        txt = " ".join(g["w"] for g in group).upper()
        lines.append(f"Dialogue: 0,{_fmt_ts(t0)},{_fmt_ts(t1)},Cap,,{{\\an2}}{txt}")
    with open(out_ass, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(lines) + "\n")


def editar(video_path: str, clip: dict, words: list, cfg: dict, out_mp4: str, music_path: str = None):
    start, end = float(clip["start"]), float(clip["end"])
    dur = max(1.0, end - start)
    work = os.path.dirname(out_mp4)
    ass = os.path.join(work, "cap.ass")
    if cfg.get("subtitulos", {}).get("on", True):
        _ass(words, start, end, ass)

    # Reencuadre 9:16: escala para llenar alto y recorta el centro.
    vf = f"scale=-2:{H},crop={W}:{H}"
    if cfg.get("subtitulos", {}).get("on", True) and os.path.exists(ass):
        ass_esc = ass.replace("\\", "/").replace(":", "\\:")
        vf += f",subtitles='{ass_esc}'"

    cmd = ["ffmpeg", "-y", "-ss", str(start), "-t", str(dur), "-i", video_path]
    if music_path and cfg.get("musica", {}).get("on", True) and os.path.exists(music_path):
        vol = cfg.get("musica", {}).get("volumen", 0.12)
        cmd += ["-stream_loop", "-1", "-i", music_path,
                "-filter_complex", f"[0:v]{vf}[v];[1:a]volume={vol}[m];[0:a]volume=1[o];[o][m]amix=inputs=2:duration=first[a]",
                "-map", "[v]", "-map", "[a]"]
    else:
        cmd += ["-vf", vf]
    cmd += ["-t", str(dur), "-r", "30", "-c:v", "libx264", "-preset", "veryfast",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", out_mp4]

    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    if r.returncode != 0 or not os.path.exists(out_mp4):
        raise RuntimeError(f"ffmpeg edit fallo: {r.stderr[-400:]}")
    return out_mp4
