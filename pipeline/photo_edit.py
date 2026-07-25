#!/usr/bin/env python3
# photo_edit.py — Retoque de foto PROFESIONAL que PRESERVA la identidad.
# No re-genera la cara (no cambia facciones): limpia piel/imperfecciones y sube
# textura, tipo estudio. Opcionalmente cambia el fondo sin tocar a la persona.
#
# Modos:
#   retoque  -> GFPGAN (restauracion de rostro, fidelidad alta = misma identidad)
#               + Real-ESRGAN (textura/nitidez del resto) + gradacion de color suave.
#   fondo    -> rembg recorta el sujeto; se pone un fondo nuevo segun el prompt
#               (color solido / desenfoque / imagen IA de Pollinations) y luego se
#               aplica el mismo retoque de rostro para pulir.
#
# Uso: python pipeline/photo_edit.py <entrada> <salida> <modo> "<prompt>"
import os
import sys
import urllib.parse
import urllib.request
import numpy as np
import cv2

IN = sys.argv[1]
OUT = sys.argv[2]
MODE = (sys.argv[3] if len(sys.argv) > 3 else "retoque").lower()
PROMPT = sys.argv[4] if len(sys.argv) > 4 else ""

# Fidelidad de GFPGAN: mas alto = mas fiel al rostro original (preserva identidad).
FIDELITY = 0.6

# Suavidad del retoque (CALIBRABLE desde el bot via PHOTO_STRENGTH). El resultado de
# GFPGAN se MEZCLA con la foto ORIGINAL: mas bajo = mas natural (conserva la piel real,
# evita el "look IA/plastico"). Por defecto SUAVE (Juan pidio menos agresivo).
STRENGTH = os.environ.get("PHOTO_STRENGTH", "medio").lower()
BLEND = {"suave": 0.35, "medio": 0.55, "fuerte": 0.78}.get(STRENGTH, 0.55)


def load_bgr(path):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit("photo_edit: no pude leer la imagen de entrada")
    # Limita el lado mayor para no reventar memoria en CPU (el upscale x2 la sube luego).
    h, w = img.shape[:2]
    m = max(h, w)
    if m > 1600:
        s = 1600.0 / m
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    return img


def gfpgan_restore(bgr, weight=FIDELITY):
    """Restaura el rostro (limpia imperfecciones) SIN cambiar la identidad, y sube textura."""
    from gfpgan import GFPGANer
    bg = None
    try:
        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                        num_block=23, num_grow_ch=32, scale=2)
        bg = RealESRGANer(scale=2, model_path="weights/RealESRGAN_x2plus.pth",
                          model=model, tile=400, tile_pad=10, pre_pad=0, half=False)
    except Exception as e:
        print("photo_edit: Real-ESRGAN de fondo off:", e)
    restorer = GFPGANer(model_path="weights/GFPGANv1.4.pth", upscale=2,
                        arch="clean", channel_multiplier=2, bg_upsampler=bg)
    _, _, out = restorer.enhance(bgr, has_aligned=False, only_center_face=False,
                                 paste_back=True, weight=weight)
    return out


