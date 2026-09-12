# Brand book — canales, bots y Mini Apps

Fuente de verdad del branding de todo lo que produce este sistema: los dos canales de YouTube
(The Data Lens, Oddly Loop), los tres bots de Telegram (Video Forge, Radar, Tienvo) y sus Mini Apps.
El código implementa lo que dice este documento; si algo cambia aquí, se cambia en el código en el
mismo movimiento (y al revés).

Índice: 1) principios · 2) tipografía · 3) identidades y paletas · 4) videos y miniaturas ·
5) comentarios y voz · 6) logos, avatares y banners · 7) Mini Apps · 8) dónde vive cada cosa.

---

## 1. Principios

- **Una familia, varias identidades.** Todo lo que controla Juan (bots y Mini Apps) vive en una familia
  **verde**; cada app tiene su tono para reconocerla al instante. Los canales públicos de YouTube
  conservan su identidad propia, pensada para su audiencia, no para la suite.
- **Nativo antes que decorado.** Las Mini Apps se apoyan en el tema de Telegram (claro/oscuro) y en la
  fuente del sistema. Los videos usan tipografías con licencia libre que existen en el runner de la nube.
- **Contraste siempre.** Texto sobre gradientes con `--accfg` oscuro (AA). Texto sobre video con borde o
  caja negra translúcida. Nunca color sobre color sin borde.
- **Honesto.** Ganchos punzantes, sin clickbait falso. Comentarios cortos y humanos.

## 2. Tipografía

| Uso | Familia | Pesos | Por qué |
|---|---|---|---|
| Mini Apps (las 3) | Fuente del sistema: `-apple-system, "Segoe UI", Roboto, system-ui` | 500 / 700 / 800 | Se ve nativa en iOS y Android; cero carga. Números grandes con cifras proporcionales; `tabular-nums` solo en tablas y ejes. |
| Videos largos The Data Lens (HyperFrames) | **Inter** (Google Fonts) + **JetBrains Mono** para cifras | Inter 400/600/800/900 · Mono 700 | Inter es la fuente de datos por excelencia; el mono le da peso “de terminal” a los números. |
| Shorts y overlays por ffmpeg (ambos canales) | **Liberation Sans Bold** (fallback DejaVu Sans Bold) | 700 | Es lo que existe en el runner Ubuntu; métricamente igual a Arial, se lee en móvil. |
| Miniaturas | Liberation Sans Bold | 700 | Un solo peso pesado, 118 px sobre franja oscura. |
| Logos y wordmarks en SVG | Inter → Liberation Sans → Arial (cascada) | 700/800 | Se rasteriza en la nube con `rsvg-convert`; la cascada garantiza que nunca caiga en serif. |
| Tienda pública Tienvo (web) | Georgia (títulos) + Arial (UI) | 400/700 | Estética editorial de tienda; distinta de la app de control, a propósito. |
| Textos públicos (descripciones, comentarios, Telegram) | sin tipografía (texto plano) | — | Formato con emojis medidos, listas cortas, nunca markdown roto. |

Regla: **no introducir fuentes nuevas** sin actualizar esta tabla. Si un día se quiere Inter en los
Shorts, se instala en el workflow (`fonts-inter` no existe en apt; se descarga el TTF y se apunta
`FONT` al archivo) y se anota aquí.

## 3. Identidades y paletas

### Canales de YouTube (públicos)

**The Data Lens** (`@TheDataLensHQ`) — “datos con lente”. Oscuro, tecnológico, con un destello frío.

| Token | Valor | Uso |
|---|---|---|
| Fondo | `#05070f` (video) · `#070b16` (web) | base de todo |
| Texto | `#eaf1ff` | titulares y cifras |
| Texto secundario | `#9fb2d4` · `#6b86b8` | subtítulos, etiquetas de ticker |
| Acento frío | `#22d3ee` (cian) | énfasis, gradientes |
| Acento verde | `#34d399` | revelaciones, CTA, cierre positivo |
| Ámbar | `#fde68a → #f59e0b` | ganchos, alerta, “ojo con esto” |
| Oro | `gold` (ffmpeg) | cifras grandes en Shorts de datos |
| Gradiente firma | `#eaf1ff → #22d3ee 60% → #34d399` | cifras gigantes, wordmark, títulos web |
| Glows de fondo | `#1b8fb0` · `#0e7a53` · `#5b3fb0` | blobs radiales detrás del contenido |

**Oddly Loop** (`@oddlyloophq`) — calma, ASMR, “tu loop diario”. Claro, suave, azul niebla.

