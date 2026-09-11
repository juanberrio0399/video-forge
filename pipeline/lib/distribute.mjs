// distribute.mjs — utilidades PURAS de distribución multiplataforma (repostear a más superficies
// gratis para multiplicar vistas). Compartidas por los repostadores (Telegram, Tumblr, ...).
// Todo gratis y automático; nada de spam ni comentar en canales ajenos (eso quema la cuenta).

// Videos PÚBLICOS con id que aún NO se repostaron a esta superficie (anti-duplicado por ledger).
export function pickNew(list, doneIds, max = 5) {
  const done = doneIds instanceof Set ? doneIds : new Set(doneIds || []);
  const out = [];
  for (const v of list || []) {
    if (v && v.video_id && v.privacy === "public" && !done.has(v.video_id)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

// URL pública del video (Short o largo).
export function youtubeUrl(v) {
  const id = v && v.video_id;
  const isShort = !v || v.format === "short" || (Number(v.seconds) > 0 && Number(v.seconds) <= 90) || v.is_short;
  return isShort ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
}

// Limpia el título (sin hashtags quemados) y lo acota.
export function cleanTitle(t, max = 100) {
  return String(t || "").replace(/#\w+/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Hashtags por canal/nicho (discovery). Devuelve string "#a #b".
export function hashtagsFor(v, channel) {
  if (channel === "data-lens") return "#shorts #history #facts #dataviz";
  const label = String((v && v.niche_label) || "").toLowerCase();
  if (/satisf|relax|asmr/.test(label)) return "#shorts #satisfying #asmr #oddlysatisfying";
  if (/animal/.test(label)) return "#shorts #animals #cute #asmr";
  if (/space|cosmos|nat/.test(label)) return "#shorts #space #relaxing #nature";
  return "#shorts #satisfying #oddlysatisfying";
}

// Caption listo para repostear (título + url + hashtags), acotado a `max`.
export function caption(v, channel, opts = {}) {
  const title = cleanTitle(v && v.title);
  const url = youtubeUrl(v);
  const tags = opts.hashtags != null ? opts.hashtags : hashtagsFor(v, channel);
  const max = opts.max || 480;
  return `${title}\n${url}\n${tags}`.slice(0, max);
}
