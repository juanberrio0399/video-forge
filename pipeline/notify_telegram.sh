#!/usr/bin/env bash
# Manda un mensaje (y opcionalmente un archivo) al chat de Telegram desde Actions.
# Uso: notify_telegram.sh "mensaje" [ruta_archivo]
# Requiere env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
# Si faltan los secrets, no falla el workflow (solo avisa y sale 0).
set -uo pipefail

MSG="${1:-}"
FILE="${2:-}"
MARKUP="${3:-}"   # opcional: JSON de inline_keyboard (botones de aprobacion)

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "notify_telegram: sin TELEGRAM_BOT_TOKEN/CHAT_ID; salto notificacion."
  exit 0
fi

API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"
MK_ARGS=()
[ -n "$MARKUP" ] && MK_ARGS=(-F "reply_markup=$MARKUP")

if [ -n "$FILE" ] && [ -f "$FILE" ]; then
  case "$FILE" in
    *.mp3|*.wav|*.m4a|*.ogg)
      curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" -F audio=@"$FILE" "$API/sendAudio" >/dev/null ;;
    *.mp4|*.mov|*.webm)
      curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" -F video=@"$FILE" "$API/sendVideo" >/dev/null ;;
    *.jpg|*.jpeg|*.png|*.webp)
      curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" -F photo=@"$FILE" "$API/sendPhoto" >/dev/null ;;
    *)
      curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" -F document=@"$FILE" "$API/sendDocument" >/dev/null ;;
  esac
else
  if [ -n "$MARKUP" ]; then
    curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F text="$MSG" -F "reply_markup=$MARKUP" "$API/sendMessage" >/dev/null
  else
    curl -sf --data-urlencode chat_id="$TELEGRAM_CHAT_ID" --data-urlencode text="$MSG" "$API/sendMessage" >/dev/null
  fi
fi

echo "notify_telegram: enviado."
