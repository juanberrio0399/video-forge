#!/usr/bin/env bash
# Manda un mensaje (y opcionalmente un archivo) al chat de Telegram desde Actions.
# Uso: notify_telegram.sh "mensaje" [ruta_archivo]
# Requiere env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
# Si faltan los secrets, no falla el workflow (solo avisa y sale 0).
set -uo pipefail

MSG="${1:-}"
FILE="${2:-}"

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "notify_telegram: sin TELEGRAM_BOT_TOKEN/CHAT_ID; salto notificacion."
  exit 0
fi

API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"

if [ -n "$FILE" ] && [ -f "$FILE" ]; then
  case "$FILE" in
    *.mp3|*.wav|*.m4a|*.ogg)
      curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" -F audio=@"$FILE" "$API/sendAudio" >/dev/null ;;
    *.mp4|*.mov|*.webm)
      curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" -F video=@"$FILE" "$API/sendVideo" >/dev/null ;;
    *)
      curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" -F document=@"$FILE" "$API/sendDocument" >/dev/null ;;
  esac
else
  curl -sf --data-urlencode chat_id="$TELEGRAM_CHAT_ID" \
       --data-urlencode text="$MSG" "$API/sendMessage" >/dev/null
fi

echo "notify_telegram: enviado."
