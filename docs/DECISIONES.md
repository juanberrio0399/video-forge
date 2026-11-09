# Decisiones y límites

Volver al [README](../README.es.md). Antes vivía en el README; se movió aquí y se puso al día.

- **GitHub Actions como granja de render, no un servidor.** Un runner gratis no aguanta un video de
  10 minutos de una sentada, así que `render_phased.yml` parte la narración en fases de ~2 minutos,
  las renderiza en paralelo, cada una pasa su propia puerta de calidad y al final se unen. Alquilar
  una GPU sería más simple y costaría dinero todos los meses; esto no cuesta nada.
- **El repo es público a propósito.** En privado, los 2.000 minutos mensuales de Actions se agotaban y
  todos los workflows fallaban. Público, los minutos de los runners estándar no se cobran. La
  contrapartida es que **nada sensible puede vivir en el repo**: la voz de referencia está en R2 privado
  y `.gitignore` bloquea `assets/voice/*.mp3`.
- **Kokoro para la voz de Oddly Loop, no edge-tts.** Kokoro es Apache-2.0 y corre en CPU dentro del
  runner (`kokoro-onnx`). edge-tts es zona gris para uso comercial y depende de un servicio que puede
  cerrar; Coqui/XTTS tienen licencia no comercial.
- **Cadena de proveedores de texto, no uno solo.** `pipeline/llm.mjs` prueba en orden Gemini → Groq →
  OpenRouter → Cloudflare Workers AI → Cerebras → SambaNova y usa el primero que responda; los que no
  tienen llave se saltan. Todos tienen capa gratis; quedarse con uno significa parar la fábrica el día
  que se agota su cuota. GitHub Models se quitó porque GitHub lo está retirando.
- **R2 como memoria, no una base de datos.** El estado son archivos JSON por canal. Sin servidor de
  base de datos que mantener y el Worker lee directo. El costo: no hay consultas, quien necesite
  cruzar datos los cruza en el script. La verdad está en R2 (`channel/auto2/state.json`,
  `channel/state.json`); los `*.seed.json` del repo solo se usan si R2 no responde.
- **Una puerta legal antes de publicar, no después.** `compliance_check.mjs` bloquea la publicación si
  un clip no está en la lista blanca de fuentes. Es más lento que publicar y arreglar después, pero un
  strike de copyright cuesta el canal. Por la misma razón el `clipper/` local está apagado desde el
  2026-10-24: su filtro de licencia no frenaba material ajeno.
- **Las subidas declaran `containsSyntheticMedia: true`** (`youtube_upload.mjs`). La voz es sintética;
  ocultarlo pone en riesgo la monetización.
- **Un solo bot de Telegram.** Video Forge, Radar, Viento (tienda) y Signal Halo se ven desde el mismo
  bot; los otros Workers se conectan por service binding (`OSGateway`) en vez de tener cada uno su bot.
- **Lo que el proyecto deliberadamente NO hace:** no compra vistas ni suscriptores, no comenta ni manda
  DM en canales ajenos, no re-sube material de terceros sin licencia ni transformación, y no publica en
  TikTok automáticamente (su Content Posting API exige una app aprobada). Todo el agendado vive en
  crons de GitHub Actions y del Worker.
