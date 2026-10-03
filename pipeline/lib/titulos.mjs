// titulos.mjs — evita los dos defectos que mataron a The Data Lens.
//
// Medido en el canal el 2026-10-03 (45 Shorts listados, 3 suscriptores, 121 videos):
//
// 1) SE REPETIAN LOS TITULOS. Seis titulos distintos ocupaban 22 de los 45 videos:
//    "The Deadliest Siege in Human History" x7, "The Deadliest Volcano Eruption in
//    History" x6, "The Deadliest Gamble in Human History" x3... El pipeline SI evitaba
//    repetir TEMAS (history_used.json), pero nunca miro los TITULOS: dos temas distintos
//    (Leningrado, Constantinopla) colapsan en el mismo titulo generico. YouTube lee eso
//    como contenido repetitivo, y muchos de esos videos quedaron en CERO vistas.
//
// 2) EL TITULO GENERICO RINDE 6 VECES MENOS. Partiendo los 45 en dos grupos:
//      generico ("The Deadliest/Worst X in History"): n=33, mediana 2, media 7, 10 ceros
//      especifico (una historia concreta):            n=12, mediana 12, media 82
//    Los cinco mejores son todos concretos: "The Single Signature That Destroyed German
//    Democracy" (406), "The Single Key That Doomed The Titanic" (321), "The Lab Accident
//    That Saved Millions of Lives" (105).
//
// La misma forma que el unico Short que desperto en Oddly ("Why Baby Otters Hold Hands").
// Dos canales distintos apuntando a lo mismo: concreto y especifico le gana a superlativo
// generico.

/** Quita adornos para comparar titulos: hashtags, puntuacion, mayusculas, espacios. */
export function normalizar(titulo) {
  return String(titulo ?? "")
    .toLowerCase()
    .replace(/#\w+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿Este titulo ya se uso? Compara normalizado, asi que "#Shorts" o un punto no engañan. */
export function esDuplicado(titulo, usados) {
  const t = normalizar(titulo);
  if (!t) return false;
  return (usados || []).some((u) => normalizar(u) === t);
}

// Superlativos que producen titulos intercambiables. No es que la palabra sea mala: es que
// "The <superlativo> <cosa> in (Human) History" describe mil videos distintos por igual, y
// por eso el modelo cae ahi una y otra vez.
const SUPERLATIVOS = ["deadliest", "worst", "biggest", "greatest", "largest", "most dangerous", "craziest", "wildest", "scariest"];

/**
 * Detecta la forma "The <superlativo> ... in (Human|Recorded) History", que es la plantilla
 * en la que el modelo se queda atrapado.
 */
export function esGenerico(titulo) {
  const t = normalizar(titulo);
  if (!t) return false;
  const tieneSuper = SUPERLATIVOS.some((s) => t.includes(s));
  if (!tieneSuper) return false;
  // "in history" / "in human history" / "in recorded history" al final: la plantilla completa.
  return /\bin (human |recorded |world )?history\b/.test(t);
}

/**
 * Revisa un titulo recien generado contra las dos reglas.
 * @returns {{ok:boolean, motivo:string|null, queja:string|null}} `queja` es el texto que se
 *          le devuelve al modelo para que lo reintente sabiendo QUE hizo mal.
 */
export function revisar(titulo, usados) {
  const t = String(titulo ?? "").trim();
  if (!t) return { ok: false, motivo: "vacio", queja: "El titulo vino vacio. Escribe uno." };
  if (esDuplicado(t, usados)) {
    return {
      ok: false, motivo: "duplicado",
      queja: `El titulo "${t}" YA SE USO en este canal. Escribe uno distinto, sobre el angulo concreto de ESTE video.`,
    };
  }
  if (esGenerico(t)) {
    return {
      ok: false, motivo: "generico",
      queja: `El titulo "${t}" usa la plantilla "The <superlativo> ... in History", que en este canal rinde 6 veces menos (mediana 2 vistas contra 12) y se repite sola. Escribe un titulo sobre el detalle CONCRETO de esta historia: el objeto, la persona o la decision exacta.`,
    };
  }
  return { ok: true, motivo: null, queja: null };
}