def pro_grade(bgr):
    """Gradacion de color/luz suave 'de estudio': mejora contraste local y color sin exagerar."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    l = clahe.apply(l)
    out = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)
    hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.06, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    return out


def fetch_pollinations(prompt, w, h):
    url = ("https://image.pollinations.ai/prompt/"
           + urllib.parse.quote(prompt)
           + f"?width={w}&height={h}&nologo=true&model=flux")
    req = urllib.request.Request(url, headers={"User-Agent": "video-forge"})
    data = urllib.request.urlopen(req, timeout=120).read()
    return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)


# Colores conocidos (BGR) para fondo solido si el prompt los menciona.
COLORS = {
    "blanco": (245, 245, 245), "negro": (15, 15, 15), "gris": (200, 200, 200),
    "azul": (200, 150, 60), "rojo": (60, 60, 210), "verde": (90, 170, 90),
    "beige": (200, 225, 240), "rosa": (200, 180, 240), "amarillo": (80, 210, 235),
}


def replace_background(bgr, prompt):
    """Recorta el sujeto (rembg) y compone un fondo nuevo. No toca a la persona."""
    from rembg import remove
    ok, buf = cv2.imencode(".png", bgr)
    cut = remove(buf.tobytes())
    rgba = cv2.imdecode(np.frombuffer(cut, np.uint8), cv2.IMREAD_UNCHANGED)
    if rgba is None or rgba.shape[2] < 4:
        print("photo_edit: rembg no devolvio alpha; dejo el fondo original")
        return bgr
    h, w = rgba.shape[:2]
    fg = rgba[..., :3].astype(np.float32)
    alpha = rgba[..., 3:4].astype(np.float32) / 255.0

    p = prompt.lower()
    bg = None
    for k, c in COLORS.items():
        if k in p:
            bg = np.zeros((h, w, 3), np.uint8)
            bg[:] = c
            break
    if bg is None and ("desenfoc" in p or "blur" in p or "bokeh" in p or "borros" in p):
        bg = cv2.GaussianBlur(bgr, (0, 0), 15)
    if bg is None:
        q = prompt.replace("fondo", "").replace("background", "").strip()
        q = (q + ", professional photography background, soft light, high detail").strip(", ")
        try:
            bg = cv2.resize(fetch_pollinations(q, w, h), (w, h))
        except Exception as e:
            print("photo_edit: Pollinations off, uso desenfoque:", e)
            bg = cv2.GaussianBlur(bgr, (0, 0), 15)

    comp = (fg * alpha + bg.astype(np.float32) * (1 - alpha)).astype(np.uint8)
    return comp


def beautify(bgr):
    """Retoque de BELLEZA natural: empareja la piel (menos granos/manchas), LEVANTA las
    OJERAS (aclara sombras) y da un acabado bonito, sin quedar plastico."""
    # 1) Suavizado que conserva bordes: piel mas pareja pero con textura (no plastico).
    smooth = cv2.bilateralFilter(bgr, 9, 55, 55)
    out = cv2.addWeighted(smooth, 0.5, bgr, 0.5, 0)
    # 2) Levantar sombras (OJERAS y zonas oscuras) sin quemar las luces: gamma<1 en L.
    lab = cv2.cvtColor(out, cv2.COLOR_BGR2LAB).astype(np.float32)
    l, a, b = cv2.split(lab)
    l = 255.0 * ((l / 255.0) ** 0.82)
    lab = cv2.merge((np.clip(l, 0, 255), a, b)).astype(np.uint8)
    out = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    # 3) Micro-nitidez: devuelve definicion a ojos/cejas tras suavizar.
    blur = cv2.GaussianBlur(out, (0, 0), 1.2)
    out = cv2.addWeighted(out, 1.3, blur, -0.3, 0)
    return out


def main():
    bgr = load_bgr(IN)
    if MODE == "fondo":
        bgr = replace_background(bgr, PROMPT)
    try:
        out = gfpgan_restore(bgr, weight=FIDELITY)
        # Mezcla con la ORIGINAL (subida al mismo tamano) para un retoque NATURAL, no plastico.
        orig_up = cv2.resize(bgr, (out.shape[1], out.shape[0]), interpolation=cv2.INTER_LANCZOS4)
        out = cv2.addWeighted(out, BLEND, orig_up, 1.0 - BLEND, 0)
        print(f"photo_edit: retoque '{STRENGTH}' (mezcla {int(BLEND*100)}% GFPGAN / {int((1-BLEND)*100)}% original)")
    except Exception as e:
        print("photo_edit: GFPGAN off, uso solo gradacion:", e)
        out = bgr
    out = beautify(out)     # belleza: empareja piel + quita ojeras + define, natural
    out = pro_grade(out)
    cv2.imwrite(OUT, out, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print("photo_edit: listo ->", OUT)


if __name__ == "__main__":
    main()
