// footage_filter.mjs — FILTRO COMPARTIDO de calidad de footage (todo el proyecto).
// Aprendizaje de validar frame por frame: los buscadores (NASA/Archive/stock) devuelven cosas que
// arruinan un video: episodios PRODUCIDOS con texto/logos quemados, b-roll de INGENIERÍA (naves, lab,
// hardware), y footage de MISIÓN/LANZAMIENTO (cohetes, astronautas). Este filtro los rechaza y exige
// que el clip sea del SUJETO. Úsalo en cualquier fetch de footage: NASA, Archive, stock, Oddly.
//
//   import { FOOTAGE_BAD, FOOTAGE_GOOD, kwOf, keepFootage, prefersGood } from "./footage_filter.mjs";

// Rechazar: producido con texto quemado / ingeniería / misión-lanzamiento / gráficos-diagramas.
export const FOOTAGE_BAD = /spacecraft|instrument|engineer|clean.?room|assembly|technician|laborator|scientist|interview|briefing|this week|sciencecast|\bnews\b|press|conference|what'?s up|prepares|launch|liftoff|lift-off|shuttle|booster|\bsts\b|\bapollo\b|astronaut|spacewalk|docking|\bmodule\b|\brover\b|\blanding\b|touchdown|parachute|splashdown|countdown|orbiter|capsule|\brocket\b|hardware|mock.?up|being built|payload|antenna|thruster|blueprint|tutorial|how to|mission control|\bcrew\b|training|explains|explained|\bdeploy|solar array|wind tunnel|centrifuge|vibration test|animation of the|\blogo\b|diagram|chart|infographic|map of|timeline|webinar|hangout|q&a|lecture|\bksc\b|ksc-|kennedy space|cape canaveral|vandenberg|s-\d{5}|test stand|pad \d|gantry|vehicle assembly/i;

// Preferir (footage limpio y contemplativo): visualizaciones, sobrevuelos, timelapses, telescopios, paisajes.
export const FOOTAGE_GOOD = /visuali|fly.?through|fly.?over|flyby|orbit|time.?lapse|rotat|zoom|\bpan\b|\bview\b|surface|aurora|nebula|galaxy|starfield|deep field|cosmos|solar flare|prominence|corona|rings|from space|from orbit|from the iss|milky way|hubble|webb|spitzer|chandra|observatory|space telescope|telescope image/i;

export const kwOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3);

// ¿Conservar este ítem? text = título + descripción; want = palabras clave del sujeto (kwOf(query)).
export function keepFootage(text, want) {
  const t = String(text || "").toLowerCase();
  if (FOOTAGE_BAD.test(t)) return false;                       // fuera producido/ingeniería/misión/gráficos
  if (want && want.length && !want.some((w) => t.includes(w))) return false; // debe ser del sujeto
  return true;
}

// 1 si el texto sugiere footage "bueno" (para ordenar candidatos), 0 si no.
export const prefersGood = (text) => (FOOTAGE_GOOD.test(String(text || "").toLowerCase()) ? 1 : 0);
