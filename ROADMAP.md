# video-forge · Roadmap

Sistema para crear, editar, narrar y publicar videos de un canal de YouTube
**100% en la nube** (nada corre en el PC de Juan). Nicho: **datos que explican el
mundo** (faceless, en ingles, para vistas + monetizacion).

## Arquitectura (objetivo)

```
Tu (Telegram)  --"nuevo video sobre X"-->  Bot (Cloudflare Worker, gratis, siempre on)
     ^                                          |  dispara via GitHub API
     |  te llega el MP4 de preview               v
     |                                    GitHub Actions renderiza
     |                                    (HyperFrames / Remotion + voz TTS + subtitulos)
     |                                          |  guarda MP4 en R2 (gratis)
     +------------  OK Publicar / No -----------+
                        |  al dar OK
                        v
                  Actions sube a YouTube (Data API)
```

## Motores de video (los dos, combinados)

- **HyperFrames** (HeyGen) — Apache 2.0, gratis para siempre, HTML -> MP4,
  determinista, nativo para CI. **Columna vertebral.**
- **Remotion** — React -> video, gratis para creadores solos (<=3 personas),
  mas plantillas y animacion fina. **Refuerzo.**
- **editor-pro-max** — inteligencia de autoria (componentes, plantillas, quitar
  silencios, subtitulos). Se integra encima.
- **HeyGen avatar** — descartado (de pago). Canal sin cara.

## Costo: 100% gratis para un creador solo

HyperFrames (Apache 2.0), Remotion (licencia de individuo), Whisper (subtitulos),
edge-TTS (voz), FFmpeg, GitHub Actions (free tier), YouTube Data API, Cloudflare
Worker + R2 (free tier), Telegram Bot API. Unico de pago = avatar HeyGen (no se usa).

## Fases

- [x] **Fase 0 — Render en la nube.** Repo + composicion de prueba + workflow que
      renderiza el MP4 en GitHub Actions y lo publica como artifact. *Prueba que
      la nube renderiza gratis.*
- [ ] **Fase 1 — Dos motores + voz + subtitulos.** Integrar Remotion; traer
      componentes/plantillas de editor-pro-max; voz edge-TTS; subtitulos Whisper.
      Primer video real de datos.
- [ ] **Fase 2 — Bot de Telegram (Cloudflare Worker).** Pedir videos, recibir
      preview, aprobar. Conectado a GitHub Actions via API. MP4 en R2.
- [ ] **Fase 3 — Auto-publish a YouTube.** Credenciales OAuth como secrets; el
      workflow sube solo al dar OK desde Telegram.
- [ ] **Fase 4 — Fabrica de contenido.** Comando "video nuevo" reproducible + cola
      de ideas, para soltar contenido nuevo poco a poco.

## Notas

- Repo en GitHub `juanberrio0399/video-forge` (privado al inicio).
- Clon local de edicion en `Documents\video-forge`; el computo real es en la nube.
- El FFmpeg local de Windows tiene DLLs rotas -> el render local no corre, pero
  no importa: todo se renderiza en Ubuntu (Actions).
- El bot de Telegram lo crea Juan con @BotFather; el token va como secret.
