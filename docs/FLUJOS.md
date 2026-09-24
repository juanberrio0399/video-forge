# Flujos de video-forge

Todos los flujos del sistema, con diagramas (GitHub los renderiza). Los dos canales son
**independientes**: nunca comparten estado, credenciales ni reportes.

---

## 1) The Data Lens — producción por INACTIVIDAD (Juan aprueba)

> **Pausado desde el 2026-09-14.** El cron de `daily_video.yml` está apagado y el flujo solo arranca a
> mano. Queda documentado porque el encadenado no cambió: al restaurar el cron vuelve a correr tal cual.

```mermaid
flowchart TD
  cron["daily_video.yml<br/>(disparo manual; cron pausado)"] --> idle{"idle_check.mjs:<br/>+18h sin video<br/>y menos de 3 pendientes?"}
  idle -- no --> stop["no produce (espera)"]
  idle -- si --> pv["produce_video.yml<br/>guion IA (retencion + editor cine)"]
  pv --> voice["voice_parallel.yml<br/>voz Kokoro"]
  voice --> render["render_phased.yml<br/>HyperFrames por fases + QA<br/>+ musica (ducking) + viñeta cine<br/>+ guarda de tamaño menor a 300MiB"]
  render --> priv["video PRIVADO en R2<br/>(pendiente de aprobar)"]
  priv --> app["Juan lo ve en la app"]
  app -- aprueba --> pub["publish_youtube.yml<br/>SEO + miniatura"]
  pub --> sched["schedule_youtube.yml<br/>mejor hora libre"]
  sched --> shorts["shorts_plan -> shorts_final<br/>shorts de los mejores momentos"]
```

---

## 2) Oddly Loop — produccion full-auto por pieza

```mermaid
flowchart TD
  cron["daily_oddly.yml<br/>(12:30 UTC = 7:30am Bogota)"] --> plan["lee cadence.json<br/>piezas por categoria (rota nicho)"]
  subgraph prod["produce_oddly.yml (por pieza)"]
    g["compilation_script.mjs<br/>guion (puro = sin voz / narrado)"] --> v["voz Kokoro (si es narrado)"]
    v --> lib["baja la biblioteca ASMR curada (R2)"]
    lib --> asm["build_compilation.mjs<br/>clips legales (Pexels/Pixabay)<br/>+ mezcla de sonido por nicho<br/>+ grade cine"]
    asm --> gate{"compliance_check.mjs<br/>solo fuentes con licencia"}
    gate -- falla --> block["NO publica (avisa)"]
    gate -- ok --> up["sube a YT2 (privado)"]
    up --> sc["programa a la mejor hora libre"]
  end
  plan --> g
  sc --> report["report_auto2.yml (cada 2h)<br/>vistas + top + mejores horas -> app"]
```

---

## 3) El cerebro decide que se produce (Oddly Loop)

Desde la auditoria de septiembre-2026 la tanda de las 12:30 UTC ya no fabrica narrados
(`LINEUP_MODE=on`): quien decide es `brain_live.yml`, cada 2 horas.

```mermaid
flowchart TD
  cron["brain_live.yml (cada 2h, 24/7)"] --> lee["baja de R2 lo que sabe:<br/>scores, ledger, cohortes, metas"]
  lee --> juz{"hay decisiones<br/>con plazo vencido?"}
  juz -- si --> ver["las juzga contra SU criterio:<br/>ACERTO / FALLO / INCONCLUSO<br/>(2 fallos seguidos revierten)"]
  juz -- no --> plan
  ver --> plan["lib/lineup.mjs arma el plan de hoy y manana<br/>(cada pieza = decision + razon + evidencia<br/>+ metrica + plazo + criterio)"]
  plan --> prod["produce_oddly.yml<br/>max 3 piezas por ciclo, cada una<br/>a su franja y con horas de margen"]
  plan --> bit["bitacora + ledger -> R2 -> Mini App /app2"]
```

---

## 4) Agendado (por DATOS) — separado por canal

```mermaid
flowchart TD
  rep["los reportes calculan best_hours.json<br/>(horas ET con mas vistas/dia)"] --> hrs{"hay datos suficientes<br/>(6 o mas videos publicos)?"}
  hrs -- si --> dh["usa las mejores horas del canal"]
  hrs -- no --> res["usa horas de research<br/>(pico tarde/noche EEUU)"]
  dh --> slot
  res --> slot["elige franja:<br/>1) reparte en huecos vacios<br/>2) tope 2 por hora<br/>(6 franjas/dia)"]
  slot --> dl["The Data Lens: nextBestSlot (Worker)<br/>ocupadas = SOLO su canal"]
  slot --> ol["Oddly Loop: best_slot.mjs + scheduled_times.mjs<br/>ocupadas = SOLO YT2"]
```

---

## 5) Estado y control (app y nube)

```mermaid
flowchart LR
  yt["YouTube API"] --> reps["report_auto2.yml (cada 2h)<br/>channel_report.yml (cada 6h)"]
  reps --> r2["R2: channel/state.json<br/>channel/auto2/state.json<br/>best_hours.json"]
  app["Telegram Mini App"] -- "GET /api/state (auth Telegram)" --> worker["Cloudflare Worker"]
  worker --> r2
  app -- "accion (aprobar / programar / producir)" --> worker
  worker -- "dispatch (GH_TOKEN)" --> wf["workflows"]
  worker -- "notify" --> tg["Telegram (silencioso 11pm-5am Bogota)"]
```

---

## 6) Biblioteca de sonido ASMR (curada, CC0)

```mermaid
flowchart TD
  b["build_asmr_library.yml<br/>(manual, al cambiar paletas)"] --> f["Freesound (solo CC0):<br/>paletas por nicho + stingers + pack de edicion"]
  f --> r2["R2: asmr_lib.tgz + sfx_edit.tgz"]
  r2 --> use1["produce_oddly la usa<br/>(mezcla ASMR por nicho)"]
  r2 --> use2["render_phased usa el pack de edicion<br/>(whooshes en transiciones)"]
```

---

## 7) Vigilancia y auto-sanado

```mermaid
flowchart LR
  wd["watchdog.yml (diario 11:00 UTC)"] --> chk{"R2, tokens de YouTube<br/>y crons de produccion vivos?"}
  chk -- no --> avisa["avisa a Telegram<br/>(solo si hay fallo)"]
  chk -- si --> ok["silencio"]
  bl["schedule_backlog_*.yml (cada 6h)"] --> sana["re-agenda lo que quedo sin programar"]
  err["errores de workflows"] --> learn["error_learn.mjs<br/>registra causa y arreglo -> app"]
```

---

## Resumen de cadencia

| Canal | Cuando | Que produce |
|---|---|---|
| The Data Lens | pausado; solo `data_shock.yml` los lunes 15:00 UTC | 1 experimento semanal (privado, Juan aprueba) |
| Oddly Loop | `brain_live.yml` cada 2h + `daily_oddly.yml` 12:30 UTC | las piezas del plan del cerebro (se programan solas) |
| Reportes | Oddly cada 2h · Data Lens cada 6h | refrescan vistas, top y mejores horas |
| Watchdog | diario 11:00 UTC | avisa si R2, los tokens o los crons se cayeron |
