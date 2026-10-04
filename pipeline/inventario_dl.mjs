// inventario_dl.mjs — resuelve EL inventario de The Data Lens, de una vez y para todos.
//
// Por que existe: `channel/inventory_cache.json` NO es una fuente de datos. Lo escribe el
// Worker del bot de Telegram (bot/src/index.js) y solo cuando alguien ABRE la app, y SIETE
// workflows lo borran a proposito para invalidar el cache del bot. Aun asi, cuatro workflows
// lo leian como si fuera la verdad del canal. Resultado medido el 2026-10-04: `episodes.yml`
// sacaba "0 episodios" y todo el analisis de Data Lens llevaba 11 dias congelado sobre una
// copia vieja, mientras la alerta decia "Pipeline parado" midiendo la edad del DATO.
//
// La verdad del canal es `channel/state.json`, que mantiene `channel_report.yml`. El cache
// solo se usa si trae datos (es mas fresco cuando existe); si no, se cae al estado.
//
// Uso: node pipeline/inventario_dl.mjs <cache.json> <state.json> <salida.json>
// Salida: { fuente, list, longs, shorts } — cada consumidor toma la forma que necesita.
import fs from "node:fs";
import { normalizarInventario } from "./lib/inventario.mjs";
import { segundosISO, esLargo } from "./lib/duracion.mjs";

const [cacheF, stateF, outF = "inventario_dl.json"] = process.argv.slice(2);
const leer = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return {}; } };

const deCache = normalizarInventario(leer(cacheF));
const deState = normalizarInventario(leer(stateF));
// El cache gana solo si trae algo; si viene vacio o borrado, manda el estado.
const [list, fuente] = deCache.length ? [deCache, "cache del bot"] : [deState, "channel/state.json"];

// Se reparte por DURACION, no por la etiqueta que trajera el origen: es el mismo corte que
// usa YouTube para Shorts y no depende de como lo clasificara quien escribio el archivo.
const longs = list.filter((v) => esLargo(v.seconds != null ? v.seconds : segundosISO(v.duration)));
const shorts = list.filter((v) => !longs.includes(v));

fs.writeFileSync(outF, JSON.stringify({ at: new Date().toISOString(), fuente, list, longs, shorts }, null, 2));
console.log(`inventario data-lens: ${list.length} videos (${longs.length} largos, ${shorts.length} shorts) · fuente: ${fuente} -> ${outF}`);
if (!list.length) console.warn("AVISO: inventario VACIO en las dos fuentes. Lo que lea de aqui no significa nada.");