| Token | Valor | Uso |
|---|---|---|
| Fondo | `#EEF3FC → #C7D6F1 → #A6BEE8` | avatar y banner |
| Tinta | `#3F4E86` | ondas, punto central, wordmark |
| Wordmark | `oddly loop`, minúsculas, 700, tracking 2 | avatar y banner |
| Texto en video | blanco sobre caja negra al 55 % | intros de compilación (`recipe_assemble`) |

Oddly no usa verde en su identidad pública: el azul niebla comunica calma y ya está publicado. En la
Mini App, su pestaña sí usa esmeralda porque ahí la identidad es la de la suite de control, no la del canal.

### Suite de control (bots y Mini Apps, familia verde)

| App / canal | `--acc` → `--acc2` | `--accfg` | Logo | Dónde |
|---|---|---|---|---|
| Video Forge · Oddly Loop | esmeralda `#10b981` → teal `#2dd4bf` | `#04140d` | loop ∞ | `bot/src/miniapp*.js` (`body[data-ch="auto2"]`) |
| Video Forge · The Data Lens | lima `#a3e635` → verde `#4ade80` | `#0f1a00` | lente + barras | ídem (`data-lens`) |
| Video Forge · Resumen | menta `#34d399` → `#6ee7b7` | `#04140d` | barras | ídem (`all`) |
| Bot Video Forge (avatar) | esmeralda → lima | `#04140d` | ∞ con play | `bot/branding/avatar.svg` |
| Radar | teal `#14b8a6` → `#5eead4` | `#03140f` | radar (arcos + punto) | `radar-bot/src/index.js`, `radar-bot/branding/avatar.svg` |
| Tienvo (app de control) | verde comercio `#22c55e` → `#86efac` | `#04200f` | bolsa con check | `panel-marketing-cloud/worker-jsl/src/index.js`, `worker-jsl/branding/avatar.svg` |

Tokens comunes: `--glow` = acento al 20 % (sombras/halos); semáforo rojo `#ff5a5a`, amarillo
`#f2b234`, verde `#33c46e`; base de tema Telegram con fallback oscuro (`#0b0f17` fondo, `#141b26` tarjeta,
`#e9eaed` texto, `#8b909a` hint).

### Tienda pública Tienvo (web)

`--crema #F7F5F2` fondo · `--tinta #1A1A1A` texto · `--rojo #B42318` botón de compra · `--gris #6b6b6b`
secundario · sello de confianza `#2e7d32` sobre `#eef7ee`. Editorial, cálida, nada que ver con la app de
control (y así debe seguir: una es para clientes, la otra para Juan).

## 4. Videos y miniaturas

**The Data Lens, video largo (HyperFrames, `pipeline/build_composition.mjs`)**: fondo `#05070f` con tres
glows radiales, rejilla de 70 px al 3 %, viñeta; ticker arriba a la derecha (etiqueta 15 px tracking 3
en `#6b86b8`, valor 40 px 900 en `#eaf1ff`); cifras gigantes 200 px 900 con el gradiente firma; escenas
codificadas por color: gancho = ámbar, dato = cian, revelación/CTA = verde.

**Shorts de datos (`data_shock_short.mjs`, `shorts_generate.mjs`)**: gancho arriba (12 % de altura)
blanco con borde negro 9 px y sombra; cifra en `gold` con borde 13 px; etiqueta blanca debajo. En
`shorts_generate`: título 58 px blanco en caja negra al 50 % (y = 150) y cierre 40 px al 85 % abajo.

**Shorts de espacio e historia (`space_short.mjs`, `history_short.mjs`, `space_sleep_video.mjs`)**: mismo
patrón blanco + borde negro; CTA 66 px con interlineado 14; tarjeta de gancho con sombra.

**Oddly Loop compilaciones (`recipe_assemble.mjs`)**: texto 54 px blanco en caja negra al 55 % a 460 px
del borde inferior; el resto del video es el clip limpio con su audio original.

**Miniaturas (`make_thumbnail.mjs`)**: 1080×1920 (Shorts) con franja `black@0.38` desde y = 1230 y
texto 118 px Liberation Sans Bold, blanco, borde 7 px, sombra 4/4, centrado en la parte baja. Máximo
3 líneas, palabras cortas, un número si lo hay.

Reglas de texto en video: máximo 6 palabras por línea; un solo énfasis de color por pantalla; nunca
texto pegado a bordes (zona segura 8 %); siempre borde o caja.

## 5. Comentarios y voz

- **Respuestas a comentarios (`comment_reply.mjs`, ambos canales)**: voz del creador, UNA frase, ~12
  palabras, casual y genuina, en el idioma del comentario (por defecto inglés). Sin hashtags; máximo un
  emoji y solo si encaja. A trolls: ligero o un gracias, nunca discutir. Nunca prometer ni inventar.
  Tope 8 respuestas por corrida, solo comentarios de los últimos 7 días, anti‑duplicado en R2, filtro
  anti‑inyección antes y después del LLM.
