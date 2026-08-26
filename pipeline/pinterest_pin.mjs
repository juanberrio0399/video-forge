// pinterest_pin.mjs — Auto-pin de los Shorts PÚBLICOS de Oddly a un tablero de Pinterest (tráfico gratis).
// Desacoplado del render: lee el inventario público (channel/auto2/state.json) y pinea los que faltan.
// Anti-duplicado (channel/pinterest_pinned.json). Máx 5/corrida (rate limit). No pinea privados.
//
// Uso: node pipeline/pinterest_pin.mjs
// Env: PINTEREST_ACCESS_TOKEN, PINTEREST_BOARD_ID. Lee (cwd): auto2_state.json, pinterest_pinned.json.
import fs from "node:fs";

const TOKEN = process.env.PINTEREST_ACCESS_TOKEN, BOARD = process.env.PINTEREST_BOARD_ID;
if (!TOKEN || !BOARD) { console.error("Falta PINTEREST_ACCESS_TOKEN o PINTEREST_BOARD_ID — nada que hacer."); process.exit(0); }
const rj = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };

const state = rj("auto2_state.json", {});
const list = Array.isArray(state.list) ? state.list : [];
const pinned = new Set(rj("pinterest_pinned.json", []));
// Públicos, con id, no pineados aún. Máx 5 por corrida (respeta el rate limit de Pinterest).
const pubs = list.filter((v) => v && v.privacy === "public" && v.video_id && !pinned.has(v.video_id)).slice(0, 5);
if (!pubs.length) { console.log("Pinterest: nada nuevo que pinear."); process.exit(0); }

const done = [...pinned];
for (const v of pubs) {
  const thumb = `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`;
  const title = (v.title || "Space Facts").replace(/#\w+/g, "").trim().slice(0, 96);
  const tags = (v.niche_label && /nat|sat|relax|space/i.test(v.niche_label)) ? "#satisfying #relaxing" : "#space #relaxing #cosmos";
  try {
    const r = await fetch("https://api.pinterest.com/v5/pins", {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({
        board_id: BOARD,
        title,
        description: `${title} ${tags} #shorts #sleep`.slice(0, 480),
        link: `https://www.youtube.com/shorts/${v.video_id}`,
        media_source: { source_type: "image_url", url: thumb },
      }),
    });
    if (r.ok) { console.log(`✅ pin: ${v.video_id} — ${title}`); done.push(v.video_id); }
    else console.error(`pin ${v.video_id}: ${r.status} ${(await r.text()).slice(0, 140)}`);
  } catch (e) { console.error(`pin ${v.video_id}: ${e.message}`); }
}
fs.writeFileSync("pinterest_pinned_new.json", JSON.stringify([...new Set(done)].slice(-800)));
console.log(`Pinterest: ${done.length - pinned.size} nuevos pineados.`);
