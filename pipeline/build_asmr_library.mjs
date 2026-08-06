// build_asmr_library.mjs — construye la BIBLIOTECA CURADA de sonidos ASMR del canal auto.
// Por cada PALETA (sources.seed.json) baja de Freesound los MEJORES sonidos CC0 (orden por
// descargas + rating) para la cama y los acentos, y escribe asmr_lib/ + manifest.json. El
// workflow sube todo a R2; cada video usa la biblioteca (calidad consistente, sin buscar en vivo).
//
// Uso: node pipeline/build_asmr_library.mjs   ·   Env: FREESOUND_API_KEY
import fs from "node:fs";

const FREESOUND = process.env.FREESOUND_API_KEY || "";
if (!FREESOUND) { console.error("Falta FREESOUND_API_KEY"); process.exit(1); }
const tf = (u, ms = 15000) => fetch(u, { signal: AbortSignal.timeout(ms) });
const sources = JSON.parse(fs.readFileSync("channel/auto2/sources.seed.json", "utf8"));
fs.mkdirSync("asmr_lib", { recursive: true });
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// El mejor sonido CC0 para un término: bien valorado; si no, el más descargado.
async function best(term) {
  const params = new URLSearchParams({ query: term, filter: 'license:"Creative Commons 0" duration:[2 TO 90]', sort: "downloads_desc", fields: "id,name,previews,avg_rating,num_downloads", page_size: "15", token: FREESOUND });
  const r = await tf(`https://freesound.org/apiv2/search/text/?${params}`);
  if (!r.ok) { console.error(`  freesound ${r.status} (${term})`); return null; }
  const j = await r.json();
  const c = (j.results || []).filter((x) => x.previews && x.previews["preview-hq-mp3"]);
  return c.find((x) => (x.avg_rating || 0) >= 3.5) || c[0] || null;
}
async function grab(term, tag, dir = "asmr_lib") {
  try {
    const h = await best(term);
    if (!h) return null;
    const file = `${dir}/${tag}.mp3`;
    const pr = await tf(h.previews["preview-hq-mp3"], 25000);
    if (!pr.ok) return null;
    fs.writeFileSync(file, Buffer.from(await pr.arrayBuffer()));
    return { file, id: h.id, name: h.name, url: `https://freesound.org/s/${h.id}/`, license: "cc0", downloads: h.num_downloads || 0 };
  } catch (e) { console.error(`  error (${term}): ${e.message}`); return null; }
}

const manifest = {};
let sonidos = 0, paletas = 0;
for (const [niche, cfg] of Object.entries(sources.niches || {})) {
  const pals = cfg.palettes || [];
  if (!pals.length) continue;
  manifest[niche] = {};
  for (const pal of pals) {
    const entry = { bed: null, accents: [], credits: [] };
    const bed = await grab(pal.bed, `${niche}_${slug(pal.name)}_bed`);
    if (bed) { entry.bed = bed.file; entry.credits.push(bed); sonidos++; }
    for (let i = 0; i < (pal.accents || []).length; i++) {
      const a = await grab(pal.accents[i], `${niche}_${slug(pal.name)}_acc${i}`);
      if (a) { entry.accents.push(a.file); entry.credits.push(a); sonidos++; }
    }
    manifest[niche][pal.name] = entry;
    paletas++;
    console.log(`  ${niche}/${pal.name}: cama ${entry.bed ? "ok" : "—"} + ${entry.accents.length} acentos`);
  }
}
fs.writeFileSync("asmr_lib/manifest.json", JSON.stringify(manifest, null, 2));
console.log(`Biblioteca ASMR lista: ${paletas} paletas, ${sonidos} sonidos CC0 -> asmr_lib/`);

// --- PACK DE SFX DE EDICION (para el creador de videos del canal principal) ---
// Whooshes/transiciones/pops CC0 para dar terminacion PRO a los videos de datos, sin
// depender de material ajeno. Se sube aparte (sfx_edit.tgz) para que el render lo baje ligero.
const EDIT = { whoosh: ["whoosh transition", "swoosh cinematic", "whoosh subtle"], pop: ["pop ui click"], riser: ["riser cinematic short"] };
fs.mkdirSync("sfx_edit", { recursive: true });
const editMan = { whoosh: [], pop: [], riser: [], credits: [] };
for (const [cat, terms] of Object.entries(EDIT)) {
  for (let i = 0; i < terms.length; i++) {
    const g = await grab(terms[i], `edit_${cat}_${i}`, "sfx_edit");
    if (g) { editMan[cat].push(g.file); editMan.credits.push(g); }
  }
}
fs.writeFileSync("sfx_edit/manifest.json", JSON.stringify(editMan, null, 2));
console.log(`Pack SFX edicion: ${editMan.whoosh.length} whoosh, ${editMan.pop.length} pop, ${editMan.riser.length} riser -> sfx_edit/`);

if (!sonidos) process.exit(1);
