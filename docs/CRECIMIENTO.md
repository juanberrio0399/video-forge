# Crecimiento del canal (suscriptores)

Palancas que la fábrica opera sola para **conseguir suscriptores** y **animar el canal**. Todo se publica en el canal real, así que el tono está calibrado: **retador con autoridad** (engancha y reta, sin clickbait falso ni spam).

## 1. Encadenar videos ("watch next")

Cada nuevo video, al publicarse, agrega en la descripción un enlace **al video anterior más relacionado** — no solo al último:

- `publish_youtube` arma la lista de videos públicos del canal (`prev_videos.json`) desde `inventory_cache.json`.
- La IA (`publish_package.mjs`) **elige el más relevante** al tema y escribe una línea gancho (`watch_next`).
- Si la IA no elige (o elige un id inválido), cae al **más reciente**. Si no hay previos, no pone nada.
- Sale como `▶️ <línea> : https://youtu.be/<id>` arriba del bloque de links.

Efecto: más vistas por sesión → más watch-time → el algoritmo recomienda más → más suscriptores.

## 2. CTA de suscripción "peleador"

El tono se aplica en **dos lugares**:
- **Guion** (`video_script.mjs`): el gancho inicial y el CTA final se generan con el tono elegido.
- **Descripción** (`publish_package.mjs`): el llamado a suscribirse y el comentario fijado usan el mismo tono.

### Tono configurable — `channel/growth.json`
```json
{ "cta_tone": "retador", "enabled": true }
```
| Tono | Qué hace |
|---|---|
| `retador` *(por defecto)* | Punzante, con autoridad; reta al espectador a suscribirse ("quien siga de largo se lo pierde"). **Sin clickbait falso.** |
| `provocador` | Contrarian, us-vs-them, para prender debate en comentarios. Más engagement, más polarizante. |
| `suave` | CTA clásico, claro y amable. |

Para cambiarlo: editar `channel/growth.json` en R2 (o poner `enabled:false` para desactivar). El próximo video lo toma solo.

## 3. La IA evalúa

- En la validación del paquete, la IA da una nota **`sub_pull` (0-10)** = qué tan fuerte empuja a suscribirse (CTA + enganche + watch-next). Se ve en el resumen de Telegram junto a CTR y SEO.
- El loop de **aprendizajes** (`learnings.mjs`) mira las métricas reales del canal y las inyecta al próximo guion → con el tiempo el sistema afina qué gancho/CTA convierte mejor.

## Más formas de animar el canal (ideas para evaluar)

- **Serie con cliffhanger:** el video N promete algo que paga el N+1 (ya se hace parcialmente en la cola de ideas).
- **Shorts como embudo:** cada largo genera shorts; el short engancha → manda al largo → suscribe. Subir la cadencia de shorts sube el alcance.
- **Pregunta polarizante fijada:** el `pinned_comment` ya se genera con tono retador para prender debate (comentarios = señal fuerte para el algoritmo). *(Pin manual: la API de YouTube no permite fijar por código.)*
- **Ganchos A/B:** probar dos aperturas y quedarse con la que retiene (se puede medir con Analytics cuando haya datos).

*Documento vivo — actualizar si se agregan palancas o cambia el tono.*
