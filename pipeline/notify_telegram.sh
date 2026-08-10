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

# HORAS DE SILENCIO (no despertar a Juan). Bogotá = UTC-5. Sueño 11pm-5am Bogotá = 04:00-10:00 UTC.
# En esa franja el mensaje SIGUE llegando pero SILENCIOSO (sin sonido/vibración).
H=$((10#$(date -u +%H)))
SILENT_F=(); SILENT_D=()
if [ "$H" -ge 4 ] && [ "$H" -lt 10 ]; then SILENT_F=(-F "disable_notification=true"); SILENT_D=(--data-urlencode "disable_notification=true"); fi

if [ -n "$FILE" ] && [ -f "$FILE" ]; then
  case "$FILE" in
    *.mp3|*.wav|*.m4a|*.ogg)
      curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" "${SILENT_F[@]}" -F audio=@"$FILE" "$API/sendAudio" >/dev/null ;;
    *.mp4|*.mov|*.webm)
      curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" "${SILENT_F[@]}" -F video=@"$FILE" "$API/sendVideo" >/dev/null ;;
    *.jpg|*.jpeg|*.png|*.webp)
      curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" "${SILENT_F[@]}" -F photo=@"$FILE" "$API/sendPhoto" >/dev/null ;;
    *)
      curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" "${SILENT_F[@]}" -F document=@"$FILE" "$API/sendDocument" >/dev/null ;;
  esac
else
  if [ -n "$MARKUP" ]; then
    curl -sf -F chat_id="$TELEGRAM_CHAT_ID" -F text="$MSG" -F "reply_markup=$MARKUP" "${SILENT_F[@]}" "$API/sendMessage" >/dev/null
  else
    curl -sf --data-urlencode chat_id="$TELEGRAM_CHAT_ID" --data-urlencode text="$MSG" "${SILENT_D[@]}" "$API/sendMessage" >/dev/null
  fi
fi

echo "notify_telegram: enviado."
