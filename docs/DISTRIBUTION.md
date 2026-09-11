# 📡 Distribución multiplataforma — video-forge

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

## 🟡 Listas en código — faltan credenciales de Juan
| Superficie | Por qué no está aún |
|---|---|
| **Instagram Reels / Facebook Reels** | La Graph API SÍ publica Reels para cuentas Business, pero necesita el token del system user de Meta (ver [[project_panel_apis_meta_tiktok]], estaba "casi listo"). Cuando Juan dé el token, se agrega un repostador igual al de Telegram. |
| **Tumblr** | Free, pero su API usa OAuth1 firmado (frágil sin librería). Bajo ROI; se hará si Juan lo pide. |

## ⛔ Bloqueadas / descartadas (honestidad)
| Superficie | Por qué NO |
|---|---|
| **TikTok (auto-post)** | La Content Posting API exige app de developer aprobada; la app de Juan fue rechazada antes. No es "gratis/instantáneo". Alternativa: subir a mano o vía un tercero, pero eso rompe el "auto en la nube". |
| **Auto-comentar/DM en videos de OTROS** | Es spam: arriesga baneo del canal y viola políticas de YouTube. NO se hace. Lo legítimo es engagement en lo PROPIO. |
| **Reddit auto-post** | Alto riesgo de baneo/shadowban. Se mantiene manual (Claude deja la caja lista, Juan pega) — ver [[project_reddit_estrategia_karma]]. |

## Cómo activar el canal de Telegram (2 min, gratis)
1. En Telegram: crea un **canal público** (p. ej. `@oddlyloopclips`).
2. Añade el bot de video-forge como **administrador** del canal (con permiso de publicar).
3. Pásame el @usuario o el id del canal → se guarda como secret `DISTRIB_CHANNEL_ID`.
4. Listo: cada Short público nuevo se publica solo ahí cada 6h. Compartible/reenviable = más alcance.
