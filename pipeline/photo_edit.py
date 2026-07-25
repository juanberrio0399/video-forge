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
BLEND = {"suave": 0.25, "medio": 0.40, "fuerte": 0.60}.get(STRENGTH, 0.40)  # cuanto GFPGAN
SKIN = {"suave": 0.55, "medio": 0.75, "fuerte": 0.92}.get(STRENGTH, 0.75)   # cuanto retoque de piel


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


def auto_correct(bgr):
    """ANALIZA y corrige luz + color como un fotografo: recupera sombras (contraluz),
    ajusta brillo (oscura/quemada), corrige dominante de color y sube el color si esta palida."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    meanL = float(l.mean())
    # Recuperar sombras/altas (contraluz) con contraste local adaptativo.
    l2 = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
    # Auto-brillo: si esta oscura aclara, si esta quemada baja un poco (gamma).
    g = 0.80 if meanL < 110 else (1.12 if meanL > 165 else 0.95)
    l2 = np.clip(255.0 * ((l2 / 255.0) ** g), 0, 255).astype(np.uint8)
    # Auto balance de blancos: centrar las medias de a,b hacia 128 (quita dominante).
    a = np.clip(a.astype(np.float32) - (float(a.mean()) - 128) * 0.6, 0, 255).astype(np.uint8)
    b = np.clip(b.astype(np.float32) - (float(b.mean()) - 128) * 0.6, 0, 255).astype(np.uint8)
    out = cv2.cvtColor(cv2.merge((l2, a, b)), cv2.COLOR_LAB2BGR)
    # Saturacion: si esta palida (poco color), subir mas; si no, un toque.
    hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)
    mul = 1.28 if float(hsv[..., 1].mean()) < 85 else 1.08
    hsv[..., 1] = np.clip(hsv[..., 1] * mul, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    print(f"photo_edit: auto-correccion (brillo medio {meanL:.0f}, gamma {g}, sat x{mul})")
    return out


def skin_mask(bgr):
    """Mascara de la PIEL (para suavizar solo piel; ojos/cejas/pelo/fondo quedan nitidos)."""
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    m = cv2.inRange(ycrcb, np.array([0, 133, 77]), np.array([255, 173, 127]))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m = cv2.GaussianBlur(m, (0, 0), 7)
    return (m.astype(np.float32) / 255.0)[..., None]


def skin_retouch(bgr, amount=SKIN):
    """Retoque de piel PRO por SEPARACION DE FRECUENCIAS: empareja tono (quita OJERAS,
    ARRUGAS, granos, manchas) y CONSERVA la textura (poros) -> natural, no plastico.
    Solo en la piel (mascara). Cierra con micro-nitidez para ojos/cejas."""
    low = cv2.GaussianBlur(bgr, (0, 0), 6)                 # tono (baja frecuencia)
    high = bgr.astype(np.int16) - low.astype(np.int16)      # textura (alta frecuencia)
    smooth_low = cv2.bilateralFilter(low, 9, 45, 45)        # empareja el tono
    recon = np.clip(smooth_low.astype(np.int16) + high, 0, 255).astype(np.uint8)
    m = skin_mask(bgr) * amount
    out = (recon.astype(np.float32) * m + bgr.astype(np.float32) * (1 - m)).astype(np.uint8)
    # Micro-nitidez global (define ojos/cejas tras suavizar la piel).
    blur = cv2.GaussianBlur(out, (0, 0), 1.1)
    out = cv2.addWeighted(out, 1.25, blur, -0.25, 0)
    return out


def main():
    bgr = load_bgr(IN)
    if MODE == "fondo":
        bgr = replace_background(bgr, PROMPT)
    bgr = auto_correct(bgr)   # analiza y corrige luz/color (oscura, palida, contraluz)
    try:
        out = gfpgan_restore(bgr, weight=FIDELITY)
        # Mezcla con la ORIGINAL (subida al mismo tamano) para un retoque NATURAL, no plastico.
        orig_up = cv2.resize(bgr, (out.shape[1], out.shape[0]), interpolation=cv2.INTER_LANCZOS4)
        out = cv2.addWeighted(out, BLEND, orig_up, 1.0 - BLEND, 0)
        print(f"photo_edit: retoque '{STRENGTH}' (mezcla {int(BLEND*100)}% GFPGAN / {int((1-BLEND)*100)}% original)")
    except Exception as e:
        print("photo_edit: GFPGAN off, uso solo gradacion:", e)
        out = bgr
    out = skin_retouch(out)  # ojeras/arrugas/granos por separacion de frecuencias, natural
    cv2.imwrite(OUT, out, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print("photo_edit: listo ->", OUT)


if __name__ == "__main__":
    main()
