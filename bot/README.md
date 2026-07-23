# video-forge-bot (Telegram)

Centro de control del canal en Telegram. Corre en un **Cloudflare Worker** (gratis,
siempre encendido). Tú le escribes al bot, y el Worker dispara **GitHub Actions**;
los resultados (audio, MP4) llegan al chat.

```
Tú (Telegram) → Worker (este bot) → GitHub Actions → resultado de vuelta al chat
```

## Comandos

- `/nuevo <tema>` — pedir un video nuevo (dispara el pipeline)
- `/render` — renderizar el video en la nube
- `/voz` — generar la narración
- `/estado` — ver los últimos procesos
- `/id` — ver tu chat id
- `/help` — menú

## Puesta en marcha (pasos que hace Juan; ~10 min)

> Nunca pegues el token en el chat con Claude. Los secrets se ponen tú mismo con
> `wrangler secret put` / `gh secret set`.

### 1) Crear el bot en Telegram
1. En Telegram, abre **@BotFather** → `/newbot`.
2. Nombre (ej. "Video Forge") y usuario (ej. `video_forge_bot`).
3. Copia el **token** que te da (algo como `123456:ABC...`).

### 2) Averiguar tu chat id
- Opción rápida: escribe a **@userinfobot** y te dice tu id.
- (O despliega primero y mándale `/id` al bot.)

### 3) Crear un GitHub token (fine-grained)
1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate.
2. Repository access: solo `juanberrio0399/video-forge`.
3. Permisos: **Actions: Read and write**, **Contents: Read-only**.
4. Copia el token (`github_pat_...`).

### 4) Elegir un secreto de webhook
Inventa una cadena aleatoria larga (ej. `openssl rand -hex 24`). La usarás en el
Worker y al registrar el webhook.

### 5) Desplegar el Worker
```bash
cd bot
npm install -g wrangler        # o usa: npx wrangler ...
wrangler login                 # abre el navegador, entra a tu Cloudflare

wrangler secret put TELEGRAM_BOT_TOKEN        # pega el token de BotFather
wrangler secret put TELEGRAM_WEBHOOK_SECRET   # pega la cadena aleatoria
wrangler secret put OWNER_CHAT_ID             # pega tu chat id
wrangler secret put GH_TOKEN                  # pega el GitHub token

wrangler deploy                # te da la URL del Worker (https://video-forge-bot.<tu>.workers.dev)
```

### 6) Registrar el webhook de Telegram
Reemplaza `<TOKEN>`, `<WORKER_URL>` y `<WEBHOOK_SECRET>`:
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>&secret_token=<WEBHOOK_SECRET>"
```
Debe responder `{"ok":true,...}`. Escríbele `/start` al bot para probar.

### 7) (Opcional) Notificaciones desde Actions al chat
Para que los workflows te manden el audio/MP4 al terminar, agrega en el repo
(GitHub → Settings → Secrets → Actions):
- `TELEGRAM_BOT_TOKEN` (el mismo token)
- `TELEGRAM_CHAT_ID` (tu chat id)

Los workflows llaman a `pipeline/notify_telegram.sh "mensaje" <archivo>` (no falla
si los secrets no están).

## Seguridad
- El Worker verifica el header secreto de Telegram y **solo responde a tu chat id**.
- El GitHub token vive como secret del Worker, nunca en el código ni en el repo.
- Usa un token fine-grained con el mínimo permiso (Actions) y solo este repo.
