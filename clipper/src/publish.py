"""Paso 5 — Publicar: sube el Short PRIVADO a Oddly Loop (YT2), lo etiqueta con la categoria
distinta (para medir aparte) escribiendo en R2 niche_map, y avisa al bot de Telegram para que
Juan apruebe. NO publica publico: eso lo decides tu desde el bot.
"""
import json
import os

import requests


def subir_a_oddly(short_path: str, titulo: str, descripcion: str) -> str:
    """Sube PRIVADO a Oddly Loop con las credenciales YT2. Devuelve el video_id."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    creds = Credentials(
        token=None,
        refresh_token=os.getenv("YT2_REFRESH_TOKEN"),
        client_id=os.getenv("YT2_CLIENT_ID"),
        client_secret=os.getenv("YT2_CLIENT_SECRET"),
        token_uri="https://oauth2.googleapis.com/token",
    )
    yt = build("youtube", "v3", credentials=creds)
    body = {
        "snippet": {"title": titulo[:100], "description": descripcion[:4900], "categoryId": "24"},
        "status": {"privacyStatus": "private", "selfDeclaredMadeForKids": False},
    }
    media = MediaFileUpload(short_path, chunksize=-1, resumable=True)
    req = yt.videos().insert(part="snippet,status", body=body, media_body=media)
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    return resp["id"]


def etiquetar_categoria_r2(video_id: str, categoria_key: str):
    """Marca este video con la categoria (para que el bot/reporte lo mida aparte) en channel/auto2/niche_map.json."""
    import boto3
    acc = os.getenv("CLOUDFLARE_ACCOUNT_ID")
    bucket = os.getenv("R2_BUCKET", "video-forge")
    s3 = boto3.client("s3", endpoint_url=f"https://{acc}.r2.cloudflarestorage.com",
                      aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
                      aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"), region_name="auto")
    key = "channel/auto2/niche_map.json"
    try:
        cur = json.loads(s3.get_object(Bucket=bucket, Key=key)["Body"].read())
    except Exception:
        cur = {}
    cur[video_id] = categoria_key
    s3.put_object(Bucket=bucket, Key=key, Body=json.dumps(cur).encode(), ContentType="application/json")


def avisar_bot(titulo: str, video_id: str, categoria: str):
    tok, chat = os.getenv("TELEGRAM_BOT_TOKEN"), os.getenv("TELEGRAM_CHAT_ID")
    if not (tok and chat):
        return
    msg = (f"✂️ Nuevo Short (Clipper) — categoria «{categoria}»\n\n{titulo}\n"
           f"https://youtu.be/{video_id}\n\nQuedo PRIVADO en Oddly Loop. Revisalo y aprueba/publica desde el bot.")
    try:
        requests.post(f"https://api.telegram.org/bot{tok}/sendMessage", json={"chat_id": chat, "text": msg}, timeout=20)
    except Exception:
        pass


def publicar(short_path: str, titulo: str, atribucion: str, cfg: dict) -> dict:
    desc = f"{titulo}\n\n{atribucion}\n\nEditado por Oddly Clipper. #Shorts"
    print("   subiendo PRIVADO a Oddly Loop (YT2)...")
    vid = subir_a_oddly(short_path, titulo, desc)
    try:
        etiquetar_categoria_r2(vid, cfg.get("categoria_key", "clips_cc"))
    except Exception as e:
        print(f"   (aviso) no pude etiquetar en R2: {e}")
    avisar_bot(titulo, vid, cfg.get("categoria", "Clips CC"))
    return {"video_id": vid, "url": f"https://youtu.be/{vid}"}
