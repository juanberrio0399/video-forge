# video-forge · Roadmap

Sistema para investigar, crear, narrar, editar y publicar videos de un canal de
YouTube **100% en la nube** (nada corre en el PC de Juan). Nicho: **datos que
explican el mundo** (faceless, en ingles, para vistas + monetizacion).

Modelo: **video LARGO** de calidad (como pelicula, guion + direccion segundo a
segundo) y de ahi se sacan **Shorts** de los momentos wow. Todo controlado desde
un **bot de Telegram**.

## La "crew" de produccion (pipeline)

```
1. TENDENCIAS   last30days-skill         ->  de que habla la gente
2. VIRALES      claude-video-vision      ->  como lo hacen los que pegan (patrones)
3. GUIONISTA    (skill nueva)            ->  guion LARGO con ganchos y retencion
4. DIRECTOR     (skill nueva + HyperFrames) -> storyboard segundo a segundo
5. PRODUCCION   HyperFrames + Remotion + edge-TTS + Whisper -> video LARGO (nube)
6. SHORTS       ai-youtube-shorts-generator -> 3-5 shorts de los momentos wow
7. BOT TELEGRAM (Cloudflare Worker)      ->  pedir / revisar / aprobar
8. PUBLICAR     YouTube Data API         ->  el largo + los shorts
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
- **HeyGen avatar** — descartado (de pago). Canal SIN cara, voz edge-TTS.

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
      (HyperFrames/Remotion) + voz edge-TTS + subtitulos Whisper -> primer video
      LARGO real de datos, renderizado en la nube.
- [ ] **Fase 2 — Inteligencia de contenido.** last30days (tendencias) +
      claude-video-vision (analizar virales -> patrones que alimentan el guion).
- [ ] **Fase 3 — Shorts.** ai-youtube-shorts-generator saca 3-5 shorts del largo.
- [ ] **Fase 4 — Bot de Telegram (Cloudflare Worker).** Pedir, revisar preview, aprobar.
- [ ] **Fase 5 — Auto-publish a YouTube.** OAuth como secrets; publica largo + shorts al dar OK.
- [ ] **Fase 6 — Fabrica de contenido.** Cola de ideas + recurrencia; soltar contenido poco a poco.

## Roles nuevos como skills (crew)

- **video-guionista** — guion largo: gancho en 3s, promesa, estructura de retencion,
  beats, CTA. Basado en datos reales (moat AI-proof).
- **video-director** — traduce el guion a storyboard segundo a segundo (que se ve,
  que se oye, que se anima) que consumen HyperFrames/Remotion + TTS. Usa las skills
  hyperframes-creative / hyperframes-animation.

## Notas

- Repo GitHub `juanberrio0399/video-forge` (privado). Clon de edicion `Documents\video-forge`.
- El computo real es en la nube; el FFmpeg local de Windows esta roto (no importa).
- Bot de Telegram lo crea Juan con @BotFather; token = secret.
- GEMINI_API_KEY la crea Juan en Google AI Studio (gratis); va como secret.
