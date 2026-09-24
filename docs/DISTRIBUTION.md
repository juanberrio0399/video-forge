# Distribución multiplataforma

Repartir los Shorts a más superficies para multiplicar vistas. **Todo gratis, automático, en la nube.**
Regla dura: **nada de spam ni comentar/DM en canales ajenos** (quema la cuenta y viola políticas).
Solo repost de contenido PROPIO + engagement legítimo en nuestros propios videos.

## Estado real (verificado por los secrets configurados)
| Superficie | Qué hace | Workflow | Estado |
|---|---|---|---|
| **Bilibili** | Repostea los Shorts de Oddly | `bilibili_repost.yml` | ✅ **ACTIVA** (`BILIBILI_COOKIE` ok) |
| **Playlists YouTube** | Agrupa por nicho (sube el watch-time de sesión) | `sync_playlists.yml` | ✅ ACTIVA |
| **Respuestas a comentarios** | Responde comentarios propios, natural y corto | `comment_reply.yml` | ✅ ACTIVA |
| **Telegram (canal público)** | Publica cada Short público nuevo (reenviable/compartible) | `telegram_broadcast.yml` | 🟡 código listo — **falta `DISTRIB_CHANNEL_ID`** (crear canal + bot admin) |
| **Pinterest** | Pinea Shorts públicos de Oddly (con miniatura) | `pinterest.yml` | 🟡 código listo — **faltan `PINTEREST_ACCESS_TOKEN` + `PINTEREST_BOARD_ID`** (nunca se activó) |

## Pendientes de credencial
| Superficie | Por qué no está aún |
|---|---|
| **Instagram Reels / Facebook Reels** | La Graph API sí publica Reels para cuentas Business, pero exige el token de un system user de Meta. Con ese token, el repostador es igual al de Telegram. |
| **Tumblr** | Gratis, pero su API usa OAuth1 firmado (frágil sin librería) y el retorno es bajo. |

## Bloqueadas o descartadas
| Superficie | Por qué NO |
|---|---|
| **TikTok (auto-post)** | La Content Posting API exige una app de developer aprobada, y la solicitud fue rechazada. Subirlo a mano o vía un tercero rompe el "todo en la nube". |
| **Auto-comentar o mandar DM en videos de OTROS** | Es spam: arriesga el canal y viola las políticas de YouTube. Lo legítimo es el engagement en lo propio. |
| **Reddit auto-post** | Alto riesgo de shadowban. Se publica a mano. |

## Cómo activar el canal de Telegram (2 min, gratis)
1. En Telegram: crea un **canal público** (p. ej. `@oddlyloopclips`).
2. Añade el bot de video-forge como **administrador** del canal (con permiso de publicar).
3. Guarda el @usuario o el id del canal como secret `DISTRIB_CHANNEL_ID`.
4. Cada Short público nuevo se publica ahí solo, cada 6 h.