- **Comentario fijado (`publish_package.mjs`)**: pregunta abierta que prenda debate, tono por canal
  (`CTA_TONE`): The Data Lens = retador con autoridad (punzante, sin clickbait falso); Oddly = suave,
  claro y amable.
- **Descripciones**: primera línea = gancho + valor; luego capítulos o lista corta; enlaces a playlist
  y suscripción; hashtags al final (máximo 3).
- **Telegram (bots)**: frases cortas, un emoji de estado al inicio (✅ ❌ ⏳ 🔄), nunca jerga interna sin
  explicar, siempre decir qué hacer a continuación.
- No se comenta en videos ajenos ni se automatiza nada que huela a spam.

## 6. Logos, avatares y banners

Todos son SVG en el repo (sin assets externos) y se rasterizan en la nube con `rsvg-convert`.

| Asset | Archivo | Tamaño PNG | Cómo se sube |
|---|---|---|---|
| Avatar The Data Lens | `channel/branding/logo.svg` | 800×800 | Juan en YouTube Studio (la API no permite avatar) |
| Banner The Data Lens | `channel/branding/banner.svg` | 2048×1152 (zona segura central 1235×338) | API `channelBanners.insert` (`set_channel_branding.mjs`) |
| Avatar Oddly Loop | `channel/auto2/branding/logo.svg` | 800×800 | Juan en Studio |
| Banner Oddly Loop | `channel/auto2/branding/banner.svg` | 2048×1152 | API, workflow `set_oddly_branding.yml` |
| Avatar bot Video Forge | `bot/branding/avatar.svg` | 512×512 | Juan en @BotFather → /setuserpic |
| Avatar bot Radar | `radar-bot/branding/avatar.svg` | 512×512 | @BotFather |
| Avatar bot Tienvo | `panel-marketing-cloud/worker-jsl/branding/avatar.svg` | 512×512 | @BotFather |

El workflow **`branding_assets.yml`** (manual) rasteriza todos los SVG de este repo y te los manda por
Telegram listos para subir; el de Tienvo tiene su gemelo en `panel-marketing-cloud`. Los logos de las
Mini Apps (tiles del header) son SVG inline de 44×44 dibujados con `var(--accfg)` sobre el gradiente.

Reglas de logo: forma simple que se lea a 40 px; sin texto dentro del avatar de bot (el nombre ya
aparece al lado); el wordmark solo en banners; nunca degradar el gradiente a un color plano.

## 7. Mini Apps (sistema compartido)

Header sticky con tile de logo (42 px, radio 13, gradiente + glow) · tabs píldora (activa con gradiente)
· KPIs bento (`repeat(auto-fit,minmax(88px,1fr))`, cifra 24 px 850, etiqueta 10.5 px mayúsculas) ·
tarjetas radio 17 px con sombra `0 12px 30px rgba(0,0,0,.30)` · botón primario gradiente + glow,
secundario en línea, destructivo rojo en línea · skeleton con shimmer · toast animado · empty states con
emoji · `prefers-reduced-motion` apaga animaciones. El JS cliente vive dentro de un template literal:
sin backticks ni `${}`; eventos por `data-act` con delegación.

Función manda sobre diseño: **Video Forge** es monitor puro (nada se aprueba); **Radar** y **Tienvo**
conservan las aprobaciones de Juan.

## 8. Dónde vive cada cosa

- Tokens de Mini Apps: `bot/src/miniapp.js`, `bot/src/miniapp_v2.js`, `radar-bot/src/index.js`,
  `panel-marketing-cloud/worker-jsl/src/index.js` (bloque `<title>TIENVO — Panel</title>`).
- Look de video: `pipeline/build_composition.mjs` (largo), `pipeline/*_short.mjs`, `shorts_generate.mjs`,
  `recipe_assemble.mjs`, `make_thumbnail.mjs`.
- Voz: `pipeline/comment_reply.mjs`, `pipeline/publish_package.mjs` (`CTA_TONE`).
- Assets: `channel/branding/`, `channel/auto2/branding/`, `bot/branding/`, `radar-bot/branding/`,
  `worker-jsl/branding/` (Tienvo). Workflows: `branding_assets.yml`, `set_oddly_branding.yml`.

Cambiar una identidad = cambiar `--acc`, `--acc2`, `--glow`, `--accfg` (y el SVG del avatar si aplica),
validar el cliente sin backticks, renderizar las vistas reales, y actualizar este documento.
