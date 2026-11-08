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

# Truncar MSG a ~4000 caracteres para evitar error 400 de Telegram (limite 4096)
if [ -n "$MSG" ] && [ ${#MSG} -gt 4000 ]; then
  MSG="${MSG:0:4000}...";
fi

API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"
MK_ARGS=()
[ -n "$MARKUP" ] && MK_ARGS=(-F "reply_markup=$MARKUP")

# HORAS DE SILENCIO (no despertar a Juan). Bogotá = UTC-5. Sueño 11pm-5am Bogotá = 04:00-10:00 UTC.
# En esa franja el mensaje SIGUE llegando pero SILENCIOSO (sin sonido/vibración).
H=$((10#$(date -u +%H)))
SILENT_F=(); SILENT_D=()
if [ "$H" -ge 4 ] && [ "$H" -lt 10 ]; then SILENT_F=(-F "disable_notification=true"); SILENT_D=(--data-urlencode "disable_notification=true"); fi

send_request() {
  local url="$1"
  shift
  local attempt=1
  local max_attempts=3
  local http_code=""
  
  while [ $attempt -le $max_attempts ]; do
    http_code=$(curl -s -w '%{http_code}' -o /dev/null "$@" "$url")
    local exit_code=$?
    
    if [ $exit_code -eq 0 ] && [[ "$http_code" =~ ^2[0-9]{2}$ ]]; then
      return 0
    fi
    
    # Si es error 429 (rate limit) o 5xx, reintentar con backoff
    if [[ "$http_code" == "429" ]] || [[ "$http_code" =~ ^5[0-9]{2}$ ]]; then
      if [ $attempt -lt $max_attempts ]; then
        sleep $((attempt * 2))
        attempt=$((attempt + 1))
        continue
      fi
    fi
    
    # Si es otro error (ej 400, 401, 404), no reintentar más
    break
  done
  
  echo "notify_telegram: FALLO el envío (HTTP ${http_code:-unknown}, exit ${exit_code:-0})" >&2
  return 1
}

# AVISOS CON CRITERIO: dentro de Actions, el bot decide si esto llega ya o va al resumen diario (7 pm).
# Llega ya: lo que trae botones o archivo, y la primera falla del dia de cada flujo. Lo demas, al resumen.
# Firmado con HMAC del token del bot (no viaja ningun secreto). Si el bot no responde, se manda igual: nunca se pierde.
# NOTIFY_NOW=1 lo manda siempre al momento.
if [ -n "${GITHUB_WORKFLOW:-}" ] && [ -z "${NOTIFY_NOW:-}" ] && command -v jq >/dev/null && command -v openssl >/dev/null; then
  HAS_BTN=false; [ -n "$MARKUP" ] && HAS_BTN=true
  HAS_FILE=false; [ -n "$FILE" ] && [ -f "$FILE" ] && HAS_FILE=true
  BODY=$(jq -cn --arg wf "$GITHUB_WORKFLOW" --arg run "${GITHUB_RUN_ID:-}" --arg ev "${GITHUB_EVENT_NAME:-}" --arg tx "$MSG"     --argjson b "$HAS_BTN" --argjson f "$HAS_FILE" '{wf:$wf, run:$run, evento:$ev, texto:$tx, botones:$b, archivo:$f}')
  FIRMA=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$TELEGRAM_BOT_TOKEN" -r | cut -d' ' -f1)
  MODO=$(curl -s --max-time 10 -X POST -H "content-type: application/json" -H "X-Aviso-Firma: $FIRMA"     --data-binary "$BODY" "${AVISOS_URL:-https://video-forge-bot.tienvo.workers.dev/aviso}" | jq -r '.modo // empty' 2>/dev/null)
  if [ "$MODO" = "resumen" ]; then
    echo "notify_telegram: va al resumen diario."
    exit 0
  fi
fi

SENT=0

if [ -n "$FILE" ] && [ -f "$FILE" ]; then
  case "$FILE" in
    *.mp3|*.wav|*.m4a|*.ogg)
      if send_request "$API/sendAudio" -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" "${SILENT_F[@]}" -F audio=@"$FILE"; then
        SENT=1
      fi
      ;;
    *.mp4|*.mov|*.webm)
      if send_request "$API/sendVideo" -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" "${SILENT_F[@]}" -F video=@"$FILE"; then
        SENT=1
      fi
      ;;
    *.jpg|*.jpeg|*.png|*.webp)
      if send_request "$API/sendPhoto" -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" "${SILENT_F[@]}" -F photo=@"$FILE"; then
        SENT=1
      fi
      ;;
    *)
      if send_request "$API/sendDocument" -F chat_id="$TELEGRAM_CHAT_ID" -F caption="$MSG" "${MK_ARGS[@]}" "${SILENT_F[@]}" -F document=@"$FILE"; then
        SENT=1
      fi
      ;;
  esac
else
  if [ -n "$MARKUP" ]; then
    if send_request "$API/sendMessage" -F chat_id="$TELEGRAM_CHAT_ID" -F text="$MSG" -F "reply_markup=$MARKUP" "${SILENT_F[@]}"; then
      SENT=1
    fi
  else
    if send_request "$API/sendMessage" --data-urlencode chat_id="$TELEGRAM_CHAT_ID" --data-urlencode text="$MSG" "${SILENT_D[@]}"; then
      SENT=1
    fi
  fi
fi

if [ $SENT -eq 1 ]; then
  echo "notify_telegram: enviado."
else
  echo "notify_telegram: no enviado (ver detalle arriba)."
fi
