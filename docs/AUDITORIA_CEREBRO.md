# Auditoría del cerebro (Brain OS) — septiembre 2026

Auditoría destructiva del sistema de decisión de Video Forge, hecha sobre el código y la corrida real del
13-sep-2026. Informe completo con red team, ranking y puntuaciones: artefacto "Brain OS bajo red team".
Este documento deja en el repo qué se rompía y qué se cambió.

## Veredicto

El cerebro funcionaba como máquina (10 flujos sin fallos) y fallaba como estratega: medía la meta
equivocada, repartía la producción por medias de vistas acumuladas, tenía dos motores que se contradecían,
trataba datos faltantes como ceros y no guardaba qué predijo para juzgarse después.

Con los datos del 13-sep, Oddly Loop tenía 56 suscriptores y ~15.500 vistas por semana. El requisito
completo de Shorts (10 M en 90 días) exige ~111 mil vistas por día: una brecha de ~50×. Al ritmo actual la
meta es **improbable**; producir más no la cierra.

## Defectos corregidos

| Id | Defecto | Cambio |
|---|---|---|
| BR-01 | "Vistas de Shorts" = vistas totales de por vida | `pipeline/ypp_metrics.mjs` mide vistas de Shorts de 90 días y horas sin Shorts de 365 días (Analytics, `creatorContentType`). Sin dato queda `null`. |
| BR-02 | Metas inventadas (likes, 200 mil vistas) | Eliminadas de `lib/monetization.mjs` y del Worker. |
| BR-03 | Sin hitos ni viabilidad | `lib/ypp.mjs`: nivel intermedio y completo, ritmo real vs necesario, estado VIABLE / EN RIESGO / IMPROBABLE. |
| BR-04 | Dos motores de reparto contradictorios | `rebalance_oddly.mjs` es el motor único; `decision.json` es exactamente la cadencia ejecutada. |
| BR-05 | "Si va atrás, más volumen" | Escalar solo si la cohorte reciente no cae más de 25 % en vistas al día 7 (`lib/niche_rank.mjs: scaleGate`). Sin dato no escala. |
| BR-06 | Sin registro ni autocrítica | `lib/ledger.mjs`: cada decisión con métrica, criterio y fecha; se juzga ACERTÓ / FALLÓ / INCONCLUSO; 2 fallos seguidos revierten. |
| BR-07 | Ranking por media de vistas acumuladas | Mediana de la cohorte de 5 a 30 días con muestra mínima. |
| BR-08 | Mejores horas por suma | Mediana por hora con al menos 3 videos. |
| BR-09 | Nichos adivinados por título | Se marcan `niche_inferred` y no cuentan para decidir. |
| BR-11 | Dato faltante como cero, memoria sobrescrita | `pipeline/nonempty.mjs`: una fuente vacía no sobrescribe la memoria; las alertas ignoran claves ausentes. |
| BR-12 | Todo Oddly clasificado como largo | El inventario trae la duración de cada video. |
| BR-13 | Experimentos que cambian todo a la vez | El plan diario prueba una sola variable (gancho) en un solo nicho. |
| BR-17 | Clips de terceros pasaron la puerta legal | Clips de Internet Archive apagados (`ARCHIVE_CLIPS=off`). |

## Cerebro en vivo

`brain_live.yml` corre cada 2 horas, 24/7:

1. Revisa decisiones vencidas contra su propio criterio.
2. Rehace el plan de hoy y de mañana (`lib/lineup.mjs`). Cada pieza es una decisión con la cadena
   decisión → razón → evidencia → acción → métrica → plazo → criterio → siguiente.
3. Produce con al menos 3 horas de margen, máximo 3 piezas por ciclo, cada una en su franja del plan.
4. Escribe la bitácora de lo que pensó y separa lo que sabe, cree, desconoce y está comprobando.

La tanda de las 12:30 UTC (`daily_oddly.yml`) ya no fabrica narrados (`LINEUP_MODE=on`).

## Pendiente, fuera de estas correcciones

- **Data Lens: PAUSADO el 2026-09-14 por decisión de Juan.** Apagados `daily_video.yml` y `history_short.yml`;
  `data_shock.yml` pasa a 1 por semana (lunes 15:00 UTC). Registrado en el ledger (`channel_pause`): se revisa a los
  21 días; si un experimento supera 500 vistas a los 7 días se reanuda ese formato, si no se evalúa cerrar el canal.
- **Métricas que la API puede no dar:** impresiones y CTR de Shorts se prueban en cada medición y quedan
  marcadas como no disponibles si fallan. Espectadores recurrentes no se exponen por API.
- **Umbrales del programa:** confirmar en YouTube Studio para el país del canal.
