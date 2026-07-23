# video-forge · Roadmap

Sistema para investigar, crear, narrar, editar y publicar videos de un canal de
YouTube **100% en la nube** (nada corre en el PC de Juan). Nicho: **datos que
explican el mundo** (faceless, en ingles, para vistas + monetizacion).

Modelo: **video LARGO** de calidad (como pelicula, guion + direccion segundo a
segundo) y de ahi se sacan **Shorts** de los momentos wow. Todo controlado desde
un **bot de Telegram**.

## La "crew" de produccion (pipeline)

```
1. TENDENCIAS   last30days-skill         ->  de que habla la gente (GO/NO-GO)
2. VIRALES      claude-video-vision      ->  como lo hacen los que pegan (patrones)
3. GUIONISTA    skill video-guionista    ->  guion LARGO con ganchos y retencion
4. DIRECTOR     skill video-director     ->  storyboard segundo a segundo
5. PRODUCCION   HyperFrames + Remotion + Kokoro-TTS + Whisper -> video LARGO (nube)
6. SHORTS       ai-youtube-shorts-generator -> 3-5 shorts de los momentos wow
7. BOT TELEGRAM (Cloudflare Worker)      ->  pedir / revisar / aprobar
8. GATE+PUBLICAR video-monetizacion (gate) -> YouTube Data API (largo + shorts)
```

## Arquitectura tecnica

```
Tu (Telegram) --"nuevo video sobre X"--> Bot (Cloudflare Worker, gratis, siempre on)
     ^                                       |  dispara via GitHub API
     |  preview del largo + shorts            v
     |                                 GitHub Actions:
     |                                   research -> guion -> storyboard ->
     |                                   render (HyperFrames/Remotion + TTS + subs) ->
     |                                   shorts -> MP4s a R2 (gratis)
     +-----------  OK Publicar / No ----------+
                       |  al dar OK
                       v
                 Actions sube a YouTube (largo + shorts)
```

## Motores de video (los dos, combinados)

- **HyperFrames** (HeyGen) — Apache 2.0, gratis para siempre, HTML -> MP4,
  determinista, nativo CI. **Columna vertebral.**
- **Remotion** — React -> video, gratis para creador solo (<=3 personas). **Refuerzo.**
- **editor-pro-max** — inteligencia de autoria (componentes, plantillas, silencios).
- **HeyGen avatar** — descartado (de pago). Canal SIN cara, voz Kokoro-TTS.

## Herramientas de inteligencia y edicion (nuevas)

- **last30days-skill** — investiga tendencias. Gratis: Reddit, HN, GitHub, YouTube
  (yt-dlp), arXiv, Techmeme, Polymarket sin keys. TikTok/IG = ScrapeCreators (opcional pago).
- **claude-video-vision** — analiza videos virales (extrae frames + transcribe,
  Claude interpreta). Gratis con Whisper local o **Gemini free tier**.
- **ai-youtube-shorts-generator** (samuraigpt, MIT) — largo -> shorts 9:16.
  Modo local gratis: faster-whisper + **Gemini free tier** para rankear highlights.
  Corre headless (CI).
- **Apify** — scraping extra TikTok/IG. **Free tier = $5/mes, limitado.** Solo si
  las fuentes gratis no alcanzan; primero agotar lo gratis.

## Costo: gratis para un creador solo

Unico requisito nuevo: **GEMINI_API_KEY gratis** (Google AI Studio, sin tarjeta) =
cerebro para analizar virales y rankear shorts. Va como secret. Unico de pago
posible = avatar HeyGen (no se usa) y Apify si se abusa (se evita).

## Fases

- [x] **Fase 0 — Render en la nube.** Repo + composicion de prueba + workflow que
      renderiza el MP4 en GitHub Actions. *Probado 2026-07-23.*
- [ ] **Fase 1 — Produccion base (el corazon).** Guionista + Director + 2 motores
      (HyperFrames/Remotion) + voz Kokoro-TTS + subtitulos Whisper -> primer video
      LARGO real de datos, renderizado en la nube.
- [ ] **Fase 2 — Inteligencia de contenido.** last30days (tendencias) +
      claude-video-vision (analizar virales -> patrones que alimentan el guion).
- [ ] **Fase 3 — Shorts.** ai-youtube-shorts-generator saca 3-5 shorts del largo.
- [~] **Fase 4 — Bot de Telegram (Cloudflare Worker).** Codigo del bot LISTO en
      `bot/` (comandos /nuevo /render /voz /estado, seguridad, dispatch a Actions) +
      `pipeline/notify_telegram.sh` (Actions -> chat). Falta: Juan crea el bot con
      @BotFather, pone secrets (wrangler) y `wrangler deploy` + setWebhook. Ver `bot/README.md`.
- [ ] **Fase 5 — Auto-publish a YouTube.** OAuth como secrets; publica largo + shorts al dar OK.
- [ ] **Fase 6 — Fabrica de contenido.** Cola de ideas + recurrencia; soltar contenido poco a poco.

## Crew como skills (8, todas validadas en la web 2025-2026 y escritas)

En `skills/`, cada una con reglas accionables + recursos gratis + errores comunes:

- **video-tendencias** — GO/NO-GO de un tema (demanda comprobada + oferta escasa).
- **video-virales** — packaging (titulo+miniatura de alto CTR) + ingenieria inversa
  etica de outliers; integra claude-video-vision.
- **video-guionista** — guion largo con hook 3-15s, open loops anidados, payoff cada
  60-90s, re-hook cada ~90s, cifras escaladas a lo humano.
- **video-director** — storyboard segundo a segundo + catalogo de escenas de datos +
  GSAP seek-safe (determinista) para HyperFrames/Remotion.
- **video-voz** — TTS por defecto **Kokoro (Apache 2.0)**, respaldo Piper; narracion
  140-160 WPM; mezcla a -14 LUFS; musica/SFX libres (Pixabay CC0 / YT Audio Library).
- **video-shorts** — 3-5 shorts del largo, captions karaoke, reframe 9:16; integra
  ai-youtube-shorts-generator.
- **video-seo** — rankear alto y salir como sugerencia en busqueda de YouTube Y
  Google (Key Moments por capitulos, transcripcion, AI Overviews, Shorts search);
  base tomada de `kostja94/marketing-skills` (MIT).
- **video-monetizacion** — PUERTA: requisitos YPP + gate anti-"inauthentic content"
  (valor original) + disclosure de contenido sintetico + SEO + cadencia.

### Decisiones clave de la investigacion

- **TTS = Kokoro-82M (Apache 2.0), no edge-tts.** edge-tts es zona gris legal
  (Microsoft no autoriza uso comercial + depende de red); Coqui/XTTS PROHIBIDOS
  (licencia no comercial). Kokoro corre gratis en CPU en Actions.
- **El canal SI se puede monetizar** (faceless + IA es bienvenido). El gate no es la
  IA sino el valor original: datos curados + interpretacion + variacion por video.
- **Activar siempre el disclosure "synthetic content"** por la voz TTS.
- **Requisito nuevo: GEMINI_API_KEY gratis** (Google AI Studio) = cerebro para
  analizar virales y rankear shorts.

## Notas

- Repo GitHub `juanberrio0399/video-forge` (privado). Clon de edicion `Documents\video-forge`.
- El computo real es en la nube; el FFmpeg local de Windows esta roto (no importa).
- Bot de Telegram lo crea Juan con @BotFather; token = secret.
- GEMINI_API_KEY la crea Juan en Google AI Studio (gratis); va como secret.
