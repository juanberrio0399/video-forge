"""Resuelve las herramientas externas SIN depender del PATH del sistema.

- yt-dlp: se llama como modulo del propio Python del entorno (python -m yt_dlp).
- ffmpeg/ffprobe: primero el del PATH; si no esta, el que trae 'imageio-ffmpeg' (binario incluido).
Asi funciona aunque ffmpeg no este en el PATH de la sesion actual (caso tipico en Windows).
"""
import shutil
import sys


def ytdlp() -> list:
    return [sys.executable, "-m", "yt_dlp"]


def ffmpeg() -> str:
    p = shutil.which("ffmpeg")
    if p:
        return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def ffprobe() -> str:
    # imageio-ffmpeg no trae ffprobe; si no esta en el PATH, se devuelve el nombre (el QA lo maneja).
    return shutil.which("ffprobe") or "ffprobe"
