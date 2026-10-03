// volumen_util.mjs — ¿subir el volumen sirve de algo, o hay que cambiar el formato?
//
// Por que existe: el Cerebro tenia una regla fija para Oddly — "si va atras, mas
// volumen del ganador" — que subia la cadencia de 8 a 12 Shorts/dia. Para Data Lens
// ya habia aprendido lo contrario ("el volumen no arregla 0 vistas"), pero Oddly
// seguia con la regla vieja.
//
// Medido el 2026-10-03 en el canal real: 518 videos publicados, 67 suscriptores, y
// los Shorts maduros dan una MEDIANA DE 46 VISTAS. A ese ritmo, 4/dia durante 90 dias
// son ~16.500 vistas contra una meta de 10.000.000: falta un factor de ~600x. Subir a
// 12/dia lo deja en ~50.000, que sigue siendo 200x corto. O sea: producir mas solo
// multiplica videos que nadie ve, y gasta 50% mas de computo para nada.
//
// La regla correcta no es una opinion sobre el volumen, es aritmetica: el volumen
// sirve cuando las VISTAS POR VIDEO que ya tienes, multiplicadas por el maximo de
// videos que puedes hacer, alcanzan la meta. Si no alcanzan ni de lejos, el problema
// es el formato (que nadie lo distribuye), y mas cantidad no lo toca.

/** Cuanto puede estirarse el rendimiento actual antes de que sea iluso esperarlo. */
const FACTOR_ILUSORIO = 5;

/**
 * @param {object} e
 * @param {number} e.vistasTotales  vistas acumuladas del canal
 * @param {number} e.videos         videos publicados
 * @param {number} e.metaVistas     meta de vistas
 * @param {number} e.diasRestantes  dias hasta la fecha limite
 * @param {number} [e.cadenciaAlta] videos/dia cuando se empuja
 * @param {number} [e.cadenciaNormal] videos/dia de crucero
 * @returns {{vistasPorVideo:number, vistasPorVideoNecesarias:number, factor:number,
 *            volumenSirve:boolean, cadencia:number, reestructurar:boolean, razon:string}}
 */
export function decidirVolumen({
  vistasTotales,
  videos,
  metaVistas,
  diasRestantes,
  cadenciaAlta = 12,
  cadenciaNormal = 8,
}) {
  const vids = Math.max(1, Number(videos) || 0);
  const dias = Math.max(1, Number(diasRestantes) || 1);
  const faltan = Math.max(0, (Number(metaVistas) || 0) - (Number(vistasTotales) || 0));

  // Ya se cumplio: no hay nada que empujar.
  if (faltan === 0) {
    return {
      vistasPorVideo: (Number(vistasTotales) || 0) / vids,
      vistasPorVideoNecesarias: 0,
      factor: 0,
      volumenSirve: true,
      cadencia: cadenciaNormal,
      reestructurar: false,
      razon: "meta cumplida — cadencia de crucero",
    };
  }

  const vistasPorVideo = (Number(vistasTotales) || 0) / vids;
  // Lo que tendria que rendir cada video nuevo si produjeramos al maximo cada dia.
  const necesarias = faltan / (cadenciaAlta * dias);

  // Sin historial no se puede juzgar: se empuja, que es lo que permite medir.
  if (vistasPorVideo <= 0) {
    return {
      vistasPorVideo: 0,
      vistasPorVideoNecesarias: necesarias,
      factor: Infinity,
      volumenSirve: true,
      cadencia: cadenciaAlta,
      reestructurar: false,
      razon: "sin vistas medidas todavia — empujar para tener datos",
    };
  }

  const factor = necesarias / vistasPorVideo;

  // El volumen alcanza con lo que ya rinde cada video.
  if (factor <= 1) {
    return {
      vistasPorVideo, vistasPorVideoNecesarias: necesarias, factor,
      volumenSirve: true, cadencia: cadenciaAlta, reestructurar: false,
      razon: `el volumen alcanza: cada video rinde ${Math.round(vistasPorVideo)} y harian falta ${Math.round(necesarias)}`,
    };
  }

  // Hace falta mas de lo que rinde hoy, pero esta al alcance de una mejora normal.
  if (factor <= FACTOR_ILUSORIO) {
    return {
      vistasPorVideo, vistasPorVideoNecesarias: necesarias, factor,
      volumenSirve: true, cadencia: cadenciaAlta, reestructurar: false,
      razon: `hay que subir ${factor.toFixed(1)}x las vistas por video (${Math.round(vistasPorVideo)} -> ${Math.round(necesarias)}): alcanzable, empujar volumen`,
    };
  }

  // Aqui el volumen ya no es la palanca: ni produciendo al maximo se llega.
  return {
    vistasPorVideo, vistasPorVideoNecesarias: necesarias, factor,
    volumenSirve: false, cadencia: cadenciaNormal, reestructurar: true,
    razon: `mas volumen NO cierra la brecha: cada video rinde ${Math.round(vistasPorVideo)} vistas y harian falta ${Math.round(necesarias)} (${Math.round(factor)}x) incluso a ${cadenciaAlta}/dia — el problema es el formato, no la cantidad`,
  };
}
