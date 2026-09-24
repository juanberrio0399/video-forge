# AI OS — fases, validación y pendientes

Estado del AI OS (Video Forge · Viento · Radar). Una fase solo se marca **hecha** cuando hay evidencia
en producción: un PR desplegado o una respuesta verificada. Actualizado: 2026-09-14.

## Fases

| Fase | Qué | Estado | Evidencia |
|---|---|---|---|
| 0 · Seguridad | Radar: título de issue sin shell, motor limitado al repo, acceso cerrado, merge con CI verificado. Viento: pedidos sin claves internas, TikTok con enlace firmado | Hecha | video-forge #104 y panel-marketing-cloud #40 desplegados; sin initData responde 401/403 |
| 1 · Design system | Tokens, componentes e iconos compartidos (`shared/os-ui.mjs`) | Hecha | Tests de UI; copias en Viento vigiladas por `os_sync.yml` |
| 2 · Contrato + Orchestrator | Pulse por sistema, decisiones con autonomía, "sin señal" a las 3 h, estado unido al leer | Hecha | video-forge #105, panel #41. El Orchestrator ve los tres sistemas reportando |
| 3 · App común | `/os` en los tres bots: Pulse, Trabajo, Decisiones y Panel; el menú entra al OS | Hecha | video-forge #107, panel #42. `/os` responde 200 y los tres menús quedaron puestos |
| 4 · Radar OS | Score de oportunidades con impacto, salud por repo, 11 repos visibles, avisos | Parcial | Hoy: PRs y fallos como decisiones; score solo por prioridad × esfuerzo |
| 5 · Viento OS | Aprobar despachos y gasto dentro del OS, CPA y dinero de hoy | Parcial | Hoy: ventas, despachos pendientes, seguidores y gasto de 7 días en el pulse |
| 6 · Copiloto y briefs | Preguntas en lenguaje natural, resumen de mañana y cierre del día | Pendiente | No existe todavía; no se muestra "Ask" hasta que exista |

## Lo que va saliendo

| # | Pendiente | Sistema | Dónde se arregla | Estado |
|---|---|---|---|---|
| 1 | Estrategia de Oddly Loop: la meta completa iba ≈61× lejos | Video Forge | Decidido | Cerrado: opción A (hito intermedio, líder con mayoría de cupos, ganchos semanales, revisión a 28 días) |
| 2 | El barrido de Radar del 2026-09-07 falló: todos los modelos de Gemini dieron 429 | Radar | Repo | Mitigado: un repo a la vez y espera creciente; falta respaldo con otra IA gratis |
| 3 | PR #34 de ugpp-shield-pro con build-test fallando | Radar | Repo + acción manual | Abierto |
| 4 | Dependabot en video-forge: vitest crítico y moderado | GitHub | Repo | PR #106 en curso |
| 5 | Code scanning alto: 4 carreras de archivos y 1 regex sin ancla | GitHub | Repo | Cerrado: #108, 0 alertas altas abiertas |
| 6 | Code scanning medio: 95 avisos de "archivo↔red" propios de un pipeline que baja y sube archivos | GitHub | Decisión pendiente | Abierto |
| 7 | Dependabot apagado en los 8 repos privados | GitHub | Settings de GitHub | Abierto |
| 8 | 5 PRs de Dependabot para subir acciones de GitHub (#52–#56) | GitHub | Repo | Abierto |
| 9 | Viento: `claude.yml` expone el token de Meta, `SIGN_KEY` viaja en la URL, el webhook de Mercado Pago no valida firma ni monto | Viento | Repo | Abierto |
| 10 | Radar groom cierra issues sin preguntar | Radar | Repo | Abierto |
| 11 | En Trabajo las producciones salen como "Producir Short" sin el nicho | Video Forge | Repo | Abierto |
| 12 | Aprobar despachos y merge desde Decisiones sin salir del OS | Viento / Radar | Repo | Fases 4 y 5 |
| 13 | Registro de auditoría (quién sugirió, preparó, ejecutó o aprobó) | OS | Repo | Abierto |
| 14 | Texto viejo "Botón 'Panel'" en el workflow Activar Telegram de Viento | Viento | Repo | Menor |
| 15 | Los sanadores del backlog trataban una lista de ocultos ilegible como vacía y podían programar videos ocultos | Video Forge | Repo | Corregido: falla cerrado |
| 19 | Las Mini Apps abrían los paneles viejos (menú del bot, botones de inicio y /radar) | Los tres | Repo | Cerrado: #112 y #43 |
| 20 | QA de interfaz: desborde con textos largos, cortes sin puntos suspensivos, sin botón Cerrar, atrás ausente en paneles | OS | Repo | Cerrado: #113, 131/131 pruebas E2E |
| 21 | Seguridad: video descargable sin firma, sesión de Radar débil, body roto silenciaba alertas de la tienda, 404 y firmas | Los tres | Repo | Cerrado: #113 y #44, 81 pruebas en producción |
| 22 | GitHub se salta crons frecuentes (Orchestrator 2 de ~26, cerebro 2 de 8) y atrasa todos 2–5 h | OS | Repo | Corregido: reloj en el Worker de Video Forge cada 30 min |
| 23 | Data Shock falló con 0 datos del guion (ffmpeg sin nada que unir) | Video Forge | Repo | Corregido: falla claro antes de ensamblar; revisar el guion si se repite |
| 24 | Falsos verdes: Pinterest sin secrets y respuesta a comentarios salía bien ante errores; watchdog alertaba por un workflow apagado a propósito | Video Forge | Repo | Corregido |
| 25 | bilibili_upload.yml roto desde el 26/08 (cambió la interfaz) y thumbnail_only.yml sin paquete en R2 | Video Forge | Decisión pendiente | Abierto |
| 26 | Aviso de Node 20 obsoleto en acciones @v4 (12 workflows de la tienda, 11 de video-forge) | GitHub | Repo | Abierto |
| 27 | Webhook de Mercado Pago sin verificación de firma x-signature (requiere el secreto de webhook de MP) | Viento | Falta el secreto | Abierto |
| 16 | hide_video.yml y reset_data_lens.yml arrancan de una lista vacía si no pueden leer la de ocultos | Video Forge | Repo | Abierto |
| 18 | El pulse contaba fallos de tests en ramas de PR como fallos de producción y dejaba a Video Forge en atención | Video Forge | Repo | Corregido: solo cuenta main |
| 17 | Los crons de GitHub llegan con horas de atraso o se saltan: el sanador de las 18:41 corrió a las 21:07 | Video Forge | Repo | Vigilar |
