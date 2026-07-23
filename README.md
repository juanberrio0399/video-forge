# video-forge

Fabrica de videos para YouTube que corre **100% en la nube** — nada se renderiza
en el PC. Escribes/generas la composicion, **GitHub Actions** la renderiza a MP4,
y (proximamente) un **bot de Telegram** controla todo: pedir videos, revisar el
preview y dar el OK para publicar en YouTube.

Nicho del canal: **datos que explican el mundo** (faceless, en ingles).

## Estado

**Fase 0** — render en la nube funcionando. Ver [ROADMAP.md](ROADMAP.md) para el plan completo.

## Como se renderiza (sin PC)

1. La composicion vive en `index.html` (HTML + GSAP, formato HyperFrames).
2. Al hacer push a `main` o disparar el workflow **Render video (cloud)** desde
   la pestana *Actions*, GitHub Actions:
   - instala FFmpeg + Chrome,
   - corre `hyperframes render`,
   - sube el MP4 como *artifact* descargable.

Disparo manual: pestana **Actions -> Render video (cloud) -> Run workflow**.

## Motores

- **HyperFrames** (Apache 2.0, gratis) — motor base, HTML -> MP4.
- **Remotion** (gratis para creador solo) — refuerzo, se integra en Fase 1.

## Local (opcional, solo edicion)

```bash
npm run dev     # preview en el navegador
npm run check   # validar la composicion
```

El render local requiere un FFmpeg funcional; el render de produccion es en la nube.
