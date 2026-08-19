"""Paso 5 — Enviar a R2 (NO sube a YouTube desde el PC).

El PC solo deja el Short editado + su metadata en R2, en el area 'clipper/pending/'. Luego el BOT
lo muestra para que Juan apruebe, y la NUBE (con los secrets que ya tiene) lo sube a Oddly. Asi el
PC solo necesita las claves de R2 (nada de YT2 ni el refresh token dificil).
"""
import json
import os
import time
from datetime import datetime, timezone

import boto3


def _s3():
    acc = os.getenv("CLOUDFLARE_ACCOUNT_ID")
    if not (acc and os.getenv("R2_ACCESS_KEY_ID") and os.getenv("R2_SECRET_ACCESS_KEY")):
        raise RuntimeError("Faltan claves de R2 en .env (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)")
    return boto3.client("s3", endpoint_url=f"https://{acc}.r2.cloudflarestorage.com",
                        aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
                        aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"), region_name="auto")


def enviar_a_r2(short_path: str, titulo: str, atribucion: str, clip: dict, cfg: dict, source_url: str) -> dict:
    """Sube el MP4 + metadata a R2 pending y actualiza el indice que lee el bot."""
    bucket = os.getenv("R2_BUCKET", "video-forge")
    s3 = _s3()
    cid = f"{int(time.time())}_{os.path.splitext(os.path.basename(short_path))[0]}"
    key_mp4 = f"clipper/pending/{cid}.mp4"
    key_meta = f"clipper/pending/{cid}.json"
    now = datetime.now(timezone.utc).isoformat()

    print("   subiendo el Short a R2 (para revisar en el bot)...")
    s3.upload_file(short_path, bucket, key_mp4, ExtraArgs={"ContentType": "video/mp4"})
    meta = {
        "id": cid, "mp4_key": key_mp4, "title": titulo,
        "description": f"{titulo}\n\n{atribucion}\n\nEditado por Oddly Clipper. #Shorts",
        "categoria": cfg.get("categoria", "Remix"), "categoria_key": cfg.get("categoria_key", "remix"),
        "source_url": source_url, "score": clip.get("score"), "at": now,
    }
    s3.put_object(Bucket=bucket, Key=key_meta, Body=json.dumps(meta).encode(), ContentType="application/json")

    # Indice de pendientes (lo lee el bot para mostrarlos en "Remix por revisar")
    idx_key = "clipper/pending/index.json"
    try:
        idx = json.loads(s3.get_object(Bucket=bucket, Key=idx_key)["Body"].read())
        if not isinstance(idx, list):
            idx = []
    except Exception:
        idx = []
    idx = [x for x in idx if x.get("id") != cid]
    idx.append({"id": cid, "title": titulo, "at": now, "source_url": source_url, "score": clip.get("score")})
    s3.put_object(Bucket=bucket, Key=idx_key, Body=json.dumps(idx).encode(), ContentType="application/json")

    return {"id": cid, "categoria": meta["categoria"]}
