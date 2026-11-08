// radar_backlog.mjs — reglas para que el radar no acumule issues (puras y probadas en tests/radar_backlog.test.mjs).
//   - Cupo: cada barrido crea como maximo POR_SEMANA ideas por repo, y nunca deja mas de TECHO abiertas.
//   - Vencimiento: una idea `radar` que nadie toca en DIAS_VENCE dias se cierra sola con la etiqueta
//     `radar-vencido`. Esas NO cuentan como "cerradas" para el anti-duplicados: si vuelven a ser
//     relevantes, el barrido puede proponerlas de nuevo.
export const POR_SEMANA = 3;
export const TECHO = 10;
export const DIAS_VENCE = 42;
export const ETIQUETA_VENCIDO = "radar-vencido";

// Cuantas ideas nuevas puede crear esta corrida, dado cuantas `radar` hay abiertas.
export function cupo(abiertasRadar, porSemana = POR_SEMANA, techo = TECHO) {
  return Math.max(0, Math.min(porSemana, techo - Math.max(0, abiertasRadar | 0)));
}

// Titulos cerrados que el anti-duplicados debe respetar (los vencidos quedan libres para volver).
export function cerradosQueCuentan(cerrados) {
  return (cerrados || []).filter((i) => !(i.labels || []).some((l) => (l.name || l) === ETIQUETA_VENCIDO)).map((i) => i.title);
}

// Issues `radar` abiertos que vencieron: sin actividad en `dias` y sin un PR abierto que los mencione.
// issues: [{ number, updated_at, labels }]; textosPR: cuerpos+titulos de los PR abiertos del repo.
export function vencidos(issues, textosPR = [], ahoraMs = Date.now(), dias = DIAS_VENCE) {
  const limite = ahoraMs - dias * 864e5;
  const enPR = (n) => textosPR.some((t) => new RegExp("#" + n + "(?![0-9])").test(t || ""));
  return (issues || []).filter((i) => {
    const t = Date.parse(i.updated_at);
    return Number.isFinite(t) && t < limite && !enPR(i.number);
  }).map((i) => i.number);
}
