# Capacidad de la fábrica y experimento de duración

Dos preguntas: **¿cuánto puede publicar la fábrica al día?** y **¿podemos ir alargando los videos sin que se rompa?** Ambas se miden y se ven en la app (pestaña **Canal → 🏭 Fábrica**).

## 1. Capacidad diaria

### El cuello de botella es el diseño, no el cómputo
- Hay **un solo slot de producción** (`0001-youtube-money`): se produce un video a la vez (voz + render + aprobación).
- Un render largo tarda **~50 min**. En teoría cabrían muchos renders secuenciales al día, pero la **cadencia real** la marca el cron: `daily_video` produce **1 largo/día** (con un rescate a las 15:00 si la mañana falló).
- Los **shorts** son baratos y no compiten por el slot del largo → son los que dan volumen.

### Qué se mide (gratis, sin gastar cuota)
La app calcula el **throughput real** desde el inventario del canal (no cuesta llamadas extra):

| Métrica | Significado |
|---|---|
| **Publicados 7d** | Videos (largos + shorts) publicados en los últimos 7 días. |
| **Por día** | Promedio diario = publicados 7d ÷ 7. |
| **Largos / Shorts** | Desglose del throughput. |

### ¿Se puede llegar a 2/día?
- **2 largos/día con 1 solo slot** está al límite (render secuencial + cron de 1/día). Para sostenerlo habría que: (a) un segundo slot de render en paralelo, o (b) bajar el tiempo de render.
- El camino elegido es **1 largo + sus shorts**: 1 largo cada 1-2 días + 2-3 shorts por largo llena los ≥2/día sin forzar el slot. La pestaña **Agenda** reparte todo en las mejores horas.
- Si el **Por día** de la tarjeta Fábrica se queda corto vs la meta, es señal de aprobar/publicar más shorts (o subir un segundo slot más adelante).

## 2. Experimento de duración (subir el tiempo poco a poco)

La idea: **no saltar de golpe a videos largos**, sino subir por escalones midiendo que cada duración aguante (render a tiempo + QA que pasa).

### Cómo funciona
- Config en `channel/experiments.json` (semilla en `channel/experiments.seed.json`):
  ```json
  { "duration": { "enabled": true, "target_min": 8, "ramp": [8, 10, 12, 15], "step": 0, "streak": 0, "history": [] } }
  ```
- **`produce_video`** lee la duración objetivo (`ramp[step]`) y se la pasa al guionista.
- **`video_script.mjs`** apunta el guion a esa duración (~7 beats/min) manteniendo la retención alta (nada de relleno).
- Cuando un video **pasa QA**, `render_phased` llama a **`experiment_step.mjs`**, que registra el resultado (`duración real`, `nota QA`, `pasó/no`) en el historial.
- **Regla de ascenso:** si **2 videos seguidos** llegan al objetivo (≥90 % de la duración) y pasan QA → **sube al siguiente escalón** de la rampa. Si uno falla, la racha se reinicia (no sube).

### Qué se ve en la app
La tarjeta 🏭 Fábrica muestra la rampa (`8m → 10m → 12m → 15m`) con el escalón actual resaltado y los ya superados en verde, el objetivo vigente, y el último video medido (duración real, QA, racha para subir).

### Ajustar el experimento
- Cambiar la rampa o pausarlo: editar `channel/experiments.json` en R2 (`ramp`, `enabled`, `step`).
- Bajar de escalón si un tamaño no rinde (retención baja): poner `step` en el valor anterior.
- **Retención**: hoy el ascenso mira duración + QA. Cuando el canal tenga datos de YouTube Analytics, se puede endurecer la regla para exigir también retención sana antes de subir.

*Documento vivo — actualizar si cambia la rampa o la regla de ascenso.*
