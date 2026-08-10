# Flujos de video-forge

Todos los flujos del sistema, con diagramas. Dos canales **independientes** (nunca comparten datos).
Los diagramas se renderizan en GitHub.

---

## 1) The Data Lens — producción por INACTIVIDAD (Juan aprueba)

```mermaid
flowchart TD
  cron["daily_video.yml (cron cada 6h)"] --> idle{"idle_check.mjs:\n+18h sin video\nY <3 pendientes?"}
  idle -- no --> stop["no produce (espera)"]
  idle -- si --> pv["produce_video.yml\nguion IA (retencion + editor cine)"]
  pv --> voice["voice_parallel.yml\nvoz Kokoro"]
  voice --> render["render_phased.yml\nHyperFrames por fases + QA\n+ musica (ducking) + viñeta cine\n+ guarda de tamaño <300MiB"]
  render --> priv["Video PRIVADO en R2\n(pendiente de aprobar)"]
  priv --> app["Juan lo ve en la app\n(pestaña Producir / Control)"]
  app -- aprueba --> pub["publish_youtube.yml\nSEO + miniatura"]
  pub --> sched["schedule_youtube.yml\nmejor hora libre"]
  sched --> shorts["shorts_plan -> shorts_final\nshorts de los mejores momentos"]
```

---

## 2) Oddly Loop — BLITZ de Shorts (full-auto)

```mermaid
flowchart TD
  cron["daily_oddly.yml (12:30 UTC = 7:30am Bogota)"] --> plan["lee cadence.json\n8 Shorts + 1 largo/dia (rota nicho)"]
  plan --> loop["por cada pieza (cada ~5 min):"]
  loop --> prod["produce_oddly.yml"]
  subgraph prod["produce_oddly.yml (por pieza)"]
    g["compilation_script.mjs\nguion (puro=sin voz / narrado)"] --> v["voz Kokoro (si narrado)"]
    v --> lib["baja biblioteca ASMR curada (R2)"]
    lib --> asm["build_compilation.mjs\nclips legales (Pexels/Pixabay)\n+ mezcla de sonido por nicho\n+ grade cine"]
    asm --> gate{"compliance_check.mjs\nsolo fuentes con licencia"}
    gate -- falla --> block["NO publica (avisa)"]
    gate -- ok --> up["sube a YT2 (privado)"]
    up --> sc["programa a la mejor hora libre"]
  end
  prod --> report["report_auto2.yml (cada 6h)\nvistas + top + mejores horas -> app"]
```

---

## 3) Agendado (por DATOS) — separado por canal

```mermaid
flowchart TD
  subgraph datos["De donde salen las horas"]
    rep["reportes calculan best_hours.json\n(horas ET con mas vistas/dia)"]
  end
  rep --> hrs{"hay datos suficientes\n(>=6 publicos)?"}
  hrs -- si --> dh["usa TUS mejores horas"]
  hrs -- no --> res["usa horas de research\n(pico tarde/noche EEUU)"]
  dh --> slot
  res --> slot["elige franja:\n1) reparte en huecos vacios\n2) tope 2 por hora\n(6 franjas/dia)"]
  slot --> dl["The Data Lens: nextBestSlot (Worker)\nocupadas = SOLO su canal"]
  slot --> ol["Oddly Loop: best_slot.mjs + scheduled_times.mjs\nocupadas = SOLO YT2"]
```

---

## 4) Estado y control (app <-> nube)

```mermaid
flowchart LR
  yt["YouTube API"] --> reps["channel_report.yml / report_auto2.yml\n(cron cada 6h)"]
  reps --> r2["R2: channel/state.json\nchannel/auto2/state.json\nbest_hours.json"]
  app["Telegram Mini App\n(inicio/producir/agenda/analitica/mas)"] -- "GET /api/state (auth Telegram)" --> worker["Cloudflare Worker"]
  worker --> r2
  app -- "accion (aprobar/programar/producir)" --> worker
  worker -- "gh dispatch (GH_TOKEN)" --> wf["workflows"]
  worker -- "notify" --> tg["Telegram (silencioso 11pm-5am Bogota)"]
```

---

## 5) Biblioteca de sonido ASMR (curada, CC0)

```mermaid
flowchart TD
  b["build_asmr_library.yml (manual / al cambiar paletas)"] --> f["Freesound (solo CC0):\npaletas por nicho + stingers + pack de edicion"]
  f --> r2["R2: asmr_lib.tgz + sfx_edit.tgz"]
  r2 --> use1["produce_oddly la usa\n(mezcla ASMR profesional)"]
  r2 --> use2["render_phased usa el pack de edicion\n(whooshes en transiciones)"]
```

---

## 6) Auto-recuperacion (24/7)

```mermaid
flowchart LR
  wd["watchdog.yml (cada 15 min)"] --> chk{"algo caido / atascado?"}
  chk -- si --> re["reanuda la fase / reintenta"]
  chk -- no --> ok["sigue"]
  err["errores de workflows"] --> learn["error_learn.mjs\nregistra causa + fix -> app"]
```

---

## Resumen de cadencia

| Canal | Cuando | Que produce |
|---|---|---|
| The Data Lens | cada 6h, si +18h inactivo | 1 largo (privado, Juan aprueba); shorts del video |
| Oddly Loop | 12:30 UTC diario | 8 Shorts + 1 largo (full-auto, se programan solos) |
| Reportes | cada 6h | refrescan vistas/top/mejores-horas |
| Watchdog | cada 15 min | reanuda lo caido |
